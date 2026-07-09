import { describe, it, expect, beforeEach } from 'vitest';
import { useGame } from './store';
import { makePregens } from '../data/pregens';
import {
  buildSeaPlan, resolveVoyageCrewTest, portRepairVessel, portInstallUpgrade, runSeaDays,
  resolvePortArrival, resolveManannPriest, resolveShoreLeave,
} from './seaVoyageFlow';
import { seedBattleRng } from './battleRng';
import { subtract, toBrass, fromBrass } from '../engine/money';
import { itemFromTrappingById } from '../engine/items';
import { bankWithdraw } from './interludeFlow';
import { traumaById } from '../engine/trauma';
import { buildEncounter } from './encounterAuthoring';
import { emptyScene, type Scene } from './scene';
import type { WorldMap } from './worldMap';
import type { RNG } from '../engine/dice';
import type { PendingCrewTest } from './pendings';

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
    { id: 'B', label: 'Erengrad', pos: { x: 10, y: 0 }, scene: 'port-b', port: { taille: 3, richesse: 3, production: ['bois'] } },
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
      if (get().pendingCrewTest?.resolved) get().crewTestContinue(); // dénouement SUR PLACE → « Continuer » relance la boucle
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

describe('Résultat SUR PLACE d’un Test d’équipage de VOYAGE (le jet s’affiche là où il a eu lieu)', () => {
  beforeEach(freshState);

  it('« Appliquer » ne fait PAS avancer le voyage : la MÊME modale passe en phase RÉSOLU (dénouement) ; « Continuer » SEUL relance la boucle', () => {
    get().startTravel('r1', 'mer');
    const p = get().pendingCrewTest;
    expect(p?.voyage).toBeTruthy();
    for (const part of p!.participants) if (!part.result) get().crewTestRoll(part.id);
    const dayBefore = get().travelPlan!.sea!.daysAtSea;

    get().crewTestConfirm();
    // La modale reste ouverte, en phase RÉSOLU, avec son dénouement — le voyage n'a PAS avancé.
    const resolved = get().pendingCrewTest;
    expect(resolved?.resolved?.lines.length).toBeGreaterThan(0); // la conséquence (milles, cap, Moral…) est SUR PLACE
    expect(get().pendingRest).toBeNull();
    expect(get().travelPlan!.sea!.daysAtSea).toBe(dayBefore); // aucune journée franchie tant qu'on n'a pas continué

    // « Continuer » relance la boucle : un nouveau Test s'ouvre (ou la nuit tombe), jamais un re-« Appliquer ».
    get().crewTestContinue();
    expect(get().pendingCrewTest?.resolved).toBeFalsy();
    expect(get().pendingCrewTest || get().pendingRest || get().pendingSeaActivities).toBeTruthy();
  });

  it('« Appliquer » deux fois (double-clic) est idempotent : la phase RÉSOLU ignore un second Appliquer', () => {
    get().startTravel('r1', 'mer');
    const p = get().pendingCrewTest!;
    for (const part of p.participants) if (!part.result) get().crewTestRoll(part.id);
    get().crewTestConfirm();
    const linesAfterFirst = [...get().pendingCrewTest!.resolved!.lines];
    get().crewTestConfirm(); // no-op en phase RÉSOLU (garde `p.resolved`)
    expect(get().pendingCrewTest!.resolved!.lines).toEqual(linesAfterFirst);
  });
});

