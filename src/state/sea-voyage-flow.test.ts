import { describe, it, expect, beforeEach } from 'vitest';
import { useGame } from './store';
import { makePregens } from '../data/pregens';
import {
  buildSeaPlan, resolveVoyageCrewTest, portRepairVessel, portInstallUpgrade, runSeaDays,
  resolvePortArrival, resolveManannPriest,
} from './seaVoyageFlow';
import { seedBattleRng } from './battleRng';
import { subtract } from '../engine/money';
import type { WorldMap } from './worldMap';
import type { RNG } from '../engine/dice';

/**
 * VOYAGE MARITIME (7b) — la traversée jour par jour sur le navire de campagne (MDG ch.13/15) :
 * Tests d'équipage de voyage en MODALES (`pendingCrewTest.voyage`), Blessures de coque persistées
 * sur `CampaignVessel` (#30), services portuaires. L'équipage hors combat = les PJ (MDG 14 l.39).
 */
const get = useGame.getState.bind(useGame);
const set = useGame.setState.bind(useGame);

const seaMap: WorldMap = {
  id: 'm', nom: 'Mer des Griffes',
  places: [
    { id: 'A', label: 'Salzenmund', pos: { x: 0, y: 0 }, scene: 'port-a' },
    { id: 'B', label: 'Erengrad', pos: { x: 10, y: 0 }, scene: 'port-b' },
  ],
  routes: [{ id: 'r1', a: 'A', b: 'B', km: 550, modes: ['mer'], sea: true, seaHeading: 'est' }],
};

function freshState() {
  seedBattleRng(1); // déterminisme (suite isolate:false) : jour 1 navigable → le Test de Progression se joue
  useGame.setState({
    party: makePregens().slice(0, 3),
    scene: { id: 'port-a', nom: 'Port', dimensions: { w: 2, h: 2 }, layers: [{ z: 0, tiles: ['sol', 'sol', 'sol', 'sol'] }], entities: [], dialogues: [], triggers: [] } as never,
    battle: null,
    worldMap: seaMap,
    travelPlan: null,
    travelRecap: null,
    pendingCrewTest: null,
    pendingRest: null,
    gameTime: 8 * 60, // 08:00 jour 0
    lastUpkeepDay: 0,
    vessel: { vehicleId: 'cogue', morale: { score: 75, lastMoraleWeek: 0, factors: [] } },
    journal: [],
  } as never);
}

describe('buildSeaPlan — appareillage sur le navire de campagne', () => {
  beforeEach(freshState);

  it('exige un navire de campagne ; la coque de trajet repart des Blessures PERSISTÉES (#30)', () => {
    set({ vessel: null } as never);
    expect(buildSeaPlan(get, 'r1', 'A', 'B', seaMap.routes[0])).toBeNull();
    freshState();
    set({ vessel: { ...get().vessel!, wounds: { current: 20, max: 50 } } });
    const plan = buildSeaPlan(get, 'r1', 'A', 'B', seaMap.routes[0])!;
    expect(plan.mode).toBe('mer');
    expect(plan.sea!.heading).toBe('est');
    expect(plan.vehicle!.wounds.current).toBe(20); // Blessures de coque persistantes
    expect(plan.sea!.daysToEvent).toBeGreaterThanOrEqual(1);
    expect(plan.sea!.daysToEvent).toBeLessThanOrEqual(10);
  });
});

