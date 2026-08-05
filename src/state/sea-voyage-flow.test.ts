import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { useGame } from './store';
import { makePregens } from '../data/pregens';
import {
  buildSeaPlan, portRepairVessel, portInstallUpgrade, runSeaDay, continueSeaDayAfterCascade,
  resolvePortArrival, resolveManannPriest, resolveShoreLeave, damageVesselHull, healVesselHull,
  buildOverspeedSteps,
} from './seaVoyageFlow';
import { seedBattleRng } from './battleRng';
import { DIFFICULTY_MODIFIERS } from '../engine/types';
import { subtract, toBrass } from '../engine/money';
import { partyMoneyTotal, bourseOf, creditBourse } from './bourseFlow';
import { itemFromTrappingById } from '../engine/items';
import { bankWithdraw } from './interludeFlow';
import { traumaById } from '../engine/trauma';
import { buildEncounter } from './encounterAuthoring';
import { emptyScene, type Scene } from './scene';
import type { WorldMap } from './worldMap';
import type { RNG } from '../engine/dice';
import type { CascadeStep } from './pendings';
import { resumeTravel } from './travelFlow';
import { applyEffects } from './combatEffects';
import { cascadeAppliers } from './cascade';
import { crewRoleValue } from '../engine/crewMorale';
import { findCrewRoleById } from '../data';
import { resultLine } from './rollSeam';
import { voyageTiles, vesselHullGauge } from '../ui/VoyageScreen';
import { checkBattleOver } from './combatFlow';
import { BOARD_EVENTS, seaBoardEventById } from '../engine/seaVoyage';
import type { RecapEvent } from './recapLine';
import { SEA_HAZARDS, findSeaHazard } from '../engine/seaPerils';
import { overspeedRow } from '../engine/seaNavigation';
import { setRule, resetRule } from '../engine/policy';
import { contractDisease } from '../engine/disease';
import { makeRNG } from '../engine/dice';

/**
 * VOYAGE MARITIME (7b) — la traversée jour par jour sur le navire de campagne (MDG 13/15), pilotée
 * par le pipeline CASCADE (#275 Ronde 2 cran 3) : un jour = `pendingCascade` `purpose:'travelDay'`,
 * Blessures de coque persistées sur `CampaignVessel` (#30), services portuaires. L'équipage hors
 * combat = les PJ (MDG 14 l.39). `pendingCrewTest` ne sert plus qu'au combat (`crewTestModal` seul).
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
    pendingCascade: null,
    suspendedCascades: [],
    gameTime: 8 * 60, // 08:00 jour 0
    lastUpkeepDay: 0,
    vessel: { vehicleId: 'cogue', morale: { score: 75, lastMoraleWeek: 0, factors: [] } },
    journal: [],
  } as never);
}

/** Fait avancer LA cascade active d'UNE étape (lance ses jets — mono ou batch — puis valide). No-op si
 *  aucune cascade active. */
function stepCascade(): void {
  const p = get().pendingCascade;
  if (!p) return;
  const cur = p.participants[p.cursor];
  // Étape de CHOIX (Progression : équipage ou Navigation, MDG 14 l.63) : le pilote de test répond
  // comme le joueur par défaut — jamais de saut silencieux, une cascade ne franchit pas un choix seule.
  if (cur?.options && !cur.chosen) get().cascadeChoose(cur.id, cur.defaultChoice ?? cur.options[0].key);
  else if (cur?.participants) { for (const part of cur.participants) if (!part.result) get().cascadeBatchRoll(part.id); }
  else if (cur && !cur.result) get().cascadeRoll(cur.id);
  get().cascadeNext();
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

  it('jette sans défaut silencieux si la route mer n\'a pas de seaHeading (#416, pit #408)', () => {
    expect(() => buildSeaPlan(get, 'r1', 'A', 'B', { km: 550 })).toThrow(/seaHeading/);
  });
});

describe('#296 — state.vessel SOURCE UNIQUE de la coque de trajet (non-divergence)', () => {
  beforeEach(freshState);

  it('un Dégât de coque en cours de traversée se lit IDENTIQUEMENT sur vessel (damageVesselHull)', () => {
    const plan = buildSeaPlan(get, 'r1', 'A', 'B', seaMap.routes[0])!;
    set({ travelPlan: plan });
    damageVesselHull(get, set, get().travelPlan!.vehicle!, 8);
    expect(get().vessel!.wounds!.current).toBe(get().travelPlan!.vehicle!.wounds.current);
    expect(get().vessel!.wounds!.current).toBe(plan.vehicle!.wounds.max - 8);
    healVesselHull(get, set, get().travelPlan!.vehicle!, 3);
    expect(get().vessel!.wounds!.current).toBe(get().travelPlan!.vehicle!.wounds.current);
    expect(get().vessel!.wounds!.current).toBe(plan.vehicle!.wounds.max - 5);
  });

  it('reprise après une interruption (combat naval) : la coque de trajet, périmée, est RECHARGÉE depuis vessel.wounds — la reprise n’écrase plus le writeback du combat', () => {
    const plan = buildSeaPlan(get, 'r1', 'A', 'B', seaMap.routes[0])!;
    set({ travelPlan: { ...plan, interrupted: true } }); // voyage interrompu, coque de trajet = état D'AVANT combat
    const intactMax = plan.vehicle!.wounds.max;
    // `finalizeBattle` (combatFlow.ts) a déjà écrit la fin du combat naval sur `vessel.wounds` — la copie
    // de travail embarquée dans `travelPlan.vehicle` n'a pas bougé (objet distinct de la coque de bataille).
    set({ vessel: { ...get().vessel!, wounds: { current: intactMax - 15, max: intactMax } } });
    expect(get().travelPlan!.vehicle!.wounds.current).not.toBe(intactMax - 15); // toujours périmée avant la reprise
    resumeTravel(get, set);
    // Le rechargement a eu lieu AVANT que `runSeaDay` ne reprenne — aucun Dégât ultérieur ne peut avoir
    // déjà écrasé vessel avec l'ancienne valeur (c'était le bug caché du #296).
    expect(get().vessel!.wounds!.current).toBe(intactMax - 15);
  });

  it('#308 — effet adjustVessel (valeur ABSOLUE d\'auteur) pendant une traversée active : travelPlan.vehicle et vessel restent d\'accord', () => {
    const plan = buildSeaPlan(get, 'r1', 'A', 'B', seaMap.routes[0])!;
    set({ travelPlan: plan });
    applyEffects(get, set, [{ type: 'adjustVessel', hullCurrent: 12, hullMax: plan.vehicle!.wounds.max }]);
    expect(get().vessel!.wounds!.current).toBe(12);
    expect(get().travelPlan!.vehicle!.wounds.current).toBe(12);
  });

  it('la journée close ne porte que le DELTA de coque ; la jauge de l’écran de traversée et la tuile de voyage lisent la MÊME source vive après un soin', () => {
    get().startTravel('r1', 'mer');
    const hull0 = get().travelPlan!.vehicle!.wounds.current;
    damageVesselHull(get, set, get().travelPlan!.vehicle!, 10);
    for (let i = 0; i < 30 && !get().pendingRest; i++) {
      if (!get().pendingCascade) break;
      stepCascade();
    }
    const day = get().pendingRest!.travelDay!;
    expect(day.sea!.hullDelta).toBe(-10); // ce que la journée a coûté à la coque
    // Réparation APRÈS la clôture : la surface vive suit, et la chronique du jour clos garde son delta.
    healVesselHull(get, set, get().travelPlan!.vehicle!, 10);
    const gauge = vesselHullGauge(get().vessel!)!;
    const tile = voyageTiles('mer', get().travelPlan!, get().vessel!, get().party, [], get().gameTime).find((t) => t.key === 'coque')!;
    expect(gauge.current).toBe(hull0);
    expect(tile.value).toBe(`${hull0} / ${gauge.max}`);
    expect(gauge.current).toBe(get().vessel!.wounds!.current);
    expect(day.sea!.hullDelta).toBe(-10);
  });
});

describe('journée en mer — la journée est UNE cascade `purpose:travelDay` (#275 Ronde 2 cran 3)', () => {
  beforeEach(freshState);

  it('startTravel(mer) déroule la journée : Progression et Orientation sont des étapes de la cascade ; la nuit = halte de repos', () => {
    const kinds: string[] = [];
    get().startTravel('r1', 'mer');
    // La cascade se déroule étape par étape — garde-fou 30 pas (événements/crises possibles).
    for (let i = 0; i < 30 && !get().pendingRest; i++) {
      const p = get().pendingCascade;
      if (!p) break;
      const cur = p.participants[p.cursor];
      if (cur) kinds.push(cur.kind);
      stepCascade();
    }
    expect(kinds).toContain('progression'); // Test quotidien de Progression (MDG 14 l.61, ch.15 l.78)
    expect(kinds).toContain('orientation'); // « un Test par jour de voyage » (MDG 13 l.311)
    expect(get().pendingRest).toBeTruthy(); // halte de nuit — machinerie de repos EXISTANTE
    expect(get().travelPlan!.sea!.daysAtSea).toBe(1);
    // La journée de mer s'arrête au CRÉPUSCULE (18:00) : la nuit de sommeil (halte) enjambe minuit —
    // un seul franchissement de jour par cycle jour+nuit (l'entretien s'y résout, après le repas).
    expect(get().gameTime).toBe(18 * 60); // départ 08:00 jour 0 → crépuscule du même jour
  });
});

/**
 * SEUIL DE SUCCÈS d'un Test d'équipage résolu PAR CASCADE (#1019) — MDG 14 l.13. La machinerie de batch
 * (`cascade.ts`) est sous quarantaine d'import naval (#328) : le flux propriétaire lui INJECTE son
 * prédicat (`registerCascadeSuccessRule('crew-test', crewTestSuccess)`), l'étape ne portant que l'id.
 * Sans cette injection, une étape de voyage retomberait sur le seuil générique et IGNORERAIT la règle
 * optionnelle `crew-test-zero-success`.
 */
describe('Test d’équipage par CASCADE — seuil de succès injecté par le flux naval (MDG 14 l.13, #1019)', () => {
  beforeEach(freshState);
  afterEach(() => resetRule('crew-test-zero-success'));

  /** Avance la journée jusqu'à l'étape d'équipage `kind` (non encore jouée), et la rend. */
  function driveToCrewStep(kind: string): CascadeStep | undefined {
    for (let i = 0; i < 30 && !get().pendingRest; i++) {
      const p = get().pendingCascade;
      if (!p) break;
      const cur = p.participants[p.cursor];
      if (cur?.kind === kind) return cur;
      stepCascade();
    }
    return undefined;
  }

  /** Joue la journée jusqu'à l'étape `progression`, FORCE un total d'équipage de 0 DR (chaque
   *  contributeur à 0), valide, et rend le `result` agrégé de l'étape committée. */
  function crewStepAtZero(): { sl: number; success: boolean } {
    get().startTravel('r1', 'mer');
    const step = driveToCrewStep('progression');
    expect(step).toBeTruthy();
    expect(step!.meta?.aggregateSuccessRule).toBe('crew-test'); // le flux naval verse SON id de règle
    expect(Number(step!.meta?.aggregateFlatDR ?? 0)).toBe(0); // Moral 75, sans saboteur ni trait → total = Σ des DR
    const p = get().pendingCascade!;
    const zeroed = p.participants.map((s, i) => (i !== p.cursor ? s : {
      ...s, participants: s.participants!.map((part) => ({ ...part, result: { roll: 40, target: 40, sl: 0, success: true } })),
    }));
    set({ pendingCascade: { ...p, participants: zeroed } });
    get().cascadeNext(); // agrège via `aggregateBatchStep` → prédicat de succès du registre
    const committed = get().pendingCascade?.participants.find((s) => s.kind === 'progression') ?? zeroed[p.cursor];
    return { sl: committed.result!.sl, success: committed.result!.success };
  }

  it('DR total 0 → ÉCHEC par défaut (« 1 DR ou plus … est un succès », l.13)', () => {
    const r = crewStepAtZero();
    expect(r.sl).toBe(0);
    expect(r.success).toBe(false);
  });

  it('DR total 0 → SUCCÈS sous la règle optionnelle « 0 DR compte comme un succès » (l.13, 2ᵉ phrase)', () => {
    setRule('crew-test-zero-success', true);
    const r = crewStepAtZero();
    expect(r.sl).toBe(0);
    expect(r.success).toBe(true); // le bord qui manquait avant l'injection
  });

  /**
   * MANQUE DE BRAS en VOYAGE (MDG 14 l.55) : « les résultats du Test d'équipage subissent −2 DR et ne
   * peuvent jamais être meilleurs qu'un Succès Minime » — la règle vise TOUT Test d'équipage, pas
   * seulement ceux du combat. L'attrition de campagne (`vessel.crewLost`, MDG 15 l.245) est la couture
   * qui la déclenche en mer ; le flux verse le −2/tranche ET le plafond CHIFFRÉ dans la `meta` neutre.
   */
  it('équipage décimé (crewLost) : la journée de mer subit −2 DR/tranche ET plafonne le total au Succès Minime', () => {
    // Cogue : équipage nominal 15 (vehicles.json) — 5 perdus = 33 % → 3 tranches de 10 % (l.55).
    set({ vessel: { ...get().vessel!, crewLost: 5 } });
    get().startTravel('r1', 'mer');
    const step = driveToCrewStep('progression');
    expect(step).toBeTruthy();
    expect(Number(step!.meta?.aggregateFlatDR ?? 0)).toBe(-6); // 3 tranches × −2 DR (l.55)
    expect(step!.meta?.aggregateCapTo).toBe(1); // « jamais mieux qu'un Succès Minime »

    // Même avec des contributeurs excellents, le total ne dépasse pas le Succès Minime.
    const p = get().pendingCascade!;
    const strong = p.participants.map((s, i) => (i !== p.cursor ? s : {
      ...s, participants: s.participants!.map((part) => ({ ...part, result: { roll: 5, target: 60, sl: 6, success: true } })),
    }));
    set({ pendingCascade: { ...p, participants: strong } });
    get().cascadeNext();
    const committed = get().pendingCascade?.participants.find((s) => s.kind === 'progression') ?? strong[p.cursor];
    expect(committed.result!.sl).toBe(1); // plafonné (sans plafond : 6×N − 10)
    expect(committed.result!.success).toBe(true); // un Succès Minime reste un succès (LDB 12 l.110)
  });

  it('équipage au complet : aucune pénalité de Manque de bras, aucun plafond', () => {
    get().startTravel('r1', 'mer');
    const step = driveToCrewStep('progression');
    expect(Number(step!.meta?.aggregateFlatDR ?? 0)).toBe(0);
    expect(step!.meta?.aggregateCapTo).toBeUndefined();
  });
});

