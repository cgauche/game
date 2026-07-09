import { describe, it, expect, beforeEach } from 'vitest';
import { useGame } from './store';
import { makePregens } from '../data/pregens';
import { buildSeaPlan, runSeaDays } from './seaVoyageFlow';
import { buildRiverPlan, runRiverDays } from './riverVoyageFlow';
import { seedBattleRng } from './battleRng';
import { seaAutoResolves, riverAutoResolves, SEA_ROUTINE_KINDS } from './voyageCadence';
import { createHero } from '../engine/character';
import { makeRNG } from '../engine/dice';
import { buildScene } from './mapSpec';
import type { Combatant, SkillInstance } from '../engine/types';
import type { WorldMap } from './worldMap';

/**
 * CADENCE DE VOYAGE (#232) — la couche PARTAGÉE mer ⇄ fluvial : ordres COMMANDÉE (routine auto-résolue,
 * PV du jour) vs JOUR-PAR-JOUR (modale par jet). « Aucun jet silencieux » : chaque jet auto-résolu laisse
 * sa ligne au procès-verbal — on compte les lignes vs les jets. Les crises interrompent quand même.
 */
const get = useGame.getState.bind(useGame);
const set = useGame.setState.bind(useGame);

const seaMap: WorldMap = {
  id: 'm', nom: 'Mer des Griffes',
  places: [
    { id: 'A', label: 'Salzenmund', pos: { x: 0, y: 0 }, scene: 'port-a' },
    { id: 'B', label: 'Erengrad', pos: { x: 10, y: 0 }, scene: 'port-b', port: { taille: 3, richesse: 3, production: ['bois'] } },
  ],
  routes: [{ id: 'r1', a: 'A', b: 'B', km: 550, modes: ['mer'], sea: true, seaHeading: 'est' }],
};

function freshSea() {
  seedBattleRng(1);
  useGame.setState({
    party: makePregens().slice(0, 3),
    scene: { id: 'port-a', nom: 'Port', dimensions: { w: 2, h: 2 }, layers: [{ z: 0, tiles: ['sol', 'sol', 'sol', 'sol'] }], entities: [], dialogues: [], triggers: [] } as never,
    battle: null, worldMap: seaMap, travelPlan: null, travelRecap: null,
    pendingCrewTest: null, pendingRest: null, pendingSteamSave: null,
    gameTime: 8 * 60, lastUpkeepDay: 0,
    vessel: { vehicleId: 'cogue', morale: { score: 75, lastMoraleWeek: 0, factors: [] } },
    journal: [], net: { ...useGame.getState().net, mode: 'local' },
  } as never);
}

describe('couche voyageCadence — prédicats de routine', () => {
  it('SEA_ROUTINE_KINDS est la liste FERMÉE auto-résolue ; crises/embuscade/rapide restent hors liste', () => {
    for (const k of ['progression', 'affaler', 'phare', 'orientation', 'entretien']) expect(SEA_ROUTINE_KINDS.has(k)).toBe(true);
    for (const k of ['poursuite', 'tourbillon', 'embuscade', 'extermination', 'ouragan', 'voyage-rapide']) expect(SEA_ROUTINE_KINDS.has(k)).toBe(false);
    expect(seaAutoResolves({ cadence: 'commande' }, 'progression')).toBe(true);
    expect(seaAutoResolves({ cadence: 'commande' }, 'poursuite')).toBe(false);
    expect(seaAutoResolves({ cadence: 'jour-par-jour' }, 'progression')).toBe(false);
    expect(riverAutoResolves({ cadence: 'commande' })).toBe(true);
    expect(riverAutoResolves({ cadence: 'jour-par-jour' })).toBe(false);
  });
});

describe('traversée COMMANDÉE (mer) — routine auto-résolue, PV du jour, aucun jet silencieux', () => {
  beforeEach(freshSea);

  it('une journée commandée n’ouvre AUCUNE modale de Test de routine ; les jets tombent au PV du jour', () => {
    get().startTravel('r1', 'mer', { cadence: 'commande' });
    // La boucle a déroulé toute la journée sans s’arrêter sur un Test de routine → halte de nuit atteinte.
    expect(get().pendingCrewTest).toBeNull();
    expect(get().pendingRest).toBeTruthy();
    expect(get().travelPlan!.sea!.daysAtSea).toBe(1);
    const day = get().pendingRest!.travelDay!;
    // PV structuré : une ligne de JET par contributeur des Tests de routine (chaque jet a sa trace).
    expect((day.entries?.length ?? 0)).toBeGreaterThan(0);
    for (const e of day.entries!) expect(e.d).toBeTruthy(); // anatomie de jet (RollRow), pas du texte muet
    // Progression ET Orientation quotidiennes se sont jouées AU PV (ids `sea-<kind>-…`).
    const ids = day.entries!.map((e) => e.id ?? '');
    expect(ids.some((i) => i.startsWith('sea-progression'))).toBe(true);
    expect(ids.some((i) => i.startsWith('sea-orientation'))).toBe(true);
    // Instantané pour l’écran de traversée (rose des vents + jauges + distance restante).
    expect(day.sea).toBeTruthy();
    expect(day.sea!.milesLeft).toBeGreaterThan(0);
    expect(day.sea!.hull.max).toBeGreaterThan(0);
  });

  it('aucun jet silencieux : chaque Test de routine du jour a au moins une ligne au PV (lignes ≥ jets)', () => {
    get().startTravel('r1', 'mer', { cadence: 'commande' });
    const day = get().pendingRest!.travelDay!;
    // Un RÉSUMÉ DR par Test (ligne « … : DR … → succès/échec ») au journal du jour, + les entrées.
    const drLines = day.lines.filter((l) => /DR .* → (succès|échec)/.test(l)).length;
    const kinds = new Set(day.entries!.map((e) => (e.id ?? '').split('-')[1]));
    expect(drLines).toBeGreaterThanOrEqual(kinds.size); // au moins une trace par nature de Test joué
  });
});

