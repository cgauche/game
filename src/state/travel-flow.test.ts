/**
 * VOYAGE TERRESTRE (LDB « Voyage » + EDOC ch.5 « Voyage par Étapes ») — la journée de route JOUÉE.
 * Depuis la Phase B, TOUS les jets du JOUR terrestre (Activités de l'Étape, Exposition de fin d'Étape,
 * péripéties Survie/Perception) passent par la MÊME cascade influençable (`purpose:'travelDay'`,
 * Chance/Pacte/Résilience) que le voyage fluvial et la nuit — plus d'auto-résolution inline. La cascade
 * du jour se clôt sur le calcul de la progression (IDENTIQUE à l'ancien chemin) puis enchaîne la halte
 * de nuit / l'arrivée. La marche forcée reste une étape de la cascade de NUIT (inchangée).
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { useGame } from './store';
import { seedBattleRng } from './battleRng';
import { emptyScene, Scene } from './scene';
import { buildEncounter } from './encounterAuthoring';
import { WorldMap } from './worldMap';
import { CAMPAIGN_START } from '../engine/clock';
import { setRule, resetRule } from '../engine/policy';
import { rationCount } from '../engine/provisions';
import type { Combatant, ItemInstance } from '../engine/types';

const get = () => useGame.getState();

const ration = (uid: string): ItemInstance => ({ uid, name: 'Ration', trappingId: 'ration', kind: 'misc', qualities: [], enc: 0, equipped: false });
const hero = (p: Partial<Combatant> = {}): Combatant => ({
  id: 'h', name: 'Hilda', kind: 'hero',
  characteristics: { 'capacite-de-combat': 30, 'capacite-de-tir': 30, force: 30, endurance: 40, initiative: 30, agilite: 30, dexterite: 30, intelligence: 30, 'force-mentale': 35, sociabilite: 30 },
  wounds: { current: 12, max: 12 }, advantage: 0, conditions: [], skills: [], talents: [],
  weapons: [], armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
  items: [], movement: 4, ...p,
} as Combatant);
function sceneA(): Scene {
  const s = emptyScene(10, 10); s.id = 'lieu-a-scene'; s.nom = 'A';
  const enc = buildEncounter({ id: 'enc-test', enemies: [{ statblock: { name: 'Brigand', char: { 'capacite-de-combat': 30, force: 30, endurance: 30, initiative: 30, agilite: 30, B: 8 } }, pos: { x: 5, y: 5 } }] });
  s.entities.push(...enc.entities); s.encounters = [enc.encounter];
  return s;
}
function sceneB(): Scene { const s = emptyScene(10, 10); s.id = 'lieu-b-scene'; s.nom = 'B'; return s; }
function map(rp: Partial<WorldMap['routes'][0]> = {}): WorldMap {
  return { id: 'c', nom: 'c', places: [
    { id: 'pa', label: 'A', pos: { x: 20, y: 50 }, scene: 'lieu-a-scene' },
    { id: 'pb', label: 'B', pos: { x: 70, y: 40 }, scene: 'lieu-b-scene' },
  ], routes: [{ id: 'r1', a: 'pa', b: 'pb', km: 12, modes: ['pied'], perilDie: 0, ...rp }] };
}
function setup(wm: WorldMap, party: Combatant[]) {
  useGame.setState({ party, gameTime: CAMPAIGN_START, travelPlan: null, pendingRest: null, pendingCascade: null, travelRecap: null, journal: [] });
  get().loadProject([sceneA(), sceneB()], 'lieu-a-scene', wm);
  useGame.setState({ gameTime: CAMPAIGN_START });
}

/** Déroule la cascade OUVERTE (jour ou nuit) : roule chaque étape-jet puis avance jusqu'à sa clôture. */
function drainCascade(): void {
  let g = 0;
  while (get().pendingCascade && g++ < 200) {
    const p = get().pendingCascade!;
    const cur = p.participants[p.cursor];
    if (cur && cur.target != null && !cur.result) get().cascadeRoll(cur.id);
    else get().cascadeNext();
  }
}
/** Va au bout d'un voyage : draine cascades du jour, dort les haltes, jusqu'à l'arrivée (ou blocage). */
function runToEnd(maxSteps = 60): void {
  for (let i = 0; i < maxSteps; i++) {
    if (get().pendingCascade) { drainCascade(); continue; }
    if (get().pendingRest) { get().restSleep(); drainCascade(); continue; }
    if (!get().travelPlan) return;
  }
}