describe('Carte marine (MDG 15) — Orientation & Planque (#147)', () => {
  beforeEach(freshState);

  function driveDayCaptureOrientation(): number | undefined {
    let extra: number | undefined;
    for (let i = 0; i < 30 && !get().pendingRest; i++) {
      const p = get().pendingCascade;
      if (!p) break;
      const cur = p.participants[p.cursor];
      // Dé-navalisation (#328) : Moral + sabotage + traits + carte sont versés DÉJÀ chiffrés dans le
      // modificateur plat NEUTRE `aggregateFlatDR`. À Moral 75 (bande crewTestDR 0), il isole la carte/sabotage.
      if (cur?.kind === 'orientation') extra = Number(cur.meta?.aggregateFlatDR ?? 0) || undefined;
      stepCascade();
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

    // (a) le héros GARDE la carte → EN SÛRETÉ : le trésor est récupéré malgré rate 100. Le retrait est
    // recrédité au DÉPOSITAIRE (interludeFlow `bankWithdrawInner`, SOCLE POSSESSIONS #531) — SA bourse.
    const chart = itemFromTrappingById('carte-marine')!;
    set({ party: get().party.map((h, i) => (i === 0 ? { ...h, items: [chart] } : h)), bank: [deposit] } as never);
    bankWithdraw(get, set, 0);
    expect(get().bank).toHaveLength(0);
    expect(toBrass(bourseOf(get().party[0]))).toBe(1000); // récupéré sur la bourse du déposant

    // (b) la carte est PERDUE (héros sans carte) → même stash → DÉCOUVERT (rien récupéré).
    set({ party: get().party.map((h, i) => (i === 0 ? { ...h, items: [] } : h)), bank: [deposit] } as never);
    bankWithdraw(get, set, 0);
    expect(get().bank).toHaveLength(0);
    expect(toBrass(bourseOf(get().party[0]))).toBe(0);
  });
});

describe('Infestation de rats géants — Extermination des nuisibles Complexe (MDG 15 l.159-162)', () => {
  beforeEach(freshState);

  function driveDayCaptureExtermination(): number | undefined {
    let extra: number | undefined;
    for (let i = 0; i < 30 && !get().pendingRest; i++) {
      const p = get().pendingCascade;
      if (!p) break;
      const cur = p.participants[p.cursor];
      if (cur?.kind === 'extermination') extra = Number(cur.meta?.aggregateFlatDR ?? 0) || undefined;
      stepCascade();
    }
    return extra;
  }

  it('Complexe (–10) descend au Test d’équipage d’Extermination en −1 DR plat (même canal que l’Ouragan)', () => {
    get().startTravel('r1', 'mer');
    const plan = get().travelPlan!;
    set({ travelPlan: { ...plan, sea: { ...plan.sea!, infestation: { label: 'Infestation de rats géants', difficulty: 'complexe', need: 25, progress: 0, spoilPerNight: '3d10' } } } });
    expect(driveDayCaptureExtermination()).toBe(-1);
  });

  it('l’événement de bord FORCÉ pose la difficulté COMPLEXE de la donnée (jamais Intermédiaire en dur)', () => {
    const plan = buildSeaPlan(get, 'r1', 'A', 'B', seaMap.routes[0])!;
    set({ travelPlan: { ...plan, sea: { ...plan.sea!, forcedEventId: 'infestation-de-rats-geants' } } });
    runSeaDay(get, set);
    expect(get().travelPlan!.sea!.infestation?.difficulty).toBe('complexe');
  });

  it('3d10 : un total NON multiple de 3 (ex. 4/7/11) est ATTEIGNABLE — 1d10×3 en interdirait 20/28', () => {
    const vessel0 = get().vessel!;
    const seen = new Set<number>();
    for (let seed = 1; seed <= 60; seed++) {
      freshState();
      set({ vessel: { ...vessel0, cargo: [{ cargoId: 'bois', enc: 999, basePriceGold: 1 }] } });
      const plan = buildSeaPlan(get, 'r1', 'A', 'B', seaMap.routes[0])!;
      set({ travelPlan: { ...plan, sea: { ...plan.sea!, infestation: { label: 'Rats', difficulty: 'complexe', need: 25, progress: 0, spoilPerNight: '3d10' } } } });
      const before = get().vessel!.cargo!.reduce((n, l) => n + l.enc, 0);
      seedBattleRng(seed);
      continueSeaDayAfterCascade(get, set);
      const after = get().vessel!.cargo!.reduce((n, l) => n + l.enc, 0);
      const spoiled = before - after;
      if (spoiled > 0) seen.add(spoiled);
    }
    expect([...seen].some((v) => v % 3 !== 0)).toBe(true);
  });
});

describe('Phare du port d’arrivée — Test de Perception VISUEL (MDG 13 l.337) : la Surdité ne pénalise pas', () => {
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
    const vigie = { ...a, skills: [{ skillId: 'perception', characteristic: 'initiative', advances: 0 }], traumas: [traumaById('surdite', undefined, 'tete')] };
    const timonier = { ...b, skills: [{ skillId: 'voile', characteristic: 'dexterite', advances: 30 }], traumas: [] };
    useGame.setState({
      party: [vigie, timonier],
      scene: { id: 'port-a', nom: 'Port', dimensions: { w: 2, h: 2 }, layers: [{ z: 0, tiles: ['sol', 'sol', 'sol', 'sol'] }], entities: [], dialogues: [], triggers: [] } as never,
      battle: null,
      worldMap: lighthouseMap,
      travelPlan: null,
      travelRecap: null,
      pendingCrewTest: null,
      pendingRest: null,
      pendingCascade: null,
      suspendedCascades: [],
      gameTime: 8 * 60,
      lastUpkeepDay: 0,
      vessel: { vehicleId: 'cogue', morale: { score: 75, lastMoraleWeek: 0, factors: [] } },
      journal: [],
    } as never);
  }

  it('la Vigie SOURDE n’est PAS pénalisée au Test de Perception du phare (sense "vue" posé par kind "phare")', () => {
    freshLighthouseState();
    useGame.getState().startTravel('r1', 'mer');
    let phare: CascadeStep | undefined;
    let progression: CascadeStep | undefined;
    for (let i = 0; i < 30 && !phare; i++) {
      const p = useGame.getState().pendingCascade;
      if (!p) break;
      const cur = p.participants[p.cursor];
      if (cur?.kind === 'phare') { phare = cur; break; }
      if (cur?.kind === 'progression') progression = cur;
      // Le choix de Progression (MDG 14 l.63) se répond par défaut — voie d'équipage.
      if (cur?.options && !cur.chosen) useGame.getState().cascadeChoose(cur.id, cur.defaultChoice ?? cur.options[0].key);
      else if (cur?.participants) { for (const part of cur.participants) if (!part.result) useGame.getState().cascadeBatchRoll(part.id); }
      else if (cur && !cur.result) useGame.getState().cascadeRoll(cur.id);
      useGame.getState().cascadeNext();
    }
    expect(phare).toBeTruthy(); // l'étape du phare a bien été atteinte (port à phare, km 1 → dans la portée dès le jour 1)
    // Dé-navalisation (#328) : `sense`/`roleId` ne sont plus des champs du participant GÉNÉRIQUE —
    // l'effet du sens « vue » est BAKÉ dans la présentation `base` À LA CONSTRUCTION (`crewRoleValue`,
    // kind 'phare' = Perception visuelle). On l'OBSERVE : la base de la Vigie SOURDE au phare = sa
    // valeur de Perception avec sens « vue » (non pénalisée), non la valeur sans sens (pénalisée).
    const vigie = useGame.getState().party.find((h) => h.traumas?.some((t) => t.traumaId === 'surdite'))!;
    const vigieRole = findCrewRoleById('vigie')!;
    const vigiePart = phare!.participants!.find((x) => x.id === vigie.id);
    expect(vigiePart).toBeTruthy();
    expect(vigiePart!.base).toBe(crewRoleValue(vigie, vigieRole, 'vue').value);
    // Autre étape (Progression, sans sens narratif dédié) : base résolue SANS sens — comportement historique.
    expect(progression).toBeTruthy();
    for (const part of progression!.participants!) expect(typeof part.base).toBe('number');
  });
});

describe('registre cascadeAppliers — les 10 Tests d’équipage de VOYAGE (#275 Ronde 2 cran 3 — PILOTE RÉEL)', () => {
  beforeEach(freshState);

  function planWithSea() {
    const plan = buildSeaPlan(get, 'r1', 'A', 'B', seaMap.routes[0])!;
    set({ travelPlan: plan });
    return plan;
  }

  /** Étape À PARTICIPANTS déjà agrégée (`commitStep`/`aggregateBatchStep`, #275 Décision 4 cran 1) —
   *  `result.sl` = total agrégé, `result.success` = total ≥ 1 (MDG 14 l.13). */
  function step(kind: string, sl: number, success = sl >= 1): CascadeStep {
    return { id: kind, kind, label: kind, result: { roll: 0, target: 0, sl, success }, interactive: true };
  }

  const apply = (kind: string, sl: number, success = sl >= 1) =>
    cascadeAppliers[kind].apply(get, set, step(kind, sl, success), undefined, { steps: [], index: 0 });

  it('entretien : réussite (total −2 ≥ 1) → réparation temporaire 1d10 Blessures, PERSISTÉE (#30 ; MDG 14 l.122 + ch.13 l.647)', () => {
    const plan = planWithSea();
    plan.vehicle!.wounds.current = 30; // coque endommagée (max 50 : cogue)
    apply('entretien', 5); // +5 → +3 après −2 → réussite
    const cur = get().vessel!.wounds!.current;
    expect(cur).toBeGreaterThan(30);
    expect(cur).toBeLessThanOrEqual(40); // +1d10 max
    apply('entretien', 2); // 2 − 2 = 0 → échec (« 1 DR ou plus », MDG 14 l.13)
    expect(get().vessel!.wounds!.current).toBe(cur);
  });

  it('orientation : dérive majeure (DR ≤ −5) → Changement de cap (retard % sur la distance restante), km jamais réduit', () => {
    const plan = planWithSea();
    set({ travelPlan: { ...plan, kmDone: 100 } });
    const before = get().travelPlan!.km;
    apply('orientation', -6, false);
    expect(get().travelPlan!.km).toBeGreaterThanOrEqual(before);
  });

  it('affaler : échec → Critique au Gréement PERSISTÉ (`vessel.criticals`)', () => {
    planWithSea();
    apply('affaler', -3, false);
    expect(get().vessel!.criticals?.length ?? 0).toBeGreaterThan(0);
  });

  it('affaler : réussite → aucun Critique, conséquence composée (#295 Lot 1)', () => {
    planWithSea();
    const out = apply('affaler', 3, true);
    expect(resultLine(out?.consequences ?? [])).toContain('affalées à temps');
    expect(get().vessel!.criticals?.length ?? 0).toBe(0);
  });

  it('phare : réussite → bonus d’Orientation posé (Savoir Océans/manuel, ch.13 l.335)', () => {
    planWithSea();
    apply('phare', 1, true);
    expect(get().travelPlan!.sea!.lighthouseDR).toBeGreaterThanOrEqual(0);
  });

  it('phare : échec → aucun bonus posé', () => {
    planWithSea();
    apply('phare', -1, false);
    expect(get().travelPlan!.sea!.lighthouseDR).toBe(0);
  });

  it('extermination : progression cumulée jusqu’à extermination complète (MDG 14 l.98-104)', () => {
    const plan = planWithSea();
    set({ travelPlan: { ...plan, sea: { ...plan.sea!, infestation: { label: 'Rats', difficulty: 'intermediaire', need: 5, progress: 0, spoilPerNight: '1d10' } } } });
    apply('extermination', 5, true);
    expect(get().travelPlan!.sea!.infestation).toBeUndefined();
  });

  it('voyage-rapide : calcule ET applique le palier (Rude épreuve, l.28)', () => {
    const plan = buildSeaPlan(get, 'r1', 'A', 'B', seaMap.routes[0])!;
    set({ travelPlan: { ...plan, sea: { ...plan.sea!, fast: { days: 3, weeks: 0 } } } });
    apply('voyage-rapide', 2, true);
    // `finalizeFastVoyage` a tourné : `pendingFinalize` retombe à false (ou le plan a été purgé à l'accostage).
    expect(get().travelPlan?.sea?.fast?.pendingFinalize).toBeFalsy();
  });

  it('poursuite : gain de Distance mute la crise EN PLACE (ni échappé, ni rattrapé)', () => {
    const plan = planWithSea();
    set({ travelPlan: { ...plan, sea: { ...plan.sea!, crisis: { kind: 'poursuite', label: 'Écumeur', distance: 0, escapeAt: 100, foeM: 3, foeSkill: 10, desc: '' } } } });
    apply('poursuite', 10, true);
    expect(get().travelPlan!.sea!.crisis).toBeTruthy();
  });

  it('tourbillon : chaque manche endommage la coque (IC − Endurance/10) et cumule l’évasion', () => {
    const plan = planWithSea();
    plan.vehicle!.wounds.current = plan.vehicle!.wounds.max;
    set({ travelPlan: { ...plan, sea: { ...plan.sea!, crisis: { kind: 'tourbillon', whirlpoolId: 'maelstrom', need: 999, progress: 0, label: 'Maelström' } } } });
    const before = plan.vehicle!.wounds.current;
    apply('tourbillon', 3, true);
    expect(get().travelPlan!.vehicle!.wounds.current).toBeLessThanOrEqual(before); // Dégâts de collision (peuvent être nuls si BE couvre)
    expect(get().travelPlan!.sea!.crisis).toBeTruthy(); // `need` 999 : le total agrégé ne peut pas l'atteindre en une manche
  });

  it('embuscade : succès → préparés (pas de Surprise) — conséquence composée (#295 Lot 1)', () => {
    planWithSea();
    const out = apply('embuscade', 1, true);
    expect(resultLine(out?.consequences ?? [])).toContain('prépare');
  });

  it('progression : applique les milles du jour PUIS insère le reste de la journée (Décision 2, cran 3)', () => {
    planWithSea();
    const out = apply('progression', 2, true);
    expect(get().travelPlan!.sea!.milesToday).toBeGreaterThan(0);
    // Orientation (toujours jouée) fait partie de l'insert post-progression.
    expect(out?.insert?.some((s) => s.kind === 'orientation')).toBe(true);
  });
});