describe('journée en mer — Tests d’équipage de VOYAGE en modales (#65)', () => {
  beforeEach(freshState);

  it('startTravel(mer) déroule la journée : Progression et Orientation passent par pendingCrewTest ; la nuit = halte de repos', () => {
    const kinds: string[] = [];
    get().startTravel('r1', 'mer');
    // La boucle se suspend sur chaque modale : on roule tous les contributeurs puis on confirme,
    // jusqu'à la halte de nuit (openRest) — garde-fou 30 modales (événements/crises possibles).
    for (let i = 0; i < 30 && !get().pendingRest; i++) {
      const p = get().pendingCrewTest;
      if (!p) break;
      expect(p.voyage).toBeTruthy(); // Test d'équipage de VOYAGE, hors combat
      kinds.push(p.voyage!.kind);
      for (const part of p.participants) if (!part.result) get().crewTestRoll(part.id);
      get().crewTestConfirm();
    }
    expect(kinds).toContain('progression'); // Test quotidien de Progression (MDG 14 l.61, ch.15 l.78)
    expect(kinds).toContain('orientation'); // « un Test par jour de voyage » (MDG ch.13 l.311)
    expect(get().pendingRest).toBeTruthy(); // halte de nuit — machinerie de repos EXISTANTE
    expect(get().travelPlan!.sea!.daysAtSea).toBe(1);
    // La journée de mer s'arrête au CRÉPUSCULE (18:00) : la nuit de sommeil (halte) enjambe minuit —
    // un seul franchissement de jour par cycle jour+nuit (l'entretien s'y résout, après le repas).
    expect(get().gameTime).toBe(18 * 60); // départ 08:00 jour 0 → crépuscule du même jour
  });
});

describe('resolveVoyageCrewTest — issues par type', () => {
  beforeEach(freshState);

  function planWithSea() {
    const plan = buildSeaPlan(get, 'r1', 'A', 'B', seaMap.routes[0])!;
    set({ travelPlan: plan });
    return plan;
  }

  it('entretien : réussite (total − 2 ≥ 1) → réparation temporaire 1d10 Blessures, PERSISTÉE (#30 ; MDG 14 l.122 + ch.13 l.647)', () => {
    const plan = planWithSea();
    plan.vehicle!.wounds.current = 30; // coque endommagée (max 50 : cogue)
    set({ travelPlan: { ...plan, sea: { ...plan.sea!, step: 'nuit' } } });
    const pending = { shipId: plan.vehicle!.id, testTypeId: 'entretien', participants: [], moraleScore: 75, voyage: { kind: 'entretien', shipName: 'Cogue' } };
    resolveVoyageCrewTest(get, set, pending as never, 5); // total +5 → +3 DR après −2 → réussite
    const cur = get().vessel!.wounds!.current;
    expect(cur).toBeGreaterThan(30);
    expect(cur).toBeLessThanOrEqual(40); // +1d10 max
    resolveVoyageCrewTest(get, set, pending as never, 2); // 2 − 2 = 0 → échec (« 1 DR ou plus », MDG 14 l.13)
    expect(get().vessel!.wounds!.current).toBe(cur);
  });

  it('orientation : dérive majeure (DR ≤ −5) → Changement de cap (retard % sur la distance restante)', () => {
    const plan = planWithSea();
    set({ travelPlan: { ...plan, kmDone: 100, sea: { ...plan.sea!, step: 'extermination', lines: [] } } });
    const before = get().travelPlan!.km;
    const pending = { shipId: plan.vehicle!.id, testTypeId: 'orientation', participants: [], moraleScore: 75, voyage: { kind: 'orientation', shipName: 'Cogue' } };
    resolveVoyageCrewTest(get, set, pending as never, -6);
    // Le tableau Changement de cap (d10+2) peut donner « sans conséquence » (1-3 impossible ici : min 3),
    // retard (+10/25 %), 90° ou demi-tour — dans TOUS les cas le voyage continue et km ≥ avant (jamais réduit).
    expect(get().travelPlan!.km).toBeGreaterThanOrEqual(before);
  });
});