describe('Carte marine (MDG 15) — Orientation & Planque (#147)', () => {
  beforeEach(freshState);

  function driveDayCaptureOrientation(): number | undefined {
    let extra: number | undefined;
    for (let i = 0; i < 30 && !get().pendingRest; i++) {
      const p = get().pendingCrewTest;
      if (!p) break;
      if (p.voyage?.kind === 'orientation') extra = p.extraDR;
      for (const part of p.participants) if (!part.result) get().crewTestRoll(part.id);
      get().crewTestConfirm();
      if (get().pendingCrewTest?.resolved) get().crewTestContinue(); // dénouement SUR PLACE → « Continuer » relance la boucle
    }
    return extra;
  }

  it('un héros portant une Carte marine → +2 DR au Test d’Orientation quotidien (règle maison sea-chart-orientation-dr)', () => {
    const chart = itemFromTrappingById('carte-marine')!;
    set({ party: get().party.map((h, i) => (i === 0 ? { ...h, items: [...(h.items ?? []), chart] } : h)) } as never);
    get().startTravel('r1', 'mer');
    expect(driveDayCaptureOrientation()).toBe(2); // +2 DR de la carte (défaut de la règle éditable)
  });

  it('sans Carte marine → aucun bonus d’Orientation (extraDR absent)', () => {
    get().startTravel('r1', 'mer');
    expect(driveDayCaptureOrientation()).toBeUndefined();
  });

  it('#214 : un saboteur authoré sur la coque de campagne pèse (−DR) sur les Tests d’équipage de VOYAGE, clampé [-5,0]', () => {
    set({ vessel: { ...get().vessel!, saboteurDR: -3 } });
    get().startTravel('r1', 'mer');
    expect(driveDayCaptureOrientation()).toBe(-3); // MDG 14 l.45-47, cumulable avec le bonus Carte marine

    freshState();
    set({ vessel: { ...get().vessel!, saboteurDR: -9 } }); // hors fourchette RAW → clampé à -5
    get().startTravel('r1', 'mer');
    expect(driveDayCaptureOrientation()).toBe(-5);
  });

  it('Planque (l.292) : sûre tant que le dépositaire GARDE la carte, à découvert si elle est perdue', () => {
    const hero = get().party[0];
    // Stash chartSecured à rate 100 = découverte GARANTIE sans la carte → isole l'effet de la possession.
    const deposit = { heroId: hero.id, kind: 'stash' as const, brass: 1000, rate: 100, chartSecured: true };

    // (a) le héros GARDE la carte → EN SÛRETÉ : le trésor est récupéré malgré rate 100.
    const chart = itemFromTrappingById('carte-marine')!;
    set({ party: get().party.map((h, i) => (i === 0 ? { ...h, items: [chart] } : h)), bank: [deposit], money: fromBrass(0) } as never);
    bankWithdraw(get, set, 0);
    expect(get().bank).toHaveLength(0);
    expect(toBrass(get().money)).toBe(1000); // récupéré

    // (b) la carte est PERDUE (héros sans carte) → même stash → DÉCOUVERT (rien récupéré).
    set({ party: get().party.map((h, i) => (i === 0 ? { ...h, items: [] } : h)), bank: [deposit], money: fromBrass(0) } as never);
    bankWithdraw(get, set, 0);
    expect(get().bank).toHaveLength(0);
    expect(toBrass(get().money)).toBe(0);
  });
});