describe('traversée JOUR-PAR-JOUR (mer) — cadence manuelle inchangée', () => {
  beforeEach(freshSea);

  it('chaque Test de Navigation ouvre sa modale (pendingCrewTest), rien n’est auto-résolu', () => {
    get().startTravel('r1', 'mer', { cadence: 'jour-par-jour' });
    const p = get().pendingCrewTest;
    expect(p?.voyage).toBeTruthy();
    expect(get().travelPlan!.sea!.entries ?? []).toHaveLength(0); // pas de PV auto en cadence manuelle
  });

  it('l’API sans cadence explicite reste JOUR-PAR-JOUR (rétro-compat)', () => {
    get().startTravel('r1', 'mer');
    expect(get().pendingCrewTest?.voyage).toBeTruthy();
  });
});

describe('interruptions (mer) — la route commandée NE muselle PAS les crises', () => {
  beforeEach(freshSea);

  it('une Poursuite en cours ouvre sa modale même en route COMMANDÉE (jamais auto-résolue)', () => {
    const plan = buildSeaPlan(get, 'r1', 'A', 'B', seaMap.routes[0], { cadence: 'commande' })!;
    plan.sea!.crisis = { kind: 'poursuite', label: 'Nef corsaire', distance: 5, escapeAt: 100, foeM: 5, foeSkill: 50, desc: 'x' };
    plan.sea!.step = 'crise';
    set({ travelPlan: plan } as never);
    runSeaDays(get, set);
    expect(get().pendingCrewTest?.voyage?.kind).toBe('poursuite'); // décision requise → modale, PAS le PV
  });
});

// ── FLUVIAL (#91) : la journée de descente de ROUTINE s’auto-résout SANS modale par jet ───────────────

function riverSkill(c: Combatant, skillId: string, advances: number, spec?: string): void {
  const ex = c.skills.find((s) => s.skillId === skillId && (s.spec ?? null) === (spec ?? null));
  if (ex) ex.advances = Math.max(ex.advances, advances);
  else c.skills.push({ skillId, spec, advances } as SkillInstance);
}

function riverCrew(): Combatant[] {
  const gunnar = createHero({ speciesId: 'humains-reiklander', careerId: 'batelier', name: 'Gunnar', motivation: 'x', rng: makeRNG(11), id: 'r-gunnar' });
  riverSkill(gunnar, 'ramer', 50);
  riverSkill(gunnar, 'voile', 45);
  riverSkill(gunnar, 'metier', 40, 'Construction de bateaux');
  return [gunnar];
}

const quai = (id: string, nom: string) => buildScene({ id, nom, description: '.', size: [8, 6], terrain: 'planches', heroStart: [2, 3] });

function riverMap(km: number): WorldMap {
  return {
    id: 'm', nom: 'Le Reik',
    places: [
      { id: 'A', label: 'Grünburg', pos: { x: 0, y: 0 }, scene: 'quai-a' },
      { id: 'B', label: 'Altdorf', pos: { x: 90, y: 0 }, scene: 'quai-b' },
    ],
    routes: [{ id: 'r-reik', a: 'A', b: 'B', km, modes: ['barge', 'pied'], river: true, inns: true, perilDie: 0 }],
  };
}

describe('descente FLUVIALE COMMANDÉE (#91) — routine sans modale par jet', () => {
  beforeEach(() => {
    seedBattleRng(7);
    const g = get();
    g.setParty(riverCrew());
    g.loadProject([quai('quai-a', 'Grünburg'), quai('quai-b', 'Altdorf')], 'quai-a', riverMap(45));
    set({ money: { gold: 500, silver: 0, brass: 0 }, travelPlan: null, pendingRest: null, pendingCascade: null, travelRecap: null, journal: [], net: { ...get().net, mode: 'local' } } as never);
  });

  it('une journée de routine s’auto-résout d’un bloc (aucun pendingCascade) et enchaîne la halte', () => {
    const plan = buildRiverPlan(get, 'r-reik', 'A', 'B', get().worldMap!.routes[0], { cadence: 'commande' })!;
    expect(plan.orders!.cadence).toBe('commande');
    set({ travelPlan: plan } as never);
    runRiverDays(get, set);
    expect(get().pendingCascade).toBeNull(); // #91 : plus de modale par jet en route commandée
    expect(get().pendingRest).toBeTruthy(); // la journée s’est jouée puis la halte de nuit s’ouvre
    expect(get().journal.some((l) => /Progression du jour/.test(l))).toBe(true); // trace du jour au PV
  });

  it('en JOUR-PAR-JOUR la même journée ouvre la cascade influençable (comportement historique)', () => {
    const plan = buildRiverPlan(get, 'r-reik', 'A', 'B', get().worldMap!.routes[0], { cadence: 'jour-par-jour' })!;
    set({ travelPlan: plan } as never);
    runRiverDays(get, set);
    expect(get().pendingCascade).toBeTruthy();
    expect(get().pendingCascade!.purpose).toBe('travelDay');
  });
});