describe('progression — message « Encalminé »/« Voiles affalées » piloté par la STRUCTURE (sailsDown / m===null), pas par le libellé FR du vent', () => {
  beforeEach(freshState);

  // Mer calme (calme-plat → cellule `encalmine` sur TOUS les aspects, ch.13 l.276) → eff.m === null,
  // indépendamment de `sailsDown` (posé par un jour de vent violent PRÉCÉDENT, ne dépend pas de la météo courante).
  function planAtProgression(sailsDown: boolean) {
    const plan = buildSeaPlan(get, 'r1', 'A', 'B', seaMap.routes[0])!;
    const sea = { ...plan.sea!, weather: { ...plan.sea!.weather, vent: 'calme-plat' as const }, sailsDown };
    set({ travelPlan: { ...plan, sea } });
  }

  it('mer calme (eff.m === null), voiles NON affalées → message « Encalminé »', () => {
    planAtProgression(false);
    runSeaDay(get, set);
    const journal = get().journal;
    expect(journal.some((l) => l.includes('Encalminé'))).toBe(true);
    expect(journal.some((l) => l.includes('affalées'))).toBe(false);
  });

  it('voiles affalées (sailsDown), MÊME mer calme → message « Voiles affalées » (la structure prime sur le libellé du vent)', () => {
    planAtProgression(true);
    runSeaDay(get, set);
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
    const enc = buildEncounter({ id: 'enc-abordage', enemies: [{ statblock: { label: 'Écumeur', char: { 'capacite-de-combat': 30, force: 30, endurance: 30, initiative: 30, agilite: 30, B: 8 } }, pos: { x: 5, y: 5 } }] });
    s.entities.push(...enc.entities); s.encounters = [enc.encounter];
    return s;
  }
  function freshAmbush(worldMap: WorldMap = abordageMap) {
    seedBattleRng(1); // RNG semé : le jour joué directement à l'étape 'embuscade' ne tire AUCUN événement de bord
    useGame.setState({
      party: makePregens().slice(0, 3), battle: null, travelPlan: null, travelRecap: null,
      pendingCrewTest: null, pendingRest: null, pendingCascade: null, suspendedCascades: [], gameTime: 8 * 60, lastUpkeepDay: 0,
      vessel: { vehicleId: 'cogue', morale: { score: 75, lastMoraleWeek: 0, factors: [] } }, journal: [],
    } as never);
    useGame.getState().loadProject([portScene('port-a', 'Port A'), portScene('port-b', 'Port B'), abordageScene()], 'port-a', worldMap);
    useGame.setState({ vessel: { vehicleId: 'cogue', morale: { score: 75, lastMoraleWeek: 0, factors: [] } } } as never); // startScene remet le vessel de campagne — repose-le
  }

  it('franchissement de l’ancrage (kmDone ≥ at × km) → Test de Perception PUIS abordage, une seule fois — la cascade-jour SURVIT au combat (#284/#275)', () => {
    freshAmbush();
    const plan = buildSeaPlan(get, 'r1', 'A', 'B', abordageMap.routes[0])!;
    // Ancrage = 0.5 × 550 = 275 milles. On force `sea.crisis`-like via une progression déjà proche de l'ancrage :
    // kmDone 270, une progression du jour d'~20 milles franchit l'ancrage (290 ≥ 275).
    set({ travelPlan: { ...plan, kmDone: 270 } } as never);
    runSeaDay(get, set);
    // Déroule la cascade jusqu'à l'étape 'embuscade'.
    let guard = 0;
    while (get().pendingCascade && get().pendingCascade!.participants[get().pendingCascade!.cursor]?.kind !== 'embuscade' && guard++ < 30) stepCascade();
    const casc = get().pendingCascade;
    expect(casc).toBeTruthy();
    const embuscadeStep = casc!.participants[casc!.cursor];
    expect(embuscadeStep?.kind).toBe('embuscade'); // Test de Perception influençable (patron terrestre « Attaqués ! »)
    stepCascade(); // valide l'étape 'embuscade' → ouvre l'abordage (startCombat)
    expect(get().travelPlan!.sea!.ambushFired).toBe(true);
    expect(get().travelPlan!.interrupted).toBe(true);
    expect(get().battle).toBeTruthy(); // abordage ouvert par la couture partagée
    expect(get().scene!.id).toBe('ls-abordage');
    // La cascade-jour a été SUSPENDUE (pas perdue) : ses étapes restantes (Orientation/Extermination/
    // Entretien) vivent dans la pile, prêtes à reprendre au teardown de combat (#275 Ronde 2 cran 3).
    expect(get().pendingCascade).toBeNull(); // le slot est libre pour les cascades DU combat
    expect(get().suspendedCascades.length).toBe(1);
    expect(get().suspendedCascades[0].purpose).toBe('travelDay');
  });

  it('reprise après COMBAT ne double PAS l\'écran de victoire (décision ii, #275 Ronde 2 cran 3) : victoire d\'abord, cascade-jour ENSUITE', () => {
    freshAmbush();
    const plan = buildSeaPlan(get, 'r1', 'A', 'B', abordageMap.routes[0])!;
    set({ travelPlan: { ...plan, kmDone: 270 } } as never);
    runSeaDay(get, set);
    let guard = 0;
    while (get().pendingCascade && get().pendingCascade!.participants[get().pendingCascade!.cursor]?.kind !== 'embuscade' && guard++ < 30) stepCascade();
    stepCascade(); // valide 'embuscade' → ouvre l'abordage (startCombat), suspend la cascade-jour
    expect(get().battle).toBeTruthy();
    expect(get().suspendedCascades.length).toBe(1);

    // Victoire du combat (raccourci de test — la résolution d'attaque RÉELLE est couverte ailleurs) :
    // l'ennemi tombe, `checkBattleOver` pose `over:'victory'` + `pendingVictory`.
    const battle = get().battle!;
    for (const c of battle.combatants) if (c.kind === 'enemy') c.wounds.current = 0;
    set({ battle: { ...battle } });
    checkBattleOver(get, set);
    expect(get().pendingVictory).toBeTruthy();
    expect(get().battle?.over).toBe('victory');
    // AVANT « Continuer » : la cascade-jour reste SUSPENDUE — l'écran de victoire passe devant.
    expect(get().pendingCascade).toBeNull();
    expect(get().suspendedCascades.length).toBe(1);

    get().dismissVictory();
    // APRÈS « Continuer » : la victoire s'efface ET la cascade-jour REPREND (teardown de combat,
    // couture universelle `resumeSuspendedCascade`).
    expect(get().pendingVictory).toBeNull();
    expect(get().battle).toBeNull();
    expect(get().suspendedCascades.length).toBe(0);
    expect(get().pendingCascade).toBeTruthy();
    expect(get().pendingCascade!.purpose).toBe('travelDay');
  });

  it('route SANS embuscade authorée → le franchissement ne déclenche rien', () => {
    const noAmbush: WorldMap = { ...abordageMap, routes: [{ ...abordageMap.routes[0], ambush: undefined }] };
    freshAmbush(noAmbush);
    const plan = buildSeaPlan(get, 'r1', 'A', 'B', noAmbush.routes[0])!;
    set({ travelPlan: { ...plan, kmDone: 270 } } as never);
    runSeaDay(get, set);
    let guard = 0;
    while (get().pendingCascade && guard++ < 30) {
      const casc = get().pendingCascade!;
      if (casc.participants[casc.cursor]?.kind === 'embuscade') break;
      stepCascade();
    }
    expect(get().travelPlan?.sea?.ambushFired).toBeFalsy();
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
      if (!get().pendingCascade) break;
      stepCascade();
    }
    expect(get().journal.some((l) => l.includes('Péripétie : Récif affleurant'))).toBe(true);
  });

  it('un péril d’auteur `startCombat` INTERROMPT la traversée (comme l’embuscade)', () => {
    const krakenScene = emptyScene(10, 10); krakenScene.id = 'port-a'; krakenScene.nom = 'Mer';
    const enc = buildEncounter({ id: 'enc-kraken', enemies: [{ statblock: { label: 'Kraken', char: { 'capacite-de-combat': 30, force: 30, endurance: 30, initiative: 30, agilite: 30, B: 8 } }, pos: { x: 5, y: 5 } }] });
    krakenScene.entities.push(...enc.entities); krakenScene.encounters = [enc.encounter];
    const combatPeril: WorldMap = {
      ...seaMap,
      routes: [{ ...seaMap.routes[0], perils: [{ label: 'Kraken', chancePct: 100, effects: [{ type: 'startCombat', encounter: 'enc-kraken' }] }] }],
    };
    set({ scene: krakenScene as never, worldMap: combatPeril } as never);
    const plan = buildSeaPlan(get, 'r1', 'A', 'B', combatPeril.routes[0])!;
    set({ travelPlan: plan } as never);
    runSeaDay(get, set);
    expect(get().travelPlan!.interrupted).toBe(true); // la traversée s’arrête sur le combat d’auteur
    expect(get().battle).toBeTruthy();
    expect(get().journal.some((l) => l.includes('Péripétie : Kraken'))).toBe(true);
  });
});