describe('Phare du port d’arrivée — Test de Perception VISUEL (MDG ch.13 l.337) : la Surdité ne pénalise pas', () => {
  const lighthouseMap: WorldMap = {
    id: 'm2', nom: 'Mer des Griffes',
    places: [
      { id: 'A', label: 'Salzenmund', pos: { x: 0, y: 0 }, scene: 'port-a' },
      { id: 'B', label: 'Erengrad', pos: { x: 10, y: 0 }, scene: 'port-b', port: { taille: 3, richesse: 3, production: [], lighthouse: true } as never },
    ],
    routes: [{ id: 'r1', a: 'A', b: 'B', km: 1, modes: ['mer'], sea: true, seaHeading: 'est' }],
  };

  function freshLighthouseState() {
    seedBattleRng(1);
    const [a, b] = makePregens();
    const vigie = { ...a, skills: [{ skillId: 'perception', characteristic: 'I', advances: 0 }], traumas: [traumaById('surdite', undefined, 'tete')] };
    const timonier = { ...b, skills: [{ skillId: 'voile', characteristic: 'Dex', advances: 30 }], traumas: [] };
    useGame.setState({
      party: [vigie, timonier],
      scene: { id: 'port-a', nom: 'Port', dimensions: { w: 2, h: 2 }, layers: [{ z: 0, tiles: ['sol', 'sol', 'sol', 'sol'] }], entities: [], dialogues: [], triggers: [] } as never,
      battle: null,
      worldMap: lighthouseMap,
      travelPlan: null,
      travelRecap: null,
      pendingCrewTest: null,
      pendingRest: null,
      gameTime: 8 * 60,
      lastUpkeepDay: 0,
      vessel: { vehicleId: 'cogue', morale: { score: 75, lastMoraleWeek: 0, factors: [] } },
      journal: [],
    } as never);
  }

  it('la Vigie SOURDE n’est PAS pénalisée au Test de Perception du phare (sense "vue" posé par kind "phare")', () => {
    freshLighthouseState();
    useGame.getState().startTravel('r1', 'mer');
    let phare: PendingCrewTest | undefined;
    let progression: PendingCrewTest | undefined;
    for (let i = 0; i < 30 && !phare; i++) {
      const p = useGame.getState().pendingCrewTest;
      if (!p) break;
      if (p.voyage?.kind === 'phare') { phare = p; break; }
      if (p.voyage?.kind === 'progression') progression = p;
      for (const part of p.participants) if (!part.result) useGame.getState().crewTestRoll(part.id);
      useGame.getState().crewTestConfirm();
      if (useGame.getState().pendingCrewTest?.resolved) useGame.getState().crewTestContinue();
    }
    expect(phare).toBeTruthy(); // la modale du phare a bien été atteinte (port à phare, km 1 → dans la portée dès le jour 1)
    // Le sens est posé pour TOUT le Test (kind 'phare' = Perception visuelle), pas juste pour la Vigie —
    // n'importe quel contributeur (Timonier compris) « voit » la lumière.
    for (const part of phare!.participants) expect(part.sense).toBe('vue');
    const vigiePart = phare!.participants.find((x) => x.roleId === 'vigie');
    expect(vigiePart).toBeTruthy();
    // Autre Test d'équipage (Progression, sans sens narratif dédié) : PAS de sens posé — comportement historique.
    expect(progression).toBeTruthy();
    for (const part of progression!.participants) expect(part.sense).toBeUndefined();
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

describe('Embuscade maritime AUTHORÉE à ancrage déterministe — #212', () => {
  const abordageMap: WorldMap = {
    id: 'm', nom: 'Mer des Griffes',
    places: [
      { id: 'A', label: 'Salzenmund', pos: { x: 0, y: 0 }, scene: 'port-a' },
      { id: 'B', label: 'Erengrad', pos: { x: 10, y: 0 }, scene: 'port-b', port: { taille: 3, richesse: 3, production: ['bois'] } },
    ],
    routes: [{ id: 'r1', a: 'A', b: 'B', km: 550, modes: ['mer'], sea: true, seaHeading: 'est', ambush: { scene: 'ls-abordage', encounter: 'enc-abordage', at: 0.5 } }],
  };

  function portScene(id: string, nom: string): Scene {
    const s = emptyScene(2, 2); s.id = id; s.nom = nom; return s;
  }
  function abordageScene(): Scene {
    const s = emptyScene(10, 10); s.id = 'ls-abordage'; s.nom = 'Abordage';
    const enc = buildEncounter({ id: 'enc-abordage', enemies: [{ statblock: { name: 'Écumeur', char: { CC: 30, F: 30, E: 30, I: 30, Ag: 30, B: 8 } }, pos: { x: 5, y: 5 } }] });
    s.entities.push(...enc.entities); s.encounters = [enc.encounter];
    return s;
  }
  function freshAmbush(worldMap: WorldMap = abordageMap) {
    seedBattleRng(1); // RNG semé : le jour joué directement à l'étape 'embuscade' ne tire AUCUN événement de bord
    useGame.setState({
      party: makePregens().slice(0, 3), battle: null, travelPlan: null, travelRecap: null,
      pendingCrewTest: null, pendingRest: null, gameTime: 8 * 60, lastUpkeepDay: 0,
      vessel: { vehicleId: 'cogue', morale: { score: 75, lastMoraleWeek: 0, factors: [] } }, journal: [],
    } as never);
    useGame.getState().loadProject([portScene('port-a', 'Port A'), portScene('port-b', 'Port B'), abordageScene()], 'port-a', worldMap);
    useGame.setState({ vessel: { vehicleId: 'cogue', morale: { score: 75, lastMoraleWeek: 0, factors: [] } } } as never); // startScene remet le vessel de campagne — repose-le
  }

  it('franchissement de l’ancrage (kmDone ≥ at × km) → Test d’équipage de Perception PUIS abordage, une seule fois', () => {
    freshAmbush();
    const plan = buildSeaPlan(get, 'r1', 'A', 'B', abordageMap.routes[0])!;
    // Ancrage = 0.5 × 550 = 275 milles ; 270 (fait) + 20 (jour) = 290 → franchi.
    set({ travelPlan: { ...plan, kmDone: 270, sea: { ...plan.sea!, step: 'embuscade', milesToday: 20 } } });
    runSeaDays(get, set);
    const p = get().pendingCrewTest;
    expect(p?.voyage?.kind).toBe('embuscade'); // Test de Perception influençable (patron terrestre « Attaqués ! »)
    for (const part of p!.participants) if (!part.result) get().crewTestRoll(part.id);
    get().crewTestConfirm();
    expect(get().travelPlan!.sea!.ambushFired).toBe(true);
    expect(get().travelPlan!.interrupted).toBe(true);
    expect(get().battle).toBeTruthy(); // abordage ouvert par la couture partagée
    expect(get().scene!.id).toBe('ls-abordage');
  });

  it('poursuite RNG perdue → abordage ouvert par la MÊME couture ; le franchissement ultérieur ne le rejoue pas (anti-double-feu #212)', () => {
    freshAmbush();
    const plan = buildSeaPlan(get, 'r1', 'A', 'B', abordageMap.routes[0])!;
    // Poursuite à Distance très négative → rattrapé quel que soit le jet (startChaseBoarding).
    set({ travelPlan: { ...plan, kmDone: 100, sea: { ...plan.sea!, step: 'crise', crisis: { kind: 'poursuite', label: 'Écumeur', distance: -100, escapeAt: 100, foeM: 3, foeSkill: 30, desc: '' } } } });
    const pending = { shipId: plan.vehicle!.id, testTypeId: 'progression-poursuite', participants: [], moraleScore: 75, voyage: { kind: 'poursuite', shipName: 'Cogue' } };
    resolveVoyageCrewTest(get, set, pending as never, 0);
    expect(get().travelPlan!.sea!.ambushFired).toBe(true);
    expect(get().battle).toBeTruthy();
    expect(get().scene!.id).toBe('ls-abordage');
    // On rejoue jusqu’au franchissement de l’ancrage : l’embuscade NE se rouvre PAS (flag sur travelPlan.sea).
    set({ battle: null, travelPlan: { ...get().travelPlan!, interrupted: false, kmDone: 270, sea: { ...get().travelPlan!.sea!, step: 'embuscade', milesToday: 20 } } });
    runSeaDays(get, set);
    expect(get().pendingCrewTest?.voyage?.kind).not.toBe('embuscade');
    expect(get().battle).toBeNull();
  });

  it('route sans `at` → ancrage par défaut à mi-route (0.5 × km)', () => {
    const midMap: WorldMap = { ...abordageMap, routes: [{ ...abordageMap.routes[0], ambush: { scene: 'ls-abordage', encounter: 'enc-abordage' } }] };
    freshAmbush(midMap);
    const plan = buildSeaPlan(get, 'r1', 'A', 'B', midMap.routes[0])!;
    // Juste AVANT la mi-route (275) : 260 + 10 = 270 → pas encore.
    set({ travelPlan: { ...plan, kmDone: 260, sea: { ...plan.sea!, step: 'embuscade', milesToday: 10 } } });
    runSeaDays(get, set);
    expect(get().travelPlan?.sea?.ambushFired).toBeFalsy();
    expect(get().pendingCrewTest?.voyage?.kind).not.toBe('embuscade');
    // AU franchissement de la mi-route (274 + 2 = 276 ≥ 275) → embuscade.
    freshAmbush(midMap);
    const plan2 = buildSeaPlan(get, 'r1', 'A', 'B', midMap.routes[0])!;
    set({ travelPlan: { ...plan2, kmDone: 274, sea: { ...plan2.sea!, step: 'embuscade', milesToday: 2 } } });
    runSeaDays(get, set);
    expect(get().pendingCrewTest?.voyage?.kind).toBe('embuscade');
  });

  it('route SANS embuscade authorée → le franchissement ne déclenche rien', () => {
    const noAmbush: WorldMap = { ...abordageMap, routes: [{ ...abordageMap.routes[0], ambush: undefined }] };
    freshAmbush(noAmbush);
    const plan = buildSeaPlan(get, 'r1', 'A', 'B', noAmbush.routes[0])!;
    set({ travelPlan: { ...plan, kmDone: 270, sea: { ...plan.sea!, step: 'embuscade', milesToday: 20 } } });
    runSeaDays(get, set);
    expect(get().travelPlan?.sea?.ambushFired).toBeFalsy();
    expect(get().pendingCrewTest?.voyage?.kind).not.toBe('embuscade');
    expect(get().battle).toBeNull();
  });
});

describe('Périls d’AUTEUR lus au fil des jours en mer — C.22 (route.perils)', () => {
  beforeEach(freshState);

  it('un `route.perils` à 100 % se déclenche CHAQUE jour de mer (patron terrestre), en plus de l’ambush ANCRÉE', () => {
    const perilMap: WorldMap = {
      ...seaMap,
      routes: [{ ...seaMap.routes[0], perils: [{ label: 'Récif affleurant', chancePct: 100, effects: [{ type: 'journal', text: 'La coque frôle un récif.' }] }] }],
    };
    set({ worldMap: perilMap } as never);
    get().startTravel('r1', 'mer');
    // On déroule la 1ʳᵉ journée jusqu’à la halte : le péril d’auteur DOIT avoir été lu (journal).
    for (let i = 0; i < 30 && !get().pendingRest; i++) {
      const p = get().pendingCrewTest;
      if (!p) break;
      for (const part of p.participants) if (!part.result) get().crewTestRoll(part.id);
      get().crewTestConfirm();
      if (get().pendingCrewTest?.resolved) get().crewTestContinue();
    }
    expect(get().journal.some((l) => l.includes('Péripétie : Récif affleurant'))).toBe(true);
  });

  it('un péril d’auteur `startCombat` INTERROMPT la traversée (comme l’embuscade)', () => {
    const krakenScene = emptyScene(10, 10); krakenScene.id = 'port-a'; krakenScene.nom = 'Mer';
    const enc = buildEncounter({ id: 'enc-kraken', enemies: [{ statblock: { name: 'Kraken', char: { CC: 30, F: 30, E: 30, I: 30, Ag: 30, B: 8 } }, pos: { x: 5, y: 5 } }] });
    krakenScene.entities.push(...enc.entities); krakenScene.encounters = [enc.encounter];
    const combatPeril: WorldMap = {
      ...seaMap,
      routes: [{ ...seaMap.routes[0], perils: [{ label: 'Kraken', chancePct: 100, effects: [{ type: 'startCombat', encounter: 'enc-kraken' }] }] }],
    };
    set({ scene: krakenScene as never, worldMap: combatPeril } as never);
    const plan = buildSeaPlan(get, 'r1', 'A', 'B', combatPeril.routes[0])!;
    set({ travelPlan: { ...plan, sea: { ...plan.sea!, step: 'perils' } } } as never);
    runSeaDays(get, set);
    expect(get().travelPlan!.interrupted).toBe(true); // la traversée s’arrête sur le combat d’auteur
    expect(get().battle).toBeTruthy();
    expect(get().journal.some((l) => l.includes('Péripétie : Kraken'))).toBe(true);
  });
});

describe('Traversée RAPIDE — un seul Test de Rude épreuve (MDG 15 l.21-37, C.16)', () => {
  beforeEach(freshState);

  function driveFast(): void {
    const p = get().pendingCrewTest;
    expect(p?.voyage?.kind).toBe('voyage-rapide'); // l’UNIQUE Test canonique (modale existante)
    for (const part of p!.participants) if (!part.result) get().crewTestRoll(part.id);
    get().crewTestConfirm();
    expect(get().pendingCrewTest?.resolved).toBeTruthy(); // le palier s’affiche SUR PLACE
    get().crewTestContinue(); // « Continuer » finalise (jours écoulés + accostage)
  }

  it('appareille en UN Test, franchit les jours et accoste (pendingShoreLeave) sans dérouler la boucle jour par jour', () => {
    set({ vessel: { ...get().vessel!, waterLitres: 1000 } });
    const t0 = get().gameTime;
    get().startTravel('r1', 'mer', { fast: true });
    driveFast();
    expect(get().travelPlan).toBeNull(); // arrivée
    expect(get().pendingShoreLeave).toBeTruthy(); // événement de port (port B a un profil)
    expect(get().vessel!.lastVoyageMilles).toBe(550);
    // 550 milles / (18×5) = ~7 jours → l’horloge a franchi ~7 jours (couture unique advanceTime).
    expect(get().gameTime - t0).toBe(7 * 24 * 60);
    expect(get().vessel!.waterLitres).toBeLessThan(1000); // eau des tonneaux consommée (comme le détaillé)
  });

  it('palier DÉSASTREUX (Humeur de Manann effondrée) : équipage manquant, cargaison perdue, coque meurtrie, 3 Critiques', () => {
    set({ vessel: {
      ...get().vessel!, manann: { score: -1000, applied: [] }, // dizaine −100 → résultat ≤ 0 quel que soit le d10/DR
      wounds: { current: 50, max: 50 }, cargo: [{ cargoId: 'bois', enc: 100, basePriceGold: 1 }], criticals: [],
    } });
    get().startTravel('r1', 'mer', { fast: true });
    driveFast();
    const v = get().vessel!;
    expect(v.crewLost).toBe(8); // 50 % de 15 PNJ (round 7,5) — couture partagée applyVesselCrewLoss
    expect(v.cargo![0].enc).toBe(25); // −75 % (floor 100×0,25)
    expect(v.wounds!.current).toBe(12); // 50 − round(50×0,75)=38
    expect(v.criticals!.length).toBe(3); // 3 Coups Critiques (l.33)
  });

  it('palier PARFAIT (Humeur de Manann au zénith) : aucune conséquence négative', () => {
    set({ vessel: {
      ...get().vessel!, manann: { score: 1000, applied: [] }, // dizaine +100 → résultat ≥ 10 → Voyage parfait
      wounds: { current: 50, max: 50 }, cargo: [{ cargoId: 'bois', enc: 100, basePriceGold: 1 }], criticals: [],
    } });
    get().startTravel('r1', 'mer', { fast: true });
    driveFast();
    const v = get().vessel!;
    expect(v.crewLost ?? 0).toBe(0);
    expect(v.cargo![0].enc).toBe(100);
    expect(v.wounds!.current).toBe(50);
    expect(v.criticals!.length).toBe(0);
  });
});

describe('Traversée rapide × embuscade ANCRÉE (#212) : interruption puis reprise en rapide', () => {
  const abordageMap: WorldMap = {
    id: 'm', nom: 'Mer des Griffes',
    places: [
      { id: 'A', label: 'Salzenmund', pos: { x: 0, y: 0 }, scene: 'port-a' },
      { id: 'B', label: 'Erengrad', pos: { x: 10, y: 0 }, scene: 'port-b', port: { taille: 3, richesse: 3, production: ['bois'] } },
    ],
    routes: [{ id: 'r1', a: 'A', b: 'B', km: 550, modes: ['mer'], sea: true, seaHeading: 'est', ambush: { scene: 'ls-abordage', encounter: 'enc-abordage', at: 0.5 } }],
  };
  function portScene(id: string, nom: string): Scene { const s = emptyScene(2, 2); s.id = id; s.nom = nom; return s; }
  function abordageScene(): Scene {
    const s = emptyScene(10, 10); s.id = 'ls-abordage'; s.nom = 'Abordage';
    const enc = buildEncounter({ id: 'enc-abordage', enemies: [{ statblock: { name: 'Écumeur', char: { CC: 30, F: 30, E: 30, I: 30, Ag: 30, B: 8 } }, pos: { x: 5, y: 5 } }] });
    s.entities.push(...enc.entities); s.encounters = [enc.encounter];
    return s;
  }
  beforeEach(() => {
    seedBattleRng(1);
    useGame.setState({
      party: makePregens().slice(0, 3), battle: null, travelPlan: null, travelRecap: null,
      pendingCrewTest: null, pendingRest: null, gameTime: 8 * 60, lastUpkeepDay: 0,
      vessel: { vehicleId: 'cogue', morale: { score: 75, lastMoraleWeek: 0, factors: [] } }, journal: [],
    } as never);
    useGame.getState().loadProject([portScene('port-a', 'Port A'), portScene('port-b', 'Port B'), abordageScene()], 'port-a', abordageMap);
    useGame.setState({ vessel: { vehicleId: 'cogue', morale: { score: 75, lastMoraleWeek: 0, factors: [] } } } as never);
  });

  it('l’abordage ancré INTERROMPT le voyage rapide ; après le combat, la traversée se finit en rapide', () => {
    get().startTravel('r1', 'mer', { fast: true });
    const p = get().pendingCrewTest!;
    for (const part of p.participants) if (!part.result) get().crewTestRoll(part.id);
    get().crewTestConfirm();
    get().crewTestContinue(); // finalize → embuscade ancrée
    expect(get().battle).toBeTruthy(); // abordage ouvert par la couture partagée (#212)
    expect(get().scene!.id).toBe('ls-abordage');
    expect(get().travelPlan!.sea!.ambushFired).toBe(true);
    expect(get().travelPlan!.interrupted).toBe(true);
    expect(get().travelPlan!.sea!.fast!.pendingFinalize).toBe(true); // le palier reste à appliquer
    // Combat gagné → reprise : la traversée s’achève en rapide (arrivée), sans rejouer l’embuscade.
    set({ battle: null });
    get().resumeTravel();
    expect(get().travelPlan).toBeNull(); // accosté
    expect(get().pendingShoreLeave).toBeTruthy();
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

describe('Relâche à terre — #185 (choix joueur AVANT événement de port, MDG 15 l.245 : « Si vous avez refusé la permission de faire relâche à terre à votre équipage, cet événement [Embrigadement] n\'a pas lieu »)', () => {
  beforeEach(freshState);

  const seq = (...vals: number[]): RNG => {
    let i = 0;
    return { int: (min, max) => Math.min(max, Math.max(min, vals[i++ % vals.length])) };
  };

  function moodMinus1() {
    set({ vessel: { ...get().vessel!, manann: { score: -1, applied: [] } } }); // mod −1 → roll min 1 atteignable (Embrigadement)
  }

  it('relâche REFUSÉE : Embrigadement (2d10 → 1) n\'a pas lieu — aucune perte d\'équipage, journal explicite', () => {
    moodMinus1();
    resolvePortArrival(get, set, undefined, seq(1, 1, 1, 1, 3, 4), false);
    expect(get().vessel!.crewLost ?? 0).toBe(0);
    expect(get().journal.some((l) => l.includes('n\'a pas lieu'))).toBe(true);
  });

  it('relâche ACCORDÉE (défaut) : Embrigadement se produit normalement (2d10 marins perdus)', () => {
    moodMinus1();
    resolvePortArrival(get, set, undefined, seq(1, 1, 1, 1, 3, 4), true);
    expect(get().vessel!.crewLost).toBe(7); // 3+4
  });

  it('relâche REFUSÉE : Fête de Manann (2d10 → 18) perd son bonus d\'Humeur (MDG 15 l.260)', () => {
    // Humeur neutre (mod 0) : 2d10 = 9+9 = 18 → « Fête de Manann » (min 18 max 18, sea-events.json).
    resolvePortArrival(get, set, undefined, seq(9, 9, 1, 1), false);
    expect(get().vessel!.manann?.score ?? 0).toBe(0);
    expect(get().journal.some((l) => l.includes('ne se joint pas aux festivités'))).toBe(true);
  });

  it('relâche ACCORDÉE : Fête de Manann applique bien son bonus d\'Humeur (2d10)', () => {
    resolvePortArrival(get, set, undefined, seq(9, 9, 1, 1, 5, 5), true);
    expect(get().vessel!.manann?.score ?? 0).toBe(10); // 5+5
  });

  it('accostage RÉEL (runSeaDays) : pendingShoreLeave s\'ouvre AVANT tout tirage d\'événement de port', () => {
    const plan = buildSeaPlan(get, 'r1', 'A', 'B', seaMap.routes[0])!;
    set({ travelPlan: { ...plan, kmDone: plan.km - 5, sea: { ...plan.sea!, step: 'nuit', milesToday: 5 } } });
    runSeaDays(get, set);
    expect(get().pendingShoreLeave).toBeTruthy();
    expect(get().pendingShoreLeave!.to.id).toBe('B');
    expect(get().journal.some((l) => l.includes('Événement de port'))).toBe(false); // pas encore tiré
    resolveShoreLeave(get, set, true);
    expect(get().pendingShoreLeave).toBeNull();
    expect(get().journal.some((l) => l.includes('Événement de port'))).toBe(true); // tiré APRÈS le choix
  });
});