describe('progression — message « Encalminé »/« Voiles affalées » piloté par la STRUCTURE (sailsDown / m===null), pas par le libellé FR du vent', () => {
  beforeEach(freshState);

  // Mer calme (calme-plat → cellule `encalmine` sur TOUS les aspects, ch.13 l.276) → eff.m === null,
  // indépendamment de `sailsDown` (posé par un jour de vent violent PRÉCÉDENT, ne dépend pas de la météo courante).
  function planAtProgression(sailsDown: boolean) {
    const plan = buildSeaPlan(get, 'r1', 'A', 'B', seaMap.routes[0])!;
    const sea = { ...plan.sea!, step: 'progression' as const, weather: { ...plan.sea!.weather, vent: 'calme-plat' as const }, sailsDown };
    set({ travelPlan: { ...plan, sea } });
  }

  it('mer calme (eff.m === null), voiles NON affalées → message « Encalminé »', () => {
    planAtProgression(false);
    runSeaDays(get, set);
    const journal = get().journal;
    expect(journal.some((l) => l.includes('Encalminé'))).toBe(true);
    expect(journal.some((l) => l.includes('affalées'))).toBe(false);
  });

  it('voiles affalées (sailsDown), MÊME mer calme → message « Voiles affalées » (la structure prime sur le libellé du vent)', () => {
    planAtProgression(true);
    runSeaDays(get, set);
    const journal = get().journal;
    expect(journal.some((l) => l.includes('affalées'))).toBe(true);
    expect(journal.some((l) => l.includes('Encalminé'))).toBe(false);
  });
});

describe('services portuaires (#30)', () => {
  beforeEach(freshState);

  it('réparation au port : 1 CO par Blessure restaurée (MDG ch.13 l.643), le temps de chantier passe', () => {
    set({ vessel: { ...get().vessel!, wounds: { current: 40, max: 50 } }, money: { gold: 20, silver: 0, brass: 0 } });
    const t0 = get().gameTime;
    const lines = portRepairVessel(get, set);
    expect(lines[0]).toContain('remis à neuf');
    expect(get().vessel!.wounds!.current).toBe(50);
    expect(get().money.gold).toBe(10); // 10 Blessures × 1 CO
    expect(get().gameTime).toBeGreaterThan(t0);
    // Bourse insuffisante → refus.
    set({ vessel: { ...get().vessel!, wounds: { current: 10, max: 50 } }, money: { gold: 3, silver: 0, brass: 0 } });
    expect(portRepairVessel(get, set)[0]).toContain('bourse');
  });

  it('pose d’une Amélioration : coût par bande de Taille (MDG ch.12) — Nid-de-pie sur une cogue (25 m, Moyenne) = 5 CO', () => {
    set({ money: { gold: 10, silver: 0, brass: 0 } });
    const lines = portInstallUpgrade(get, set, 'nid-de-pie');
    expect(lines[0]).toContain('Nid-de-pie');
    expect(get().money.gold).toBe(5);
    expect(get().vessel!.upgrades).toEqual([{ id: 'nid-de-pie' }]);
    // Un Trait de CONSTRUCTION ne se pose pas après coup (ch.12 l.169).
    expect(portInstallUpgrade(get, set, 'renforce')[0]).toContain('Trait de construction');
  });
});

describe('Prêtre de Manann — CHOIX joueur, pas paiement automatique (#132, MDG 15 l.246)', () => {
  beforeEach(freshState);

  const seq = (...vals: number[]): RNG => {
    let i = 0;
    return { int: (min, max) => Math.min(max, Math.max(min, vals[i++ % vals.length])) };
  };

  // Humeur de Manann neutre (mod 0) + 2d10 = 1+1 = 2 → « Prêtre de Manann » (min 2 max 2, sea-events.json).
  // Puis 2d10 = 3+4 (heures, sans effet ici), puis 1d10 = 7 (coût en CO).
  function triggerPriest() {
    resolvePortArrival(get, set, undefined, seq(1, 1, 3, 4, 7));
  }

  it('ouvre un CHOIX (pendingManannPriest) au lieu de payer automatiquement', () => {
    set({ money: { gold: 100, silver: 0, brass: 0 } });
    triggerPriest();
    expect(get().pendingManannPriest).toEqual({ cost: { gold: 7, silver: 25, brass: 0 } }); // 1d10=7 CO + 25 m (cogue) en pistoles
    expect(get().money).toEqual({ gold: 100, silver: 0, brass: 0 }); // pas débité tant que non résolu
    expect(get().vessel!.manann?.score ?? 0).toBe(0); // Humeur inchangée tant que non résolu
  });

  it('choix PAYER : débite le coût déjà tiré, Humeur INCHANGÉE', () => {
    const before = { gold: 100, silver: 0, brass: 0 };
    set({ money: before });
    triggerPriest();
    const cost = get().pendingManannPriest!.cost;
    resolveManannPriest(get, set, true);
    expect(get().pendingManannPriest).toBeNull();
    expect(get().money).toEqual(subtract(before, cost));
    expect(get().vessel!.manann?.score ?? 0).toBe(0);
  });

  it('choix REFUSER : Humeur de Manann réduite de 4d10, bourse INCHANGÉE', () => {
    const before = { gold: 100, silver: 0, brass: 0 };
    set({ money: before });
    triggerPriest();
    seedBattleRng(7); // détermine le 4d10 de resolveManannPriest (battleRng interne)
    resolveManannPriest(get, set, false);
    expect(get().pendingManannPriest).toBeNull();
    expect(get().money).toEqual(before); // pas débité
    const score = get().vessel!.manann!.score;
    expect(score).toBeLessThanOrEqual(-4); // 4d10 : 4 à 40
    expect(score).toBeGreaterThanOrEqual(-40);
  });

  it('choix PAYER avec bourse insuffisante : garde défensive — aucune mutation (l’UI désactive le bouton)', () => {
    set({ money: { gold: 0, silver: 0, brass: 0 } });
    triggerPriest();
    resolveManannPriest(get, set, true);
    expect(get().pendingManannPriest).toBeNull();
    expect(get().money).toEqual({ gold: 0, silver: 0, brass: 0 });
    expect(get().vessel!.manann?.score ?? 0).toBe(0);
  });
});