beforeEach(() => { seedBattleRng(1); });
afterEach(() => { resetRule('travel-etapes'); resetRule('travel-attraper-froid'); });

// ─────────────────────────────────────────────────────────────────────────────────────────────
// (b) INFLUENCE : les jets du JOUR terrestre sont des étapes influençables d'une cascade travelDay.
// ─────────────────────────────────────────────────────────────────────────────────────────────
describe('cascade du JOUR terrestre — les jets d’Étape sont influençables (purpose travelDay)', () => {
  beforeEach(() => setRule('travel-etapes', true));

  it('un héros au poste ouvre une cascade travelDay dont la 1ʳᵉ étape porte un jet influençable', () => {
    seedBattleRng(1);
    const h = hero({ travelRole: 'approvisionnement', items: [], skills: [{ skillId: 'survie-en-exterieur', advances: 40 } as any] });
    setup(map({ km: 12, perilDie: 0 }), [h]);
    get().startTravel('r1', 'pied');
    const pc = get().pendingCascade;
    expect(pc?.purpose).toBe('travelDay'); // le jour ne s'auto-résout plus
    expect(pc!.participants.some((s) => s.kind === 'stagePoste')).toBe(true);
    const cur = pc!.participants[pc!.cursor];
    expect(cur.target).not.toBeNull();
    expect(cur.result ?? null).toBeNull(); // pas encore roulé → influençable
  });

  it('la Résilience force la réussite d’un jet du jour (mécanisme UNIQUE de cascade)', () => {
    seedBattleRng(5); // seed où l'Approvisionnement échoue (parité : 78/70)
    const h = hero({ id: 'h', travelRole: 'approvisionnement', resilience: 2, items: [], skills: [{ skillId: 'survie-en-exterieur', advances: 40 } as any] });
    setup(map({ km: 12, perilDie: 0 }), [h]);
    get().startTravel('r1', 'pied');
    const pc = get().pendingCascade!;
    expect(pc.purpose).toBe('travelDay');
    const cur = pc.participants[pc.cursor];
    expect(cur.target).not.toBeNull();
    get().cascadeForceSuccess(cur.id); // Résilience « Je ne faillirai pas ! »
    const after = get().pendingCascade!.participants[get().pendingCascade!.cursor];
    expect(after.result?.success).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────────────────────
// (a) PARITÉ RNG à graine fixe : la mise en scène en cascade ne change RIEN aux issues RAW.
//     Golden capturés sur l'ancien chemin inline (probe) — cf. rapport de mission.
// ─────────────────────────────────────────────────────────────────────────────────────────────
describe('PARITÉ — issues IDENTIQUES à l’ancien chemin inline (graine égale)', () => {

  it('Approvisionnement seed 1 : fourrage réussi (DR 7), 1 ration reçue', () => {
    setRule('travel-etapes', true);
    seedBattleRng(1);
    const h = hero({ travelRole: 'approvisionnement', items: [], skills: [{ skillId: 'survie-en-exterieur', advances: 40 } as any] });
    setup(map({ km: 12, perilDie: 0 }), [h]);
    get().startTravel('r1', 'pied');
    drainCascade();
    const st = get();
    expect(st.scene?.id).toBe('lieu-b-scene');
    expect((st.party[0].items ?? []).length).toBe(1); // ration trouvée
    const j = st.journal.join('\n');
    expect(j).toContain('Approvisionnement : 1/70 → réussi (DR 7)');
    expect(j).toContain('reçoit une ration trouvée en chemin');
  });

  it('Approvisionnement seed 5 : échec 78/70 → Exténué, 0 ration', () => {
    setRule('travel-etapes', true);
    seedBattleRng(5);
    const h = hero({ travelRole: 'approvisionnement', items: [], skills: [{ skillId: 'survie-en-exterieur', advances: 40 } as any] });
    setup(map({ km: 12, perilDie: 0 }), [h]);
    get().startTravel('r1', 'pied');
    drainCascade();
    const st = get();
    expect((st.party[0].items ?? []).length).toBe(0);
    expect(st.party[0].conditions.some((c) => c.name === 'extenue')).toBe(true);
    expect(st.journal.join('\n')).toContain('Approvisionnement : 78/70 → échec (Exténué)');
  });

  it('Exposition seed 2 : transi → escalade de froid (3 effets exposition-froid, rang 1)', () => {
    setRule('travel-etapes', true); setRule('travel-attraper-froid', true);
    seedBattleRng(2);
    const h = hero({ travelRole: 'recuperer' });
    setup(map({ km: 12, perilDie: 0 }), [h]);
    get().startTravel('r1', 'pied');
    drainCascade();
    const st = get();
    const eff = (st.party[0].activeEffects ?? []).map((e) => e.effectId);
    expect(eff.filter((e) => e === 'exposition-froid').length).toBe(3); // rang 1 : −10 CT/Ag/Dex
    expect(st.journal.join('\n')).toContain("Exposition de fin d'Étape (Pluie) : 33/20 → transi par le froid.");
  });

  it('Péripétie seed 2 : « Voyage éreintant », Survie 29/70 réussie → pas de retard', () => {
    seedBattleRng(2);
    const hh = hero({ items: [ration('r1')], skills: [{ skillId: 'survie-en-exterieur', advances: 20 } as any, { skillId: 'perception', advances: 20 } as any] });
    setup(map({ km: 12, perilDie: 8 }), [hh]);
    get().startTravel('r1', 'pied');
    drainCascade();
    const st = get();
    expect(st.scene?.id).toBe('lieu-b-scene');
    expect(st.party[0].conditions.some((c) => c.name === 'extenue')).toBe(false); // Survie réussie → pas d'Exténué
    const j = st.journal.join('\n');
    expect(j).toContain('Voyage éreintant');
    expect(j).toContain('Survie en extérieur (+20) : 29/70 → un itinéraire de substitution est trouvé.');
  });

  it('Rencontre seed 2 : échec d’Approvisionnement → Rencontre dangereuse (texte verbatim)', () => {
    setRule('travel-etapes', true);
    seedBattleRng(2);
    const h = hero({ travelRole: 'approvisionnement', items: [], skills: [{ skillId: 'survie-en-exterieur', advances: 0 } as any] });
    setup(map({ km: 12, perilDie: 0 }), [h]);
    get().startTravel('r1', 'pied');
    drainCascade();
    expect(get().journal.join('\n')).toContain('Rencontre dangereuse — Territoire hostile');
  });
});

// ─────────────────────────────────────────────────────────────────────────────────────────────
// (c) ENCHAÎNEMENT : jour → halte de nuit → reprise → arrivée.
// ─────────────────────────────────────────────────────────────────────────────────────────────
describe('enchaînement JOUR → halte de nuit → reprise → arrivée', () => {

  it('trajet long (30 km) avec Étapes : le jour ouvre la cascade, sa clôture pose la halte de nuit', () => {
    setRule('travel-etapes', true);
    seedBattleRng(1);
    const h = hero({ travelRole: 'approvisionnement', items: [ration('r1'), ration('r2')], skills: [{ skillId: 'survie-en-exterieur', advances: 40 } as any] });
    setup(map({ km: 30, perilDie: 0 }), [h]);
    get().startTravel('r1', 'pied');
    // Le jour ouvre la cascade travelDay ; sa clôture pose la halte de nuit (30 km > 24 km/jour).
    expect(get().pendingCascade?.purpose).toBe('travelDay');
    drainCascade();
    expect(get().pendingRest).toBeTruthy();
    expect(get().scene?.id).toBe('lieu-a-scene'); // toujours en route
    // Dormir puis reprendre : arrivée.
    runToEnd();
    expect(get().travelPlan).toBeNull();
    expect(get().scene?.id).toBe('lieu-b-scene');
  });

  it('péripétie de combat pendant le jour : le voyage est INTERROMPU (recap.then), pas de halte', () => {
    seedBattleRng(1);
    const h = hero({ items: [ration('r1')] });
    setup(map({ km: 30, perils: [{ label: 'Brigands !', chancePct: 100, effects: [{ type: 'startCombat', encounter: 'enc-test' }] }] }), [h]);
    get().startTravel('r1', 'pied');
    drainCascade();
    const st = get();
    expect(st.battle).toBeNull(); // différé derrière le récit
    expect(st.travelRecap?.then?.kind).toBe('effects');
    expect(st.travelPlan?.interrupted).toBe(true);
    expect(st.pendingRest).toBeFalsy(); // interrompu → pas de halte de nuit
  });
});

/** Nettoyage des règles optionnelles après chaque test (helper local pour éviter la répétition). */
function afterEachRule(): void {
  afterEach(() => { resetRule('travel-etapes'); resetRule('travel-attraper-froid'); });
}

// ─────────────────────────────────────────────────────────────────────────────────────────────
// #270 — Attelage FORCÉ (allure « galop », EDOC 07 l.229) : le Test de Conduite d'attelage au km était
// roulé INLINE (aucune Chance offerte sur un jet répété qui peut se solder en Accident) — gate CONTRÔLEUR :
// conducteur PILOTÉ PAR UN HUMAIN → chaîne d'étapes `landForcedPace` (cascade `travelDay`, UNE cascade,
// pas N modales) ; sinon → chemin synchrone historique (`forcedPaceDay`, inchangé).
// ─────────────────────────────────────────────────────────────────────────────────────────────
describe('#270 — allure forcée (attelage) : gate contrôleur', () => {
  afterEach(() => resetRule('travel-allures'));

  function forcedRoute(km: number): WorldMap {
    return { id: 'c', nom: 'c', places: [
      { id: 'pa', label: 'A', pos: { x: 0, y: 0 }, scene: 'lieu-a-scene' },
      { id: 'pb', label: 'B', pos: { x: 70, y: 0 }, scene: 'lieu-b-scene' },
    ], routes: [{ id: 'r1', a: 'pa', b: 'pb', km, modes: ['diligence', 'pied'], perilDie: 0 }] };
  }

  it('conducteur JOUEUR (humanControlled) → la cascade travelDay s’ouvre sur une étape landForcedPace influençable', () => {
    setRule('travel-allures', true);
    seedBattleRng(1);
    const h = hero({ id: 'h', skills: [{ skillId: 'conduite-d-attelage', advances: 40 } as any] });
    useGame.setState({ party: [h], gameTime: CAMPAIGN_START, travelPlan: null, pendingRest: null, pendingCascade: null, travelRecap: null, journal: [], money: { gold: 500, silver: 0, brass: 0 } as never });
    get().loadProject([sceneA(), sceneB()], 'lieu-a-scene', forcedRoute(20));
    useGame.setState({ gameTime: CAMPAIGN_START });
    get().startTravel('r1', 'diligence', { allure: 'galop' });
    const pc = get().pendingCascade;
    expect(pc?.purpose).toBe('travelDay');
    const first = pc!.participants[0];
    expect(first.kind).toBe('landForcedPace');
    expect(first.interactive).toBe(true);
    expect(first.result ?? null).toBeNull(); // pas encore roulé → influençable (Chance/Résilience)
  });

  it('conducteur SANS pilote humain (aiControlled) → repli inline (aucune étape landForcedPace), même formule', () => {
    setRule('travel-allures', true);
    seedBattleRng(1);
    const h = hero({ id: 'h', aiControlled: true, skills: [{ skillId: 'conduite-d-attelage', advances: 40 } as any] });
    useGame.setState({ party: [h], gameTime: CAMPAIGN_START, travelPlan: null, pendingRest: null, pendingCascade: null, travelRecap: null, journal: [], money: { gold: 500, silver: 0, brass: 0 } as never });
    get().loadProject([sceneA(), sceneB()], 'lieu-a-scene', forcedRoute(20));
    useGame.setState({ gameTime: CAMPAIGN_START });
    get().startTravel('r1', 'diligence', { allure: 'galop' });
    // Résolu par le chemin synchrone historique : soit une cascade travelDay SANS étape landForcedPace
    // (postes/périls du jour, non liés à l'attelage), soit aucune cascade du tout.
    const pc = get().pendingCascade;
    if (pc) expect(pc.participants.some((s) => s.kind === 'landForcedPace')).toBe(false);
    expect(get().journal.join('\n')).toMatch(/Conduite d'attelage \(allure forcée\)/);
  });
});