describe('Traversée RAPIDE — un seul Test de Rude épreuve (MDG 15 l.21-37, C.16)', () => {
  beforeEach(freshState);

  function driveFast(): void {
    const p = get().pendingCascade;
    expect(p?.purpose).toBe('test');
    const cur = p!.participants[p!.cursor];
    expect(cur?.kind).toBe('voyage-rapide');
    stepCascade(); // valide → `computeFastPalier` + `finalizeFastVoyage` (calcule ET applique dans le même geste)
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

  // Manann élevé → palier de voyage rapide BÉNIN (aucune perte d’équipage) : la population de consommation
  // reste l’effectif nominal, sans bruit d’un crewLost aléatoire du palier.
  const benign = { manann: { score: 1000, applied: [] } };

  it('#245 — l’eau se consomme sur TOUTE la population (3 héros + 15 PNJ de la cogue) sur 7 jours', () => {
    set({ vessel: { ...get().vessel!, ...benign, waterLitres: 1000 } }); // party = 3 héros, cogue = 15 PNJ nominaux → 18 âmes
    get().startTravel('r1', 'mer', { fast: true });
    driveFast();
    // 18 âmes × 3 L (médiane) × 7 jours = 378 L.
    expect(get().vessel!.waterLitres).toBe(1000 - 18 * 3 * 7);
  });

  it('#245 — l’effectif nominal perdu (crewLost) réduit la population qui consomme', () => {
    set({ vessel: { ...get().vessel!, ...benign, waterLitres: 1000, crewLost: 10 } }); // 15 − 10 = 5 PNJ → 3 + 5 = 8 âmes
    get().startTravel('r1', 'mer', { fast: true });
    driveFast();
    expect(get().vessel!.waterLitres).toBe(1000 - 8 * 3 * 7);
  });

  it('#245 — l’équipage mange les vivres de cale ; à court → facteur de Moral « nourriture-insuffisante »', () => {
    // 15 PNJ × 7 jours = 105 rations requises. Vivres de cale 50 < 105 → disette.
    set({ vessel: { ...get().vessel!, ...benign, waterLitres: 1000, provisions: 50 } });
    get().startTravel('r1', 'mer', { fast: true });
    driveFast();
    const v = get().vessel!;
    expect(v.provisions).toBe(0); // épuisés
    expect(v.morale.factors).toContain('nourriture-insuffisante'); // pèsera au recalcul hebdomadaire (MDG 14 l.171)
  });

  it('#245 — vivres de cale suffisants → aucun facteur de disette, stock décrémenté', () => {
    set({ vessel: { ...get().vessel!, ...benign, waterLitres: 1000, provisions: 200, morale: { score: 75, lastMoraleWeek: 0, factors: ['nourriture-insuffisante'] } } });
    get().startTravel('r1', 'mer', { fast: true });
    driveFast();
    const v = get().vessel!;
    expect(v.provisions).toBe(200 - 15 * 7); // 105 consommés
    expect(v.morale.factors).not.toContain('nourriture-insuffisante'); // réapprovisionné → facteur retiré
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
    const enc = buildEncounter({ id: 'enc-abordage', enemies: [{ statblock: { label: 'Écumeur', char: { 'capacite-de-combat': 30, force: 30, endurance: 30, initiative: 30, agilite: 30, B: 8 } }, pos: { x: 5, y: 5 } }] });
    s.entities.push(...enc.entities); s.encounters = [enc.encounter];
    return s;
  }
  beforeEach(() => {
    seedBattleRng(1);
    useGame.setState({
      party: makePregens().slice(0, 3), battle: null, travelPlan: null, travelRecap: null,
      pendingCrewTest: null, pendingRest: null, pendingCascade: null, suspendedCascades: [], gameTime: 8 * 60, lastUpkeepDay: 0,
      vessel: { vehicleId: 'cogue', morale: { score: 75, lastMoraleWeek: 0, factors: [] } }, journal: [],
    } as never);
    useGame.getState().loadProject([portScene('port-a', 'Port A'), portScene('port-b', 'Port B'), abordageScene()], 'port-a', abordageMap);
    useGame.setState({ vessel: { vehicleId: 'cogue', morale: { score: 75, lastMoraleWeek: 0, factors: [] } } } as never);
  });

  it('l’abordage ancré INTERROMPT le voyage rapide (cascade `purpose:test` suspendue) ; après le combat, la traversée se finit en rapide', () => {
    get().startTravel('r1', 'mer', { fast: true });
    const p = get().pendingCascade!;
    expect(p.participants[p.cursor]?.kind).toBe('voyage-rapide');
    stepCascade(); // valide → computeFastPalier + finalizeFastVoyage → embuscade ancrée → startCombat
    expect(get().battle).toBeTruthy(); // abordage ouvert par la couture partagée (#212)
    expect(get().scene!.id).toBe('ls-abordage');
    expect(get().travelPlan!.sea!.ambushFired).toBe(true);
    expect(get().travelPlan!.interrupted).toBe(true);
    expect(get().travelPlan!.sea!.fast!.pendingFinalize).toBe(true); // le palier reste à appliquer
    // Timing (docs/plans/…) : à l'interruption, seule la narration d'embuscade part — le texte du palier
    // (« Voyage rapide — … ») ne doit PAS précéder son application (l'écran de combat le démentirait).
    expect(get().journal.some((l) => l.includes('voile hostile surgit'))).toBe(true);
    expect(get().journal.some((l) => l.startsWith('Voyage rapide —'))).toBe(false);
    // Combat gagné → reprise : la traversée s’achève en rapide (arrivée), sans rejouer l’embuscade.
    set({ battle: null });
    get().resumeTravel();
    expect(get().travelPlan).toBeNull(); // accosté
    expect(get().pendingShoreLeave).toBeTruthy();
    // Post-combat : la narration du palier part ENFIN, avec son application (même geste).
    expect(get().journal.some((l) => l.startsWith('Voyage rapide —'))).toBe(true);
  });
});

describe('Cogue pirate (#327 A5.3) — l’événement navire-hostile PRÉSENTE les 3 choix (couture RÉELLE, re-recette)', () => {
  beforeEach(freshState);

  /** Force l’événement de bord `navire-hostile` (Langskip / Cogue pirate) au jour courant et déroule la
   *  résolution RÉELLE du jour (`runSeaDay` → `resolveSeaDayEvent` → `openPirateHail`) — PAS un step
   *  fabriqué : on vérifie que la COUTURE présente bien la cascade de choix (le lot D ne testait que les
   *  appliers, sur un step monté à la main → il passait alors que le joueur ne voyait rien). */
  function forceHail() {
    const plan = buildSeaPlan(get, 'r1', 'A', 'B', seaMap.routes[0])!;
    set({ travelPlan: { ...plan, sea: { ...plan.sea!, forcedEventId: 'navire-hostile' } } });
    runSeaDay(get, set);
  }

  it('runSeaDay ouvre la cascade de CHOIX (fuir/combattre/soumettre) — AUCUNE auto-résolution silencieuse', () => {
    forceHail();
    const p = get().pendingCascade;
    expect(p).toBeTruthy();
    const cur = p!.participants[p!.cursor];
    expect(cur.kind).toBe('sea-pirate-hail');
    expect(cur.options?.map((o) => o.key)).toEqual(['fuir', 'combattre', 'soumettre']); // les 3 choix présentés
    // Rien de tranché AVANT le choix : ni fuite (Poursuite), ni pillage — le joueur décide.
    expect(get().travelPlan!.sea!.crisis).toBeFalsy();
    expect(get().journal.some((l) => l.includes('prend la fuite'))).toBe(false);
  });

  it('branche PRÉSENTÉE « fuir » (défaut) → Poursuite (mute la crise, aucune perte silencieuse)', () => {
    forceHail();
    const cur = get().pendingCascade!.participants[get().pendingCascade!.cursor];
    get().cascadeChoose(cur.id, 'fuir');
    get().cascadeNext();
    expect(get().travelPlan!.sea!.crisis?.kind).toBe('poursuite');
  });

  it('après « fuir », la conduite du jour REPREND SYNCHRONEMENT (couture `dispatchCascadeDone`, pas de `setTimeout`) → la manche de Poursuite finit par surfacer (#383)', () => {
    forceHail();
    const cur = get().pendingCascade!.participants[get().pendingCascade!.cursor];
    get().cascadeChoose(cur.id, 'fuir');
    get().cascadeNext(); // ferme la cascade de choix → dispatchCascadeDone (purpose 'test' + mer) relance runSeaDay
    // Pas de soft-lock : le jour a redémarré SANS attendre un macrotask (la crise reste posée).
    expect(get().travelPlan!.sea!.crisis?.kind).toBe('poursuite');
    expect(get().pendingCascade?.purpose).toBe('travelDay');
    // La Progression du jour ouvre ; sa résolution INSÈRE la manche de Poursuite (buildPostProgressionSteps).
    for (let i = 0; i < 6 && !get().pendingCascade?.participants.some((s) => s.kind === 'poursuite'); i++) stepCascade();
    expect(get().pendingCascade?.participants.some((s) => s.kind === 'poursuite')).toBe(true);
  });

  it('équipage SANS compétence navale : la manche de Poursuite se JOUE quand même (plancher de Manque de bras, MDG 14 l.55), jamais droppée en silence (#383)', () => {
    set({ party: makePregens().slice(0, 3).map((h) => ({ ...h, skills: [] })) } as never);
    forceHail();
    const cur = get().pendingCascade!.participants[get().pendingCascade!.cursor];
    get().cascadeChoose(cur.id, 'fuir');
    get().cascadeNext(); // → runSeaDay : aucun PJ apte = sous l'effectif minimal → crise résolue au plancher (−2 DR, MDG 14 l.55), pas de lock
    // La manche a JOUÉ : soit la crise s'est résolue (échappée/rattrapée), soit une manche a été jouée
    // ET JOURNALISÉE (`sea.lines`). Au plancher de Manque de bras l'écart peut nier à 0 milles (le navire
    // sous-armé ne creuse pas l'écart, MDG 14 l.55) — c'est le RAW, pas un drop : le journal le prouve.
    const sea = get().travelPlan?.sea;
    const journaled = (sea?.lines ?? []).some((l) => l.includes('Poursuite'))
      || (get().travelPlan?.log ?? []).some((d) => d.lines?.some((l) => l.text.includes('Poursuite')));
    const played = sea?.crisis?.kind !== 'poursuite' || journaled;
    expect(played).toBe(true);
  });

  it('branche PRÉSENTÉE « soumettre » → pillage (100 %) puis choix du tribut (étape insérée)', () => {
    set({ vessel: { ...get().vessel!, cargo: [{ cargoId: 'vin', enc: 30, basePriceGold: 2 }] } } as never);
    forceHail();
    const cur = get().pendingCascade!.participants[get().pendingCascade!.cursor];
    get().cascadeChoose(cur.id, 'soumettre');
    get().cascadeNext();
    expect(get().vessel!.cargo!.reduce((n, l) => n + l.enc, 0)).toBe(0); // cale vidée (piratePillagePct 100 %)
    const p2 = get().pendingCascade;
    expect(p2?.participants.some((s) => s.kind === 'sea-pirate-tribute')).toBe(true); // choix du tribut offert
  });
});

describe('Événement de bord RACONTÉ → carte-parchemin (#371 LOT 4, non couvert avant #383)', () => {
  beforeEach(freshState);

  it('un événement de bord FORCÉ (couture réelle `forcedEventId` + `runSeaDay`) pousse un `RecapEvent` {title,text} VERBATIM (source `sea-events.json`, sans tirage — recette #332)', () => {
    const plan = buildSeaPlan(get, 'r1', 'A', 'B', seaMap.routes[0])!;
    set({ travelPlan: { ...plan, sea: { ...plan.sea!, forcedEventId: 'calme-plat' } } });
    runSeaDay(get, set);
    const events = get().travelPlan!.sea!.events ?? [];
    expect(events).toHaveLength(1);
    const def = seaBoardEventById('calme-plat')!;
    expect(events[0]).toEqual({ title: def.label, text: def.desc, roll: undefined }); // forcé → pas de tirage (recapLine.ts)
  });

  it('un tirage NATUREL (non forcé, `daysToEvent` échu) capture le d100 dans le `RecapEvent` — label+texte SOURCÉS (`BOARD_EVENTS`, pas de copie en dur)', () => {
    const plan = buildSeaPlan(get, 'r1', 'A', 'B', seaMap.routes[0])!;
    set({ travelPlan: { ...plan, sea: { ...plan.sea!, daysToEvent: 1, forcedEventId: undefined } } });
    runSeaDay(get, set);
    const events = get().travelPlan!.sea!.events ?? [];
    expect(events).toHaveLength(1);
    const ev = events[0];
    expect(typeof ev.roll).toBe('number'); // tirage capturé (chemin non forcé)
    const def = BOARD_EVENTS.find((e) => e.label === ev.title && e.desc === ev.text);
    expect(def).toBeTruthy(); // titre + texte VERBATIM d'une entrée RÉELLE de sea-events.json
  });
});

describe('Clôture du jour de mer — le récap porte les events, `sea.events` se RÉINITIALISE (#371 LOT 4, non couvert avant #383)', () => {
  beforeEach(freshState);

  it('`continueSeaDayAfterCascade` : le `TravelRecapDay` (`travelPlan.log`) porte les events du jour ; `sea.events` repart à vide (pas de fuite au lendemain)', () => {
    const plan = buildSeaPlan(get, 'r1', 'A', 'B', seaMap.routes[0])!;
    const def = seaBoardEventById('calme-plat')!;
    const carried: RecapEvent = { title: def.label, text: def.desc, roll: 21 };
    set({ travelPlan: { ...plan, sea: { ...plan.sea!, events: [carried], milesToday: 5 } } });
    continueSeaDayAfterCascade(get, set);
    const log = get().travelPlan!.log!;
    expect(log).toHaveLength(1);
    expect(log[0].events).toEqual([carried]); // la carte du jour porte l'événement
    expect(get().travelPlan!.sea!.events).toEqual([]); // reset — pas de fuite au jour suivant
  });
});

describe('services portuaires (#30)', () => {
  beforeEach(freshState);

  it('réparation au port : 1 CO par Blessure restaurée (MDG 13 l.643), le temps de chantier passe', () => {
    set({ vessel: { ...get().vessel!, wounds: { current: 40, max: 50 } } });
    creditBourse(get, set, get().party[0].id, { gold: 20, silver: 0, brass: 0 });
    const t0 = get().gameTime;
    const lines = portRepairVessel(get, set);
    expect(lines[0]).toContain('remis à neuf');
    expect(get().vessel!.wounds!.current).toBe(50);
    expect(partyMoneyTotal(get).gold).toBe(10); // 10 Blessures × 1 CO
    expect(get().gameTime).toBeGreaterThan(t0);
    // Bourse insuffisante → refus (il ne reste que 10 CO, la réparation de 40 Blessures en coûte 40).
    set({ vessel: { ...get().vessel!, wounds: { current: 10, max: 50 } } });
    expect(portRepairVessel(get, set)[0]).toContain('bourse');
  });

  it('pose d’une Amélioration : coût par bande de Taille (MDG 12) — Nid-de-pie sur une cogue (25 m, Moyenne) = 5 CO', () => {
    creditBourse(get, set, get().party[0].id, { gold: 10, silver: 0, brass: 0 });
    const lines = portInstallUpgrade(get, set, 'nid-de-pie');
    expect(lines[0]).toContain('Nid-de-pie');
    expect(partyMoneyTotal(get).gold).toBe(5);
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
    creditBourse(get, set, get().party[0].id, { gold: 100, silver: 0, brass: 0 });
    triggerPriest();
    expect(get().pendingManannPriest).toEqual({ cost: { gold: 7, silver: 25, brass: 0 } }); // 1d10=7 CO + 25 m (cogue) en pistoles
    expect(partyMoneyTotal(get)).toEqual({ gold: 100, silver: 0, brass: 0 }); // pas débité tant que non résolu
    expect(get().vessel!.manann?.score ?? 0).toBe(0); // Humeur inchangée tant que non résolu
  });

  it('choix PAYER : débite le coût déjà tiré, Humeur INCHANGÉE', () => {
    const before = { gold: 100, silver: 0, brass: 0 };
    creditBourse(get, set, get().party[0].id, before);
    triggerPriest();
    const cost = get().pendingManannPriest!.cost;
    resolveManannPriest(get, set, true);
    expect(get().pendingManannPriest).toBeNull();
    expect(partyMoneyTotal(get)).toEqual(subtract(before, cost));
    expect(get().vessel!.manann?.score ?? 0).toBe(0);
  });

  it('choix REFUSER : Humeur de Manann réduite de 4d10, bourse INCHANGÉE', () => {
    const before = { gold: 100, silver: 0, brass: 0 };
    creditBourse(get, set, get().party[0].id, before);
    triggerPriest();
    seedBattleRng(7); // détermine le 4d10 de resolveManannPriest (battleRng interne)
    resolveManannPriest(get, set, false);
    expect(get().pendingManannPriest).toBeNull();
    expect(partyMoneyTotal(get)).toEqual(before); // pas débité
    const score = get().vessel!.manann!.score;
    expect(score).toBeLessThanOrEqual(-4); // 4d10 : 4 à 40
    expect(score).toBeGreaterThanOrEqual(-40);
  });

  it('choix PAYER avec bourse insuffisante : garde défensive — aucune mutation (l’UI désactive le bouton)', () => {
    // Bourse du groupe VIDE (aucun héros financé) → payFromGroup insolvable → garde défensive.
    triggerPriest();
    resolveManannPriest(get, set, true);
    expect(get().pendingManannPriest).toBeNull();
    expect(partyMoneyTotal(get)).toEqual({ gold: 0, silver: 0, brass: 0 });
    expect(get().vessel!.manann?.score ?? 0).toBe(0);
  });
});

describe('Port désert & Embrigadement — #150 (resolvePortArrival appelé APRÈS purge de travelPlan)', () => {
  beforeEach(freshState);

  const seq = (...vals: number[]): RNG => {
    let i = 0;
    return { int: (min, max) => Math.min(max, Math.max(min, vals[i++ % vals.length])) };
  };

  it('Port désert (min 5 max 5, sea-events.json) applique bien son delta d’Humeur — ship résolu depuis `vessel`, PAS `travelPlan` (déjà `null` ici, cf. accostage)', () => {
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

  it('accostage RÉEL (continueSeaDayAfterCascade) : pendingShoreLeave s\'ouvre AVANT tout tirage d\'événement de port', () => {
    const plan = buildSeaPlan(get, 'r1', 'A', 'B', seaMap.routes[0])!;
    set({ travelPlan: { ...plan, kmDone: plan.km - 5, sea: { ...plan.sea!, milesToday: 5 } } });
    // Clôture directe du jour (équivalent RAW-fidèle de la fin de cascade, sans dépendre du tirage du jour).
    continueSeaDayAfterCascade(get, set);
    expect(get().pendingShoreLeave).toBeTruthy();
    expect(get().pendingShoreLeave!.to.id).toBe('B');
    expect(get().journal.some((l) => l.includes('Événement de port'))).toBe(false); // pas encore tiré
    resolveShoreLeave(get, set, true);
    expect(get().pendingShoreLeave).toBeNull();
    expect(get().journal.some((l) => l.includes('Événement de port'))).toBe(true); // tiré APRÈS le choix
  });

  it('seam de jet (#275 Ronde 1) — Désertion : SANS siège MJ résout INLINE (même journée, événement de port tiré direct)', () => {
    const plan = buildSeaPlan(get, 'r1', 'A', 'B', seaMap.routes[0])!;
    set({ travelPlan: { ...plan, kmDone: plan.km - 5, sea: { ...plan.sea!, milesToday: 5 } } });
    continueSeaDayAfterCascade(get, set);
    resolveShoreLeave(get, set, true);
    expect(get().pendingCascade).toBeNull(); // 'I' (inline) — aucun siège MJ
    expect(get().journal.some((l) => l.includes('Événement de port'))).toBe(true);
  });

  it('seam de jet (#275 Ronde 1, delta 1) — Désertion : AVEC siège MJ ≠ hôte, l\'étape SURFACE et est OWNÉE par le MJ', async () => {
    const { setGmSeat } = await import('./netFlow');
    setGmSeat(get, set, 1);
    const plan = buildSeaPlan(get, 'r1', 'A', 'B', seaMap.routes[0])!;
    // daysAtSea non-nul + mer calme : évite le mal de mer (#460, MDG 14 l.211-222 — 1er jour/mauvais
    // temps) de surfacer AVANT la Désertion, seule étape que ce test veut ici.
    set({ travelPlan: { ...plan, kmDone: plan.km - 5, sea: { ...plan.sea!, daysAtSea: 5, milesToday: 5, weather: { ...plan.sea!.weather, vent: 'calme-plat' } } } });
    continueSeaDayAfterCascade(get, set);
    resolveShoreLeave(get, set, true);
    expect(get().pendingCascade).toBeTruthy(); // 'V' — surfacé au siège MJ, pas résolu d'office
    expect(get().journal.some((l) => l.includes('Événement de port'))).toBe(false); // suspendu AVANT la suite
    const { modalOwnerOf } = await import('./modalArbiter');
    const { seatOwns } = await import('./netOwnership');
    const owner = modalOwnerOf(get());
    expect(seatOwns(get(), 1, owner ?? undefined)).toBe(true);
    expect(seatOwns(get(), 0, owner ?? undefined)).toBe(false);
  });
});

describe('Entretien-survie maritime — #272 résiduel (Scorbut/Épuisement, policy de la PORTE `resolveSurface`, seam #275)', () => {
  beforeEach(freshState);

  it('Scorbut : SANS siège MJ résout INLINE (policy `subi`, I) — la journée continue jusqu’à la halte de nuit', () => {
    const plan = buildSeaPlan(get, 'r1', 'A', 'B', seaMap.routes[0])!;
    set({ travelPlan: { ...plan, sea: { ...plan.sea!, daysAtSea: 29, milesToday: 50 } } });
    continueSeaDayAfterCascade(get, set);
    expect(get().pendingCascade).toBeNull(); // 'I' — aucun siège MJ
    expect(get().pendingRest).toBeTruthy(); // la journée a repris jusqu'à la halte
    expect(get().journal.some((l) => l.toLowerCase().includes('scorbut'))).toBe(true);
  });

  it('Scorbut : AVEC siège MJ, l’étape SURFACE (V) — plus d’auto-résolution silencieuse ; la journée reprend après résolution', async () => {
    const { setGmSeat } = await import('./netFlow');
    setGmSeat(get, set, 1);
    const plan = buildSeaPlan(get, 'r1', 'A', 'B', seaMap.routes[0])!;
    set({ travelPlan: { ...plan, sea: { ...plan.sea!, daysAtSea: 29, milesToday: 50 } } });
    continueSeaDayAfterCascade(get, set);
    expect(get().pendingCascade).toBeTruthy();
    expect(get().pendingCascade!.purpose).toBe('seaScorbut');
    expect(get().pendingCascade!.participants.every((s) => s.kind === 'sea-scorbut')).toBe(true);
    let guard = 0;
    while (get().pendingCascade?.purpose === 'seaScorbut' && guard++ < 10) stepCascade();
    expect(get().pendingRest).toBeTruthy(); // jamais résolue en silence — la journée reprend malgré tout
    expect(get().journal.some((l) => l.toLowerCase().includes('scorbut'))).toBe(true); // parité recap/journal avec le chemin inline
  });

  it('Épuisement : SANS siège MJ résout INLINE (policy `subi`, I) — la journée continue jusqu’à la halte de nuit', () => {
    const plan = buildSeaPlan(get, 'r1', 'A', 'B', seaMap.routes[0])!;
    set({ travelPlan: { ...plan, sea: { ...plan.sea!, daysAtSea: 1, paceToday: 'won', milesToday: 50 } } });
    continueSeaDayAfterCascade(get, set);
    expect(get().pendingCascade).toBeNull();
    expect(get().pendingRest).toBeTruthy();
    expect(get().journal.some((l) => l.includes('Épuisement'))).toBe(true);
  });

  it('Épuisement : AVEC siège MJ, l’étape SURFACE (V) — la journée reprend après résolution', async () => {
    const { setGmSeat } = await import('./netFlow');
    setGmSeat(get, set, 1);
    const plan = buildSeaPlan(get, 'r1', 'A', 'B', seaMap.routes[0])!;
    // daysAtSea+1 = 2, non multiple de 30 → Scorbut ne se déclenche pas ce jour, seul Épuisement teste.
    set({ travelPlan: { ...plan, sea: { ...plan.sea!, daysAtSea: 1, paceToday: 'won', milesToday: 50 } } });
    continueSeaDayAfterCascade(get, set);
    expect(get().pendingCascade).toBeTruthy();
    expect(get().pendingCascade!.purpose).toBe('seaExhaustion');
    expect(get().pendingCascade!.participants.every((s) => s.kind === 'sea-epuisement')).toBe(true);
    let guard = 0;
    while (get().pendingCascade?.purpose === 'seaExhaustion' && guard++ < 10) stepCascade();
    expect(get().pendingRest).toBeTruthy();
    expect(get().journal.some((l) => l.includes('Épuisement'))).toBe(true);
  });
});

describe('Mal de mer — #460 (MDG 14 l.211-222, câblage jamais branché, cycle de maladie réutilisé)', () => {
  beforeEach(freshState);

  it('applier `sea-mal-de-mer` : échec → contracté (malaise/nausée/persistant)', () => {
    const hero = get().party[0];
    hero.diseases = [];
    cascadeAppliers['sea-mal-de-mer'].apply(get, set, { id: 'x', kind: 'sea-mal-de-mer', label: 'x', result: { roll: 99, target: 40, sl: -6, success: false }, interactive: true }, hero, { steps: [], index: 0 });
    const found = get().party.find((h) => h.id === hero.id)!.diseases?.find((d) => d.id === 'mal-de-mer');
    expect(found).toBeTruthy();
    expect(found!.symptoms.map((s) => s.symptomId).sort()).toEqual(['malaise', 'nausee', 'persistant']);
  });

  it('applier `sea-mal-de-mer` : réussite → rien', () => {
    const hero = get().party[0];
    hero.diseases = [];
    cascadeAppliers['sea-mal-de-mer'].apply(get, set, { id: 'x', kind: 'sea-mal-de-mer', label: 'x', result: { roll: 1, target: 40, sl: 6, success: true }, interactive: true }, hero, { steps: [], index: 0 });
    expect(get().party.find((h) => h.id === hero.id)!.diseases ?? []).toHaveLength(0);
  });

  it('1er jour de traversée (`daysAtSea === 0`) → une étape `sea-mal-de-mer` par PJ non-elfe', async () => {
    const { setGmSeat } = await import('./netFlow');
    setGmSeat(get, set, 1);
    const plan = buildSeaPlan(get, 'r1', 'A', 'B', seaMap.routes[0])!;
    set({ travelPlan: { ...plan, sea: { ...plan.sea!, daysAtSea: 0, weather: { ...plan.sea!.weather, vent: 'calme-plat' } } } });
    continueSeaDayAfterCascade(get, set);
    expect(get().pendingCascade).toBeTruthy();
    expect(get().pendingCascade!.purpose).toBe('seaScorbut'); // MÊME cascade « Entretien — Maladies » (#460)
    const kinds = get().pendingCascade!.participants.map((s) => s.kind);
    expect(kinds.filter((k) => k === 'sea-mal-de-mer')).toHaveLength(get().party.length); // 1 par PJ
  });

  it('mauvais temps (Vent violent ou plus, l.218) → une étape `sea-mal-de-mer`, même hors 1er jour', async () => {
    const { setGmSeat } = await import('./netFlow');
    setGmSeat(get, set, 1);
    const plan = buildSeaPlan(get, 'r1', 'A', 'B', seaMap.routes[0])!;
    set({ travelPlan: { ...plan, sea: { ...plan.sea!, daysAtSea: 5, weather: { ...plan.sea!.weather, vent: 'vent-violent' } } } });
    continueSeaDayAfterCascade(get, set);
    expect(get().pendingCascade).toBeTruthy();
    const kinds = get().pendingCascade!.participants.map((s) => s.kind);
    expect(kinds).toContain('sea-mal-de-mer');
  });

  it('ni 1er jour ni mauvais temps → aucune étape `sea-mal-de-mer` (jour de routine)', async () => {
    const { setGmSeat } = await import('./netFlow');
    setGmSeat(get, set, 1);
    const plan = buildSeaPlan(get, 'r1', 'A', 'B', seaMap.routes[0])!;
    set({ travelPlan: { ...plan, sea: { ...plan.sea!, daysAtSea: 5, weather: { ...plan.sea!.weather, vent: 'calme-plat' } } } });
    continueSeaDayAfterCascade(get, set);
    expect(get().pendingCascade).toBeNull();
    expect(get().pendingRest).toBeTruthy();
  });

  it('Personnage elfe (`hauts-elfes`) IMMUNISÉ (l.215) : aucune étape posée, même au 1er jour + mauvais temps', async () => {
    const { setGmSeat } = await import('./netFlow');
    setGmSeat(get, set, 1);
    const party = get().party.map((h) => ({ ...h, species: 'hauts-elfes' }));
    set({ party });
    const plan = buildSeaPlan(get, 'r1', 'A', 'B', seaMap.routes[0])!;
    set({ travelPlan: { ...plan, sea: { ...plan.sea!, daysAtSea: 0, weather: { ...plan.sea!.weather, vent: 'vent-violent' } } } });
    continueSeaDayAfterCascade(get, set);
    // Aucune maladie déclenchée du tout ce jour (ni tonneau — pas d'eau suivie — ni scorbut) : routine.
    expect(get().pendingCascade).toBeNull();
    expect(get().pendingRest).toBeTruthy();
  });

  it('déjà immunisé (`diseaseImmunities`) → aucune étape reposée', async () => {
    const { setGmSeat } = await import('./netFlow');
    setGmSeat(get, set, 1);
    const party = get().party.map((h) => ({ ...h, diseaseImmunities: ['mal-de-mer'] }));
    set({ party });
    const plan = buildSeaPlan(get, 'r1', 'A', 'B', seaMap.routes[0])!;
    set({ travelPlan: { ...plan, sea: { ...plan.sea!, daysAtSea: 0, weather: { ...plan.sea!.weather, vent: 'calme-plat' } } } });
    continueSeaDayAfterCascade(get, set);
    expect(get().pendingCascade).toBeNull();
    expect(get().pendingRest).toBeTruthy();
  });
});

describe('Tonneau d\'eau contaminé — #460 (MDG 14 l.209, `vessel.waterLitres` seul — la petite bière y échappe)', () => {
  beforeEach(freshState);

  it('applier `sea-tonneau-contamine` : échec → `sea.waterContaminated` posé (visible dès demain)', () => {
    const plan = buildSeaPlan(get, 'r1', 'A', 'B', seaMap.routes[0])!;
    set({ travelPlan: plan });
    const hero = get().party[0];
    cascadeAppliers['sea-tonneau-contamine'].apply(get, set, { id: 'x', kind: 'sea-tonneau-contamine', label: 'x', result: { roll: 99, target: 40, sl: -6, success: false }, interactive: true, meta: { diseaseId: 'flux-sanglant' } }, hero, { steps: [], index: 0 });
    expect(get().travelPlan!.sea!.waterContaminated).toEqual({ diseaseId: 'flux-sanglant' });
  });

  it('applier `sea-tonneau-contamine` : réussite → rien', () => {
    const plan = buildSeaPlan(get, 'r1', 'A', 'B', seaMap.routes[0])!;
    set({ travelPlan: plan });
    const hero = get().party[0];
    cascadeAppliers['sea-tonneau-contamine'].apply(get, set, { id: 'x', kind: 'sea-tonneau-contamine', label: 'x', result: { roll: 1, target: 40, sl: 6, success: true }, interactive: true, meta: { diseaseId: 'flux-sanglant' } }, hero, { steps: [], index: 0 });
    expect(get().travelPlan!.sea!.waterContaminated).toBeUndefined();
  });

  it('applier `sea-tonneau-expose` : boire au tonneau contaminé, échec → contracté', () => {
    const hero = get().party[0];
    hero.diseases = [];
    cascadeAppliers['sea-tonneau-expose'].apply(get, set, { id: 'x', kind: 'sea-tonneau-expose', label: 'x', result: { roll: 99, target: 20, sl: -8, success: false }, interactive: true, meta: { diseaseId: 'peste-noire' } }, hero, { steps: [], index: 0 });
    expect(get().party.find((h) => h.id === hero.id)!.diseases?.some((d) => d.id === 'peste-noire')).toBe(true);
  });

  it('applier `sea-tonneau-expose` : réussite → rien', () => {
    const hero = get().party[0];
    hero.diseases = [];
    cascadeAppliers['sea-tonneau-expose'].apply(get, set, { id: 'x', kind: 'sea-tonneau-expose', label: 'x', result: { roll: 1, target: 20, sl: 8, success: true }, interactive: true, meta: { diseaseId: 'peste-noire' } }, hero, { steps: [], index: 0 });
    expect(get().party.find((h) => h.id === hero.id)!.diseases ?? []).toHaveLength(0);
  });

  it('porteur ACTIF de peste noire buvant à `vessel.waterLitres` → une étape `sea-tonneau-contamine`', async () => {
    const { setGmSeat } = await import('./netFlow');
    setGmSeat(get, set, 1);
    const party = [...get().party];
    party[0] = { ...party[0], diseases: [contractDisease('peste-noire', makeRNG(1), { incubation: 0 })!] };
    set({ party, vessel: { ...get().vessel!, waterLitres: 1000 } });
    const plan = buildSeaPlan(get, 'r1', 'A', 'B', seaMap.routes[0])!;
    set({ travelPlan: { ...plan, sea: { ...plan.sea!, daysAtSea: 5, weather: { ...plan.sea!.weather, vent: 'calme-plat' } } } });
    continueSeaDayAfterCascade(get, set);
    expect(get().pendingCascade).toBeTruthy();
    const step = get().pendingCascade!.participants.find((s) => s.kind === 'sea-tonneau-contamine');
    expect(step).toBeTruthy();
    expect(step!.actorId).toBe(party[0].id);
  });

  it('SANS tonneau d\'eau suivi (`vessel.waterLitres` absent) → aucune étape de tonneau, même avec un porteur actif', async () => {
    const { setGmSeat } = await import('./netFlow');
    setGmSeat(get, set, 1);
    const party = [...get().party];
    party[0] = { ...party[0], diseases: [contractDisease('peste-noire', makeRNG(1), { incubation: 0 })!] };
    set({ party }); // vessel.waterLitres reste undefined (freshState)
    const plan = buildSeaPlan(get, 'r1', 'A', 'B', seaMap.routes[0])!;
    set({ travelPlan: { ...plan, sea: { ...plan.sea!, daysAtSea: 5, weather: { ...plan.sea!.weather, vent: 'calme-plat' } } } });
    continueSeaDayAfterCascade(get, set);
    expect(get().pendingCascade).toBeNull();
    expect(get().pendingRest).toBeTruthy();
  });

  it('tonneau DÉJÀ contaminé la veille → chaque PJ qui boit AUJOURD\'HUI est EXPOSÉ (`sea-tonneau-expose`)', async () => {
    const { setGmSeat } = await import('./netFlow');
    setGmSeat(get, set, 1);
    set({ vessel: { ...get().vessel!, waterLitres: 1000 } });
    const plan = buildSeaPlan(get, 'r1', 'A', 'B', seaMap.routes[0])!;
    set({ travelPlan: { ...plan, sea: { ...plan.sea!, daysAtSea: 5, weather: { ...plan.sea!.weather, vent: 'calme-plat' }, waterContaminated: { diseaseId: 'courante-galopante' } } } });
    continueSeaDayAfterCascade(get, set);
    expect(get().pendingCascade).toBeTruthy();
    const kinds = get().pendingCascade!.participants.map((s) => s.kind);
    expect(kinds.filter((k) => k === 'sea-tonneau-expose')).toHaveLength(get().party.length);
  });

  it('un PJ DÉJÀ porteur de la maladie du tonneau n\'est PAS re-testé (`contractionDue`)', async () => {
    const { setGmSeat } = await import('./netFlow');
    setGmSeat(get, set, 1);
    const party = [...get().party];
    party[0] = { ...party[0], diseases: [contractDisease('courante-galopante', makeRNG(1), { incubation: 0 })!] };
    set({ party, vessel: { ...get().vessel!, waterLitres: 1000 } });
    const plan = buildSeaPlan(get, 'r1', 'A', 'B', seaMap.routes[0])!;
    set({ travelPlan: { ...plan, sea: { ...plan.sea!, daysAtSea: 5, weather: { ...plan.sea!.weather, vent: 'calme-plat' }, waterContaminated: { diseaseId: 'courante-galopante' } } } });
    continueSeaDayAfterCascade(get, set);
    expect(get().pendingCascade).toBeTruthy();
    const kinds = get().pendingCascade!.participants.map((s) => s.kind);
    expect(kinds.filter((k) => k === 'sea-tonneau-expose')).toHaveLength(get().party.length - 1); // le porteur déjà malade est écarté
  });
});

describe('Périls en mer — collision routée par la DONNÉE (#444, MDG 13 l.475-499, zéro IC/chance en dur)', () => {
  beforeEach(freshState);

  /** Force le tirage sur UN péril donné (`pickSeaHazard`, poids MAISON) — mutation RESTAURÉE en `finally`. */
  function forceHazard(id: string): (number | undefined)[] {
    const original = SEA_HAZARDS.map((h) => h.weight);
    for (const h of SEA_HAZARDS) h.weight = h.id === id ? 1 : 0;
    return original;
  }
  function restoreWeights(original: (number | undefined)[]): void {
    SEA_HAZARDS.forEach((h, i) => { h.weight = original[i]; });
  }

  it('le dégât suit l’IC ÉDITÉ en donnée (pas 47 figé) — modifier `sea-perils.json` en mémoire change le résultat', () => {
    const original = forceHazard('rocher');
    const rocher = findSeaHazard('rocher')!;
    const originalIc = rocher.ic;
    try {
      rocher.ic = 5; // valeur ÉDITÉE, jamais l'ancien magic number 47
      const plan = buildSeaPlan(get, 'r1', 'A', 'B', seaMap.routes[0])!;
      set({ travelPlan: { ...plan, sea: { ...plan.sea!, forcedEventId: 'collision-soudaine' } } });
      runSeaDay(get, set);
      expect(get().journal.some((l) => l.includes('Rocher IC 5'))).toBe(true);
      expect(get().journal.some((l) => l.includes('IC 47'))).toBe(false);
    } finally {
      rocher.ic = originalIc;
      restoreWeights(original);
    }
  });

  it('Iceberg/Débris marins/Bas-fonds : chacun des 4 périls routés se résout (dégâts de coque encaissés)', () => {
    for (const id of ['iceberg', 'debris-marins', 'rocher', 'bas-fonds']) {
      freshState();
      const original = forceHazard(id);
      try {
        const plan = buildSeaPlan(get, 'r1', 'A', 'B', seaMap.routes[0])!;
        set({ travelPlan: { ...plan, sea: { ...plan.sea!, forcedEventId: 'collision-soudaine' } } });
        const before = get().travelPlan!.vehicle!.wounds.current;
        runSeaDay(get, set);
        const hazard = findSeaHazard(id)!;
        expect(get().journal.some((l) => l.includes(`${hazard.label} IC ${hazard.ic}`))).toBe(true);
        expect(get().travelPlan!.vehicle!.wounds.current).toBeLessThanOrEqual(before);
      } finally {
        restoreWeights(original);
      }
    }
  });

  it('Rocher/Bas-fonds : Échouage possible (`rollStranding`) → `sea.stranded` posé, dégagement = Test de Force (#444)', () => {
    const original = forceHazard('rocher');
    const rocher = findSeaHazard('rocher')!;
    const originalPct = rocher.strandChancePct;
    try {
      rocher.strandChancePct = 100; // force l'Échouage (garantit le branchement, indépendant du hasard)
      const plan = buildSeaPlan(get, 'r1', 'A', 'B', seaMap.routes[0])!;
      set({ travelPlan: { ...plan, sea: { ...plan.sea!, forcedEventId: 'collision-soudaine' } } });
      runSeaDay(get, set);
      expect(get().travelPlan!.sea!.stranded).toBeTruthy();
      expect(get().travelPlan!.sea!.stranded!.hazardId).toBe('rocher');
    } finally {
      rocher.strandChancePct = originalPct;
      restoreWeights(original);
    }
  });

  it('Débris marins : empêtrement possible (`rollDebrisEntangle`) → `sea.entangled` posé avec manDR/mMod de la donnée', () => {
    const original = forceHazard('debris-marins');
    const debris = findSeaHazard('debris-marins')!;
    const originalPct = debris.entangleChancePct;
    try {
      debris.entangleChancePct = 100; // force l'empêtrement
      const plan = buildSeaPlan(get, 'r1', 'A', 'B', seaMap.routes[0])!;
      set({ travelPlan: { ...plan, sea: { ...plan.sea!, forcedEventId: 'collision-soudaine' } } });
      runSeaDay(get, set);
      const entangled = get().travelPlan!.sea!.entangled;
      expect(entangled).toBeTruthy();
      expect(entangled!.hazardId).toBe('debris-marins');
      expect(entangled!.need).toBe(debris.freeTest!.totalDR); // cogue = Taille moyenne → bande moyenne/grande
      expect(entangled!.manDR).toBe(-1);
      expect(entangled!.mMod).toBe(0);
    } finally {
      debris.entangleChancePct = originalPct;
      restoreWeights(original);
    }
  });
});

describe('Échouage/Empêtrement — dégagement par Test de Force (#444, appliers `sea-degagement`/`sea-degagement-debris`)', () => {
  beforeEach(freshState);

  function planWithSea() {
    const plan = buildSeaPlan(get, 'r1', 'A', 'B', seaMap.routes[0])!;
    set({ travelPlan: plan });
    return plan;
  }
  function step(kind: string, sl: number, success = sl >= 1): CascadeStep {
    return { id: kind, kind, label: kind, result: { roll: 0, target: 0, sl, success }, interactive: true };
  }
  const apply = (kind: string, sl: number, success = sl >= 1) =>
    cascadeAppliers[kind].apply(get, set, step(kind, sl, success), undefined, { steps: [], index: 0 });

  it('sea-degagement : succès → `sea.stranded` levé', () => {
    const plan = planWithSea();
    set({ travelPlan: { ...plan, sea: { ...plan.sea!, stranded: { hazardId: 'rocher', label: 'Rocher', difficulty: 'difficile' } } } });
    apply('sea-degagement', 3, true);
    expect(get().travelPlan!.sea!.stranded).toBeUndefined();
  });

  it('sea-degagement : échec → `sea.stranded` PERSISTE (à retenter)', () => {
    const plan = planWithSea();
    set({ travelPlan: { ...plan, sea: { ...plan.sea!, stranded: { hazardId: 'rocher', label: 'Rocher', difficulty: 'difficile' } } } });
    apply('sea-degagement', -2, false);
    expect(get().travelPlan!.sea!.stranded).toBeTruthy();
  });

  it('sea-degagement-debris : Test ÉTENDU — cumule jusqu’au total DR de `hazard.freeTest`, puis lève `sea.entangled`', () => {
    const plan = planWithSea();
    set({ travelPlan: { ...plan, sea: { ...plan.sea!, entangled: { hazardId: 'debris-marins', label: 'Débris marins', need: 10, progress: 6, manDR: -1, mMod: 0, difficulty: 'accessible' } } } });
    apply('sea-degagement-debris', 5, true); // 6 + 5 = 11 ≥ 10 → dégagé
    expect(get().travelPlan!.sea!.entangled).toBeUndefined();
  });

  it('sea-degagement-debris : progression insuffisante → `sea.entangled` PERSISTE avec le total cumulé', () => {
    const plan = planWithSea();
    set({ travelPlan: { ...plan, sea: { ...plan.sea!, entangled: { hazardId: 'debris-marins', label: 'Débris marins', need: 10, progress: 0, manDR: -1, mMod: 0, difficulty: 'accessible' } } } });
    apply('sea-degagement-debris', 3, true);
    expect(get().travelPlan!.sea!.entangled?.progress).toBe(3);
  });

  it('ÉCHOUÉ : aucune Progression le temps du dégagement (`buildSeaDayCascade` route un Test de Force, milesToday reste à 0)', () => {
    const plan = planWithSea();
    set({ travelPlan: { ...plan, sea: { ...plan.sea!, stranded: { hazardId: 'rocher', label: 'Rocher', difficulty: 'intermediaire' } } } });
    runSeaDay(get, set);
    expect(get().travelPlan!.sea!.milesToday).toBe(0);
    expect(get().journal.some((l) => l.includes('ÉCHOUÉ'))).toBe(true);
  });
});

describe('Survitesse — « Ça va lâcher, capitaine ! » (#443, MDG 13 l.121-142)', () => {
  beforeEach(freshState);
  afterEach(() => resetRule('sea-overspeed-tests-per-day'));

  // Cogue : sail.m = 5 (M de conception). Légère brise + vent arrière/latéral = pctSail 0 (aucun mod de
  // vent) → `eff.m` dépend UNIQUEMENT de `eventMMod` (deterministe, aucun bruit de la météo tirée).
  function planWithSea(eventMMod?: number) {
    const plan = buildSeaPlan(get, 'r1', 'A', 'B', seaMap.routes[0])!;
    const sea = {
      ...plan.sea!,
      weather: { ...plan.sea!.weather, vent: 'legere-brise' as const },
      windFrom: 'ouest' as const, // heading 'est' + vent d'ouest → aspect ARRIÈRE (pctSail 0)
      ...(eventMMod != null ? { eventMMod } : {}),
    };
    set({ travelPlan: { ...plan, sea } });
    return plan;
  }
  function step(kind: string, sl: number, success = sl >= 1, meta?: Record<string, number>): CascadeStep {
    return { id: kind, kind, label: kind, result: { roll: 0, target: 0, sl, success }, interactive: true, meta };
  }
  const apply = (kind: string, sl: number, success = sl >= 1, meta?: Record<string, number>) =>
    cascadeAppliers[kind].apply(get, set, step(kind, sl, success, meta), undefined, { steps: [], index: 0 });

  it('pas de survitesse (M dans les clous, ≤ M+4) → la Progression n’insère aucun Test de survitesse', () => {
    planWithSea(); // aucun eventMMod → M 5, sous le seuil M+4 (safeBonus)
    const out = apply('progression', 2, true);
    expect(get().travelPlan!.sea!.effMToday).toBeLessThanOrEqual(9); // baseM(5) + safeBonus(4)
    expect(out?.insert?.some((s) => s.kind === 'sea-overspeed')).toBeFalsy();
  });

  it('survitesse (eventMMod +5 → M+5) → la Progression insère un Test de survitesse (ligne « ÇA VA LÂCHER, CAPITAINE ! »)', () => {
    planWithSea(5); // baseM_local 5+5=10, vent neutre (pctSail 0) → eff.m 10 = M+5
    const out = apply('progression', 2, true);
    expect(get().travelPlan!.sea!.effMToday).toBe(10);
    const row = overspeedRow(5, 10)!;
    expect(row).toMatchObject({ difficulty: 'accessible', per: 'heure', damage: 1 }); // M+5
    const st = out?.insert?.find((s) => s.kind === 'sea-overspeed');
    expect(st).toBeTruthy();
    expect(st!.meta?.overspeedDamage).toBe(row.damage);
    expect(st!.actorId).toBeTruthy(); // « Test de parti », cf. `buildOverspeedStep` (`state/seaVoyageFlow.ts`) : jamais un jet sans acteur visible
  });

  it('applier sea-overspeed : échec du Test de Résistance → Dégâts de coque = damage + X (X = DR négatifs), routés par damageVesselHull (#296)', () => {
    const plan = planWithSea();
    plan.vehicle!.wounds.current = plan.vehicle!.wounds.max;
    const before = plan.vehicle!.wounds.current;
    apply('sea-overspeed', -5, false, { overspeedDamage: 1 }); // ligne M+5 : 1+X, X=5 → 6
    expect(get().travelPlan!.vehicle!.wounds.current).toBe(before - 6);
    expect(get().vessel!.wounds!.current).toBe(before - 6); // persisté (#296)
  });

  it('applier sea-overspeed : succès → aucun Dégât', () => {
    const plan = planWithSea();
    plan.vehicle!.wounds.current = plan.vehicle!.wounds.max;
    const before = plan.vehicle!.wounds.current;
    apply('sea-overspeed', 3, true, { overspeedDamage: 1 });
    expect(get().travelPlan!.vehicle!.wounds.current).toBe(before);
  });

  it('données éditées (`sea-navigation.json` via `overspeedRow`) : le Test de survitesse suit le tableau — bande extrême « M+9 ou plus » → damage 8', () => {
    planWithSea(20); // baseM_local 5+20=25, vent neutre → eff.m 25 = M+20 (plafonné par la table à « M+9 ou plus »)
    const row = overspeedRow(5, 25)!;
    expect(row.damage).toBe(8); // « M+9 ou plus » — le calcul de la ligne suit la DONNÉE, jamais une valeur en dur
    const out = apply('progression', 2, true);
    const st = out?.insert?.find((s) => s.kind === 'sea-overspeed');
    expect(st!.meta?.overspeedDamage).toBe(8);
  });

  it('règle éditable `sea-overspeed-tests-per-day` (#443, cadence infra-journalière mappée sur le jour) : N=2 → deux Tests de survitesse insérés', () => {
    setRule('sea-overspeed-tests-per-day', 2);
    planWithSea(5);
    const out = apply('progression', 2, true);
    expect(out?.insert?.filter((s) => s.kind === 'sea-overspeed').length).toBe(2);
  });

  // Navire MIXTE : Langskip (sail.m 4, oars.m 6, distincts — #524). Le référent M de conception DOIT
  // suivre le mode PERSISTÉ du jour (`sea.modeToday`), jamais la voile par défaut.
  function planLangskip(modeToday: 'voile' | 'avirons', effMToday: number) {
    set({ vessel: { ...get().vessel!, vehicleId: 'langskip' } });
    const plan = buildSeaPlan(get, 'r1', 'A', 'B', seaMap.routes[0])!;
    const sea = { ...plan.sea!, milesToday: 1, effMToday, modeToday };
    set({ travelPlan: { ...plan, sea } });
    return plan;
  }

  it('navire MIXTE, modeToday=avirons → bande de survitesse calculée sur oars.m (Langskip : sail.m 4, oars.m 6)', () => {
    planLangskip('avirons', 11); // oars.m 6 → M+5 (safeBonus 4)
    const [st] = buildOverspeedSteps(get);
    expect(st).toBeTruthy();
    expect(st!.stake).toContain('Survitesse M+5'); // référent M = oars.m 6 — le surplus se LIT sur la note d'enjeu
    expect(st!.meta?.overspeedDamage).toBe(overspeedRow(6, 11)!.damage);
  });

  it('navire MIXTE, modeToday=voile → bande de survitesse calculée sur sail.m (Langskip : sail.m 4, oars.m 6)', () => {
    planLangskip('voile', 11); // sail.m 4 → M+7
    const [st] = buildOverspeedSteps(get);
    expect(st).toBeTruthy();
    expect(st!.stake).toContain('Survitesse M+7'); // référent M = sail.m 4
    expect(st!.meta?.overspeedDamage).toBe(overspeedRow(4, 11)!.damage);
  });

  it('navire à AVIRONS SEULS (Chaloupe, sail absent) → référent avirons même sans `modeToday` persisté (repli `vesselPropulsion`)', () => {
    set({ vessel: { ...get().vessel!, vehicleId: 'chaloupe' } });
    const plan = buildSeaPlan(get, 'r1', 'A', 'B', seaMap.routes[0])!;
    const sea = { ...plan.sea!, milesToday: 1, effMToday: 9 }; // oars.m 3 → M+6, pas de modeToday
    set({ travelPlan: { ...plan, sea } });
    const [st] = buildOverspeedSteps(get);
    expect(st).toBeTruthy();
    expect(st!.stake).toContain('Survitesse M+6'); // référent M = oars.m 3
    expect(st!.meta?.overspeedDamage).toBe(overspeedRow(3, 9)!.damage);
  });
});

/**
 * #1104(b) — EXPOSITION du jour de mer (MDG 13 l.203-225) : chaque Test de la Période de travail est
 * une ÉTAPE influençable (héros × Tests de la bande), toutes dans UNE cascade du jour — plus de
 * résolution synchrone dont le journal était la seule surface. Même applier d'escalade que la nuit
 * (`kind: 'exposure'`, restFlow) : le cumul des échecs d'un héros reste RAW.
 */
describe('Exposition en mer — une étape influençable par Test, une cascade par jour (#1104b)', () => {
  beforeEach(freshState);

  /** Plan de mer par temps GLACIAL (bande à 2 h → 4 Tests par héros, Difficulté Intermédiaire). */
  function glacialDay() {
    const plan = buildSeaPlan(get, 'r1', 'A', 'B', seaMap.routes[0])!;
    set({ travelPlan: { ...plan, sea: { ...plan.sea!, daysAtSea: 1, milesToday: 50, weather: { ...plan.sea!.weather, temperature: 'glaciale' } } } });
  }

  it('AVEC siège MJ : UNE cascade `seaExposure` porte héros × Tests de la bande, chaque ligne DIT sa Difficulté', async () => {
    const { setGmSeat } = await import('./netFlow');
    setGmSeat(get, set, 1);
    glacialDay();
    continueSeaDayAfterCascade(get, set);
    const casc = get().pendingCascade!;
    expect(casc.purpose).toBe('seaExposure');
    const living = get().party.filter((h) => !h.dead).length;
    expect(casc.participants).toHaveLength(living * 4); // 4 Tests/jour (bande 2 h sur 8 h de pont)
    expect(casc.participants.every((s) => s.kind === 'exposure')).toBe(true); // applier d'escalade PARTAGÉ
    expect(casc.participants.every((s) => s.difficulty === 'intermediaire')).toBe(true);
    expect(casc.participants.every((s) => s.interactive)).toBe(true); // aucun jet hors de portée du joueur
    let guard = 0;
    while (get().pendingCascade?.purpose === 'seaExposure' && guard++ < 40) stepCascade();
    expect(get().pendingRest).toBeTruthy(); // la journée reprend jusqu'à la halte
  });

  it('SANS siège MJ : résolution INLINE (policy `subi`, I) — la journée va jusqu’à la halte, les lignes sont au journal', () => {
    glacialDay();
    continueSeaDayAfterCascade(get, set);
    expect(get().pendingCascade).toBeNull();
    expect(get().pendingRest).toBeTruthy();
  });

  it('un héros sous protection magique ne reçoit AUCUNE étape (le Test n’a pas lieu)', async () => {
    const { setGmSeat } = await import('./netFlow');
    setGmSeat(get, set, 1);
    const party = get().party.map((h, i) => (i === 0 ? { ...h, activeEffects: [...(h.activeEffects ?? []), { label: 'Abri', weatherImmune: true, duration: { scale: 'permanent' as const } }] } : h));
    set({ party } as never);
    glacialDay();
    continueSeaDayAfterCascade(get, set);
    const casc = get().pendingCascade!;
    expect(casc.participants.some((s) => s.actorId === party[0].id)).toBe(false);
    expect(casc.participants).toHaveLength((party.length - 1) * 4);
  });
});

/**
 * #1104(b) — DISSIPATION des pénalités d'Exposition (purge #T3) : une pénalité subie un jour FROID
 * s'échoit 24 h après (`duration.scale: 'clock'`), y compris si les jours suivants sont CLÉMENTS.
 * Régression réelle du lot : la purge, placée dans la branche « il fait froid aujourd'hui » ET AVANT
 * l'application des échecs, laissait la pénalité PERMANENTE — aucun des Tests existants ne le voyait.
 */
describe('Exposition en mer — les pénalités subies s’échoient à 24 h, jamais permanentes (#1104b)', () => {
  beforeEach(freshState);

  /** Échelles de durée des pénalités d'Exposition portées par le groupe. */
  const exposureScales = (): string[] => get().party
    .flatMap((h) => (h.activeEffects ?? []).filter((e) => String(e.effectId).startsWith('exposition')))
    .map((e) => e.duration.scale);

  /** Joue UN jour de mer de température `temperature` (clôture comprise), sans siège MJ (résolution I). */
  function seaDay(temperature: 'glaciale' | 'mediane'): void {
    const plan = get().travelPlan ?? buildSeaPlan(get, 'r1', 'A', 'B', seaMap.routes[0])!;
    set({ travelPlan: { ...plan, sea: { ...plan.sea!, daysAtSea: 1, milesToday: 50, weather: { ...plan.sea!.weather, temperature } } } });
    set({ pendingRest: null });
    continueSeaDayAfterCascade(get, set);
  }

  it('un jour GLACIAL pose des pénalités, et la journée leur donne une horloge (jamais `permanent`)', () => {
    // Dé maximal : les Tests d'Exposition échouent → les pénalités tombent à coup sûr.
    seedBattleRng(3);
    set({ party: get().party.map((h) => ({ ...h, characteristics: { ...h.characteristics, endurance: 1 } })) } as never);
    seaDay('glaciale');
    expect(exposureScales().length).toBeGreaterThan(0); // des pénalités ont bien été subies
    expect(exposureScales()).not.toContain('permanent'); // toutes portent leur horloge de 24 h
  });

  it('les jours CLÉMENTS suivants n’oublient personne : aucune pénalité ne reste `permanent`', () => {
    seedBattleRng(3);
    set({ party: get().party.map((h) => ({ ...h, characteristics: { ...h.characteristics, endurance: 1 } })) } as never);
    seaDay('glaciale');
    const subies = exposureScales().length;
    expect(subies).toBeGreaterThan(0);
    seaDay('mediane'); // tempérée : AUCUN Test d'Exposition ce jour-là
    seaDay('mediane');
    expect(exposureScales()).not.toContain('permanent');
    expect(exposureScales()).toHaveLength(subies); // les pénalités existent toujours, mais horlogées
  });
});

/**
 * #1117 — le SOUTIEN doit atteindre la CIBLE du Test : « Chaque Personnage qui apporte son soutien
 * octroie un bonus de +10 au Test » (LDB 12, fiche `soutien`). `partyAssisted` rend la valeur
 * SOUTENUE ; trois étapes la posaient en `base` mais recalculaient leur cible depuis la carac NUE
 * (`effectiveTarget` sans `baseOverride`) — les soutiens n'amélioraient RIEN, et le réconciliateur
 * comblait l'écart par une chip « autres ». Invariant UNIVERSEL vérifié ici : sur toute étape qui
 * porte un `support`, l'écart base→cible s'explique par la SEULE Difficulté.
 */
describe('Soutien — il entre dans la CIBLE de toute étape soutenue (#1117)', () => {
  beforeEach(freshState);

  /** Le groupe de test soutient VRAIMENT : chaque pregen reçoit les Compétences des étapes visées
   *  (le Soutien exige un avancement dans la Compétence testée — LDB 12 l.195). */
  function partyThatSupports() {
    set({
      party: get().party.map((h) => ({
        ...h,
        skills: [
          ...h.skills.filter((sk) => !['voile', 'ramer', 'resistance'].includes(sk.skillId)),
          { skillId: 'voile', advances: 10 },
          { skillId: 'ramer', advances: 10 },
          { skillId: 'resistance', advances: 10 },
        ],
      })),
    } as never);
  }

  /** Part de l'écart base→cible que la ligne n'explique PAS. Tout ce qu'elle SAIT dire s'en retire :
   *  la Difficulté (texte de la ligne), les modificateurs NOMMÉS de l'étape (`mods`) et l'écrêtage
   *  MESURÉ (`clamped`, rendu « plafond 99 »). Le Soutien, lui, est fondu dans `base`. Reste > 0 ⇒
   *  le réconciliateur de `RollLine` avouera une chip « autres » : un fait que personne ne nomme. */
  const inexplique = (st: CascadeStep): number =>
    (st.target ?? 0) - (st.base ?? 0)
    - DIFFICULTY_MODIFIERS[st.difficulty!]
    - (st.mods ?? []).reduce((sum, m) => sum + m.value, 0)
    - (st.clamped ?? 0);

  /** Toutes les étapes SOUTENUES posées par la cascade courante. */
  function soutenues(): CascadeStep[] {
    const p = get().pendingCascade;
    return (p?.participants ?? []).filter((st) => (st.support?.bonus ?? 0) > 0 && st.target != null);
  }

  function seaDay(patch: Record<string, unknown>) {
    partyThatSupports();
    const plan = buildSeaPlan(get, 'r1', 'A', 'B', seaMap.routes[0], { pace: 1 })!;
    set({ travelPlan: { ...plan, sea: { ...plan.sea!, ...patch } } });
  }

  it('« Forcer le rythme » : la cible porte le Soutien (aucun résidu)', () => {
    seaDay({ forcePace: 1, paceToday: undefined });
    runSeaDay(get, set);
    const st = soutenues().find((x) => x.kind === 'sea-force-pace');
    expect(st, 'l’étape de Forcer le rythme est posée ET soutenue').toBeTruthy();
    expect(st!.support!.bonus, 'des soutiens contribuent').toBeGreaterThan(0);
    expect(inexplique(st!), 'aucune chip « autres » : tout est nommé').toBe(0);
  });

  it('« Dégagement » (échouage) : la cible porte le Soutien (aucun résidu)', () => {
    seaDay({ stranded: { label: 'un banc de sable', difficulty: 'intermediaire' } });
    runSeaDay(get, set);
    const st = soutenues().find((x) => x.kind === 'sea-degagement');
    expect(st, 'l’étape de Dégagement est posée ET soutenue').toBeTruthy();
    expect(inexplique(st!), 'aucune chip « autres » : tout est nommé').toBe(0);
  });

  it('« Survitesse » : la cible porte le Soutien (aucun résidu)', () => {
    seaDay({ forcePace: 1, milesToday: 50, effMToday: 12 });
    const steps = buildOverspeedSteps(get);
    const soutenue = steps.filter((st) => (st.support?.bonus ?? 0) > 0);
    expect(soutenue.length, 'au moins une étape de survitesse SOUTENUE').toBeGreaterThan(0);
    for (const st of soutenue) expect(inexplique(st), 'aucune chip « autres » : tout est nommé').toBe(0);
  });

  it('le Soutien atteint le JET RÉEL, pas seulement l’affichage (cible roulée)', () => {
    seaDay({ forcePace: 1, paceToday: undefined });
    runSeaDay(get, set);
    const st = soutenues().find((x) => x.kind === 'sea-force-pace')!;
    const attendu = st.target!;
    get().cascadeRoll(st.id);
    const roule = (get().pendingCascade!.participants.find((x) => x.id === st.id))!;
    expect(roule.result, 'le jet a bien eu lieu').toBeTruthy();
    expect(roule.result!.target, 'la cible ROULÉE est la cible soutenue').toBe(attendu);
    // Et cette cible vaut bien la base SOUTENUE ± Difficulté (le +Soutien n’a pas été rejoué ailleurs).
    expect(attendu).toBe(st.base! + DIFFICULTY_MODIFIERS[st.difficulty!]);
  });

  it('voie « Navigation » : une base SOUTENUE qui franchit le plafond NOMME son écrêtage', () => {
    partyThatSupports();
    // Un barreur très compétent : base soutenue > 99 → la cible est écrêtée, et l'écart doit se NOMMER.
    set({
      party: get().party.map((h, i) => (i !== 0 ? h : {
        ...h,
        skills: [...h.skills.filter((sk) => sk.skillId !== 'voile'), { skillId: 'voile', advances: 80 }],
      })),
    } as never);
    const plan = buildSeaPlan(get, 'r1', 'A', 'B', seaMap.routes[0], { pace: 1 })!;
    set({ travelPlan: plan });
    runSeaDay(get, set);
    // Répond « Navigation » au choix de Progression (MDG 14 l.63).
    for (let i = 0; i < 30; i++) {
      const p = get().pendingCascade;
      if (!p) break;
      const cur = p.participants[p.cursor];
      if (cur?.kind === 'sea-progression-choice') { get().cascadeChoose(cur.id, 'nav'); get().cascadeNext(); break; }
      stepCascade();
    }
    const nav = get().pendingCascade!.participants.find((x) => x.kind === 'sea-progression-nav');
    expect(nav, 'la voie Navigation est posée').toBeTruthy();
    expect(nav!.base!, 'la base soutenue franchit bien le plafond (sinon le cas ne prouve rien)').toBeGreaterThan(99);
    // Le CONTRAT d'abord (ce que le joueur lit), le mécanisme ensuite (ce qui le produit).
    expect(inexplique(nav!), 'aucune chip « autres » sur la voie Navigation').toBe(0);
    expect(nav!.clamped, 'l’écrêtage est MESURÉ à la construction').toBeTruthy();
  });
});

/**
 * #1117 volet E — l'ENJEU d'un Test d'équipage disait la règle-cadre (« ce Test peut être remplacé
 * par un Test d'équipage »), qui n'apprend rien au joueur sur ce qu'il risque. Deux contrats :
 * l'enjeu AFFICHÉ décrit l'EFFET du jet (catalogue `voyage-stakes.json`), et le VERBATIM MDG 14 se
 * lit à un clic (fiche `regles.json` portée par le type). Et le choix ouvert par MDG 14 l.63
 * (« vous pouvez effectuer un Test d'équipage au lieu d'un Test de Navigation ») est POSÉ au joueur.
 */
describe('Tests d’équipage — enjeu d’EFFET, règle en fiche, choix de Progression (#1117)', () => {
  beforeEach(freshState);

  it('la Progression PROPOSE les deux voies RAW, équipage par défaut', () => {
    get().startTravel('r1', 'mer');
    const p = get().pendingCascade!;
    const choix = p.participants.find((s) => s.kind === 'sea-progression-choice');
    expect(choix, 'le choix est POSÉ, jamais tranché en silence').toBeTruthy();
    expect(choix!.options!.map((o) => o.key)).toEqual(['crew', 'nav']);
    expect(choix!.defaultChoice, 'cadence commandée = voie d’équipage').toBe('crew');
  });

  it('« Navigation » retenue → un Test MONO de Voile/Ramer, et la journée continue pareil', () => {
    get().startTravel('r1', 'mer');
    for (let i = 0; i < 30; i++) {
      const p = get().pendingCascade;
      if (!p) break;
      const cur = p.participants[p.cursor];
      if (cur?.kind === 'sea-progression-choice') { get().cascadeChoose(cur.id, 'nav'); get().cascadeNext(); break; }
      stepCascade();
    }
    const nav = get().pendingCascade!.participants.find((s) => s.kind === 'sea-progression-nav');
    expect(nav, 'la voie Navigation est insérée').toBeTruthy();
    expect(nav!.participants, 'voie MONO : un barreur, pas un batch d’équipage').toBeUndefined();
    expect(['Voile', 'Ramer']).toContain(nav!.rollLabel);
  });

  it('l’enjeu d’une étape d’équipage dit son EFFET, jamais la règle-cadre de substitution', () => {
    get().startTravel('r1', 'mer');
    let vus = 0;
    for (let i = 0; i < 40; i++) {
      const p = get().pendingCascade;
      if (!p) break;
      for (const st of p.participants) {
        if (!st.participants || !st.stake) continue;
        vus += 1;
        expect(st.stake, `« ${st.kind} » : l’enjeu ne récite pas la règle-cadre`).not.toMatch(/peut être remplacé|au lieu d'un Test de Navigation/);
        expect(st.stakeRule?.id, `« ${st.kind} » : la règle MDG reste à un clic`).toMatch(/^test-equipage-/);
      }
      stepCascade();
    }
    expect(vus, 'au moins une étape d’équipage a été mesurée').toBeGreaterThan(0);
  });
});