describe('Port désert & Embrigadement — #150 (resolvePortArrival appelé APRÈS purge de travelPlan)', () => {
  beforeEach(freshState);

  const seq = (...vals: number[]): RNG => {
    let i = 0;
    return { int: (min, max) => Math.min(max, Math.max(min, vals[i++ % vals.length])) };
  };

  it('Port désert (min 5 max 5, sea-events.json) applique bien son delta d’Humeur — ship résolu depuis `vessel`, PAS `travelPlan` (déjà `null` ici, cf. `finishSeaDay`)', () => {
    expect(get().travelPlan).toBeNull(); // reproduit exactement le contexte du bug : plan déjà purgé
    // Humeur de Manann neutre (mod 0) : 2d10 = 2+3 = 5 → « Port désert ». Puis 2d10 = 1+1 (heures, sans
    // effet ici). Puis 1d10 = 6 → delta d'Humeur −6 (MDG 15 l.249 : « le Moral diminue d'1d10 »).
    resolvePortArrival(get, set, undefined, seq(2, 3, 1, 1, 6));
    expect(get().vessel!.morale.score).toBe(75 - 6);
    expect(get().journal.some((l) => l.includes('Moral de l’équipage') || l.includes("Moral de l'équipage"))).toBe(true);
  });

  it('Embrigadement (min 1 max 1) réduit l’effectif d’équipage de 2d10 (MDG 15 l.245)', () => {
    set({ vessel: { ...get().vessel!, manann: { score: -1, applied: [] } } }); // Humeur < 0 → mod −1 (nécessaire : min 1 est hors de portée à mod 0, cf. Prêtre de Manann ci-dessus)
    // roll = d10+d10 + mod(−1) = 1+1−1 = 1 → « Embrigadement ». Hours = 1+1 = 2 (sans effet ici).
    // lostCrew "2d10" = 3+4 = 7 marins perdus (cogue : effectif nominal 15, vehicles.json).
    resolvePortArrival(get, set, undefined, seq(1, 1, 1, 1, 3, 4));
    expect(get().vessel!.crewLost).toBe(7);
    expect(get().journal.some((l) => l.includes('Équipage'))).toBe(true);
  });

  it('Embrigadement : la perte est PLAFONNÉE au complément nominal du type (on ne peut pas perdre plus de marins qu’il n’y en a)', () => {
    set({ vessel: { ...get().vessel!, crewLost: 12, manann: { score: -1, applied: [] } } }); // déjà 12/15 perdus
    resolvePortArrival(get, set, undefined, seq(1, 1, 1, 1, 9, 9)); // lostCrew roulé à 18 → 12+18=30, plafonné à 15
    expect(get().vessel!.crewLost).toBe(15);
  });
});
