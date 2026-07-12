import { describe, it, expect, beforeEach } from 'vitest';
import { useGame } from './store';
import { buildRiverPlan, runRiverDays, hasBatelier, applyEchouage } from './riverVoyageFlow';
import { seedBattleRng } from './battleRng';
import { createHero, skillCharacteristicById } from '../engine/character';
import { makeRNG } from '../engine/dice';
import { buildScene } from './mapSpec';
import type { Combatant, SkillInstance } from '../engine/types';
import type { MapRoute, WorldMap } from './worldMap';

/**
 * VOYAGE FLUVIAL (T2C ch.5) — la descente du Reik en barge JOUÉE jour par jour. Depuis la Phase B, TOUS
 * les jets du JOUR (Agilité de rame, Navigation, Louvoyage, sauvegardes de vent, évitement des périls)
 * passent par la MÊME cascade influençable (Chance/Pacte/Résilience) que la nuit — plus d'auto-résolution
 * inline. La cascade du jour (`purpose:'travelDay'`) se clôt sur le calcul des km (IDENTIQUE à l'ancien
 * chemin) puis enchaîne la halte de nuit / l'arrivée ; la nuit reste la cascade de repos (Phase A).
 */
const get = useGame.getState.bind(useGame);
const set = useGame.setState.bind(useGame);

function skill(c: Combatant, skillId: string, advances: number, spec?: string): void {
  const ex = c.skills.find((s) => s.skillId === skillId && (s.spec ?? null) === (spec ?? null));
  if (ex) ex.advances = Math.max(ex.advances, advances);
  else c.skills.push({ skillId, spec, characteristic: skillCharacteristicById(skillId), advances } as SkillInstance);
}

/** Un équipage de barge : Gunnar le batelier (Ramer/Voile), plus deux passagers sans compétence de marin. */
function crew(withSavoir = false): Combatant[] {
  const gunnar = createHero({ speciesId: 'humains-reiklander', careerId: 'batelier', name: 'Gunnar', motivation: 'x', rng: makeRNG(11), id: 'r-gunnar' });
  skill(gunnar, 'ramer', 50);
  skill(gunnar, 'voile', 45);
  skill(gunnar, 'metier', 40, 'Construction de bateaux');
  const otto = createHero({ speciesId: 'humains-reiklander', careerId: 'garde', name: 'Otto', motivation: 'x', rng: makeRNG(12), id: 'r-otto' });
  const lise = createHero({ speciesId: 'humains-reiklander', careerId: 'erudit', name: 'Lise', motivation: 'x', rng: makeRNG(13), id: 'r-lise' });
  const trio = [gunnar, otto, lise];
  if (withSavoir) for (const h of trio) skill(h, 'savoir', 40, 'voies-fluviales');
  return trio;
}

const route = (km: number, extra: Partial<MapRoute> = {}): MapRoute => ({
  id: 'r-reik', a: 'A', b: 'B', km, modes: ['barge', 'pied'], river: true, inns: true, perilDie: 0, ...extra,
});

function riverMap(km: number, extra: Partial<MapRoute> = {}): WorldMap {
  return {
    id: 'm', nom: 'Le Reik',
    places: [
      { id: 'A', label: 'Grünburg', pos: { x: 0, y: 0 }, scene: 'quai-a' },
      { id: 'B', label: 'Altdorf', pos: { x: 90, y: 0 }, scene: 'quai-b' },
    ],
    routes: [route(km, extra)],
  };
}

const quai = (id: string, nom: string) => buildScene({ id, nom, description: '.', size: [8, 6], terrain: 'planches', heroStart: [2, 3] });

/** Charge le projet (2 quais + carte) et l'équipage, au quai de Grünburg. */
function launch(withSavoir = false, km = 45, extra: Partial<MapRoute> = {}): void {
  seedBattleRng(7);
  const g = get();
  g.setParty(crew(withSavoir));
  g.loadProject([quai('quai-a', 'Grünburg'), quai('quai-b', 'Altdorf')], 'quai-a', riverMap(km, extra));
  set({ money: { gold: 500, silver: 0, brass: 0 }, travelPlan: null, pendingRest: null, pendingCascade: null, travelRecap: null, journal: [] });
}

/** Déroule la cascade OUVERTE (jour ou nuit) : roule chaque étape-jet puis avance jusqu'à sa clôture.
 *  S'arrête dès qu'un pendingRest apparaît (halte de nuit) ou que la cascade se ferme. */
function drainCascade(): void {
  let g = 0;
  while (get().pendingCascade && g++ < 200) {
    const p = get().pendingCascade!;
    const cur = p.participants[p.cursor];
    if (cur && cur.target != null && !cur.result) get().cascadeRoll(cur.id);
    else get().cascadeNext();
  }
}

describe('buildRiverPlan — la descente exige un batelier et une embarcation', () => {
  beforeEach(() => launch());

  it('construit un plan fluvial (mode barge, coque, état de vent) avec un batelier', () => {
    const plan = buildRiverPlan(get, 'r-reik', 'A', 'B', get().worldMap!.routes[0])!;
    expect(plan.mode).toBe('barge');
    expect(plan.river).toBeTruthy();
    expect(plan.vehicle!.wounds.max).toBe(60); // coque de barge (vehicles.json : B60)
    expect(['calme', 'leger', 'modere', 'fort', 'tres-fort']).toContain(plan.river!.windForce);
  });

  it('sans batelier (aucune avance Voile/Ramer) → null → repli transport payant', () => {
    const noSailors = crew().map((h) => ({ ...h, skills: h.skills.filter((s) => s.skillId !== 'ramer' && s.skillId !== 'voile') }));
    expect(hasBatelier(noSailors)).toBe(false);
    set({ party: noSailors });
    expect(buildRiverPlan(get, 'r-reik', 'A', 'B', get().worldMap!.routes[0])).toBeNull();
  });
});

describe('cascade du JOUR fluvial — tous les jets sont influençables (purpose travelDay)', () => {
  beforeEach(() => launch());

  it('startTravel(barge) OUVRE une cascade travelDay dont les étapes-jet sont influençables', () => {
    get().startTravel('r-reik', 'barge');
    const pc = get().pendingCascade;
    expect(pc?.purpose).toBe('travelDay'); // le jour ne s'auto-résout plus : il ouvre la cascade
    // Au moins une étape-jet influençable (Agilité, Navigation) est présente dans les participants.
    const jetSteps = pc!.participants.filter((s) => s.target != null);
    expect(jetSteps.length).toBeGreaterThan(0);
    expect(pc!.participants.some((s) => s.kind === 'riverAgility')).toBe(true);
    expect(pc!.participants.some((s) => s.kind === 'riverNav')).toBe(true);
    // La 1ʳᵉ étape porte un jet à lancer (result null tant qu'on n'a pas roulé) → INFLUENÇABLE.
    const cur = pc!.participants[pc!.cursor];
    expect(cur.target).not.toBeNull();
    expect(cur.result ?? null).toBeNull();
  });

  it('le jour affiche le vent + les Tests de Navigation/Agilité une fois la cascade déroulée', () => {
    get().startTravel('r-reik', 'barge');
    drainCascade();
    const j = get().journal.join('\n');
    expect(j).toContain('Vent du jour'); // table des vents (l.21)
    expect(j).toMatch(/cap|barre|contrôle/); // conséquence de Navigation de l'étape (l.15), #295 Lot 1
    expect(j).toMatch(/rame|vitesse/); // conséquence d'Agilité de rame (l.17)
    expect(j).toContain('Progression du jour');
    // ENCHAÎNEMENT : la journée s'achève sur une halte de nuit OU l'arrivée (45 km ≈ une journée de barge).
    expect(get().pendingRest || get().scene?.id === 'quai-b').toBeTruthy();
  });

  it('un pilote doté de Savoir (Voies fluviales) le voit crédité au Test de Navigation (+1 DR, l.13)', () => {
    launch(true);
    get().startTravel('r-reik', 'barge');
    drainCascade();
    // #295 Lot 1 : la conséquence ne re-précise plus le montant du bonus (déjà intégré au jet visible
    // au-dessus) — elle NARRE l'effet (le Savoir rattrape la barre in extremis).
    expect(get().journal.join('\n')).toContain('Savoir Voies fluviales');
  });
});

/**
 * PARITÉ RNG (à graine fixe) : la mise en scène en cascade ne change RIEN aux issues RAW — mêmes km
 * parcourus, mêmes Dégâts de coque, même état fluvial qu'AVANT la Phase B. Valeurs golden capturées sur
 * l'ancien chemin inline (probe) : seed 7/45km → 12 km, coque 60/60 ; seed 5 + débris → 12 km, coque 40/60 ;
 * seed 3 + Très fort de côté (chavirage) → 12 km (dérive), coque 60/60, non coulé.
 */
describe('PARITÉ — km / Dégâts de coque IDENTIQUES à l\'ancien chemin inline (graine égale)', () => {
  it('seed 7 / 45 km / sans Savoir → 12 km, coque intacte, halte de nuit', () => {
    launch(false, 45);
    seedBattleRng(7);
    get().startTravel('r-reik', 'barge');
    drainCascade();
    const plan = get().travelPlan!;
    expect(plan.kmDone).toBe(12);
    expect(plan.vehicle!.wounds.current).toBe(60);
    expect(plan.river!.daysAfloat).toBe(1);
    expect(get().pendingRest).toBeTruthy(); // halte de nuit (45 km non atteints en un jour)
  });

  it('seed 5 / débris (chance 100 %) → 12 km, coque 40/60 (20 Dégâts de collision)', () => {
    launch(false, 45, { riverPerils: [{ perilId: 'debris', chancePct: 100 }] });
    seedBattleRng(5);
    get().startTravel('r-reik', 'barge');
    drainCascade();
    const plan = get().travelPlan!;
    expect(plan.kmDone).toBe(12);
    expect(plan.vehicle!.wounds.current).toBe(40); // débris : 20 Dégâts (parité inline)
    expect(get().journal.join('\n')).toContain('Débris flottants en aval');
  });

  it('seed 3 / Très fort de côté → chavirage joué, dérive 12 km, coque 60/60, non coulé', () => {
    launch(false, 45);
    seedBattleRng(3);
    const plan0 = buildRiverPlan(get, 'r-reik', 'A', 'B', get().worldMap!.routes[0])!;
    set({ travelPlan: { ...plan0, river: { ...plan0.river!, windForce: 'tres-fort', windDir: 'cote' } }, journal: [] });
    runRiverDays(get, set);
    drainCascade();
    const plan = get().travelPlan!;
    expect(plan.river!.sunk).toBeFalsy();
    expect(plan.kmDone).toBe(12); // dérive = 25 % de la vitesse de base
    expect(plan.vehicle!.wounds.current).toBe(60);
    expect(get().journal.join('\n')).toMatch(/chavir|voile affalée/); // Navigation Accessible (+20), note 4
  });
});

/**
 * BARRAGE de débris (T2C ch.5 l.128) — CHOIX joueur : forcer au bélier (+10 Dégâts à la coque) ou déblayer
 * à la main (3d10 objets × 4d10 Enc, coque intacte, temps perdu). Défaut de cadence commandée = déblayer.
 */
describe('barrage fluvial (l.128) — forcer au bélier OU déblayer à la main', () => {
  /** Déroule la cascade, tranchant chaque étape « choix » avec `key`. */
  function drainChoosing(key: string): void {
    let g = 0;
    while (get().pendingCascade && g++ < 300) {
      const p = get().pendingCascade!;
      const cur = p.participants[p.cursor];
      if (!cur) { get().cascadeNext(); continue; }
      if (cur.options && cur.chosen == null) { get().cascadeChoose(cur.id, key); continue; }
      if (cur.target != null && !cur.result) { get().cascadeRoll(cur.id); continue; }
      get().cascadeNext();
    }
  }

  it('le péril obstacle OUVRE une étape « choix » (forcer / déblayer), pas une résolution muette', () => {
    launch(false, 45, { riverPerils: [{ perilId: 'barrage', chancePct: 100 }] });
    seedBattleRng(7);
    get().startTravel('r-reik', 'barge');
    // Déroule les jets du jour jusqu'à l'étape de choix du barrage.
    let g = 0;
    while (get().pendingCascade && g++ < 200) {
      const p = get().pendingCascade!;
      const cur = p.participants[p.cursor];
      if (cur?.options) break; // étape de choix atteinte
      if (cur?.target != null && !cur.result) get().cascadeRoll(cur.id);
      else get().cascadeNext();
    }
    const cur = get().pendingCascade!.participants[get().pendingCascade!.cursor];
    expect(cur.kind).toBe('riverObstacleChoice');
    expect(cur.options!.map((o) => o.key).sort()).toEqual(['deblayer', 'forcer']);
    expect(cur.defaultChoice).toBe('deblayer'); // cadence commandée : le moins destructif
  });

  it('FORCER au bélier → +10 Dégâts à la coque (l.128), journal explicite', () => {
    launch(false, 45, { riverPerils: [{ perilId: 'barrage', chancePct: 100 }] });
    seedBattleRng(7);
    get().startTravel('r-reik', 'barge');
    drainChoosing('forcer');
    expect(get().travelPlan!.vehicle!.wounds.current).toBe(50); // 60 − 10 (ram, l.128)
    expect(get().journal.join('\n')).toContain('forcé au bélier');
  });

  it('DÉBLAYER à la main → coque INTACTE, objets/Enc déblayés, progression du jour amputée', () => {
    launch(false, 45, { riverPerils: [{ perilId: 'barrage', chancePct: 100 }] });
    seedBattleRng(7);
    get().startTravel('r-reik', 'barge');
    drainChoosing('deblayer');
    expect(get().travelPlan!.vehicle!.wounds.current).toBe(60); // coque non touchée par le barrage
    const j = get().journal.join('\n');
    expect(j).toMatch(/déblayé à la main/);
    expect(j).toMatch(/objets/);
    expect(j).toMatch(/progression du jour −/);
  });
});

describe('renflouage à l\'échouage (l.99) — l\'Enc de la CARGAISON entre dans le malus de Force', () => {
  function strand(cargoEnc: number): string {
    launch();
    const plan = buildRiverPlan(get, 'r-reik', 'A', 'B', get().worldMap!.routes[0])!;
    // La cargaison vit sur un porteur RÉEL embarqué (chariot de convoi) — `partyCargoTotalEnc` la lit (#327).
    const party = get().party.map((h, i) => i === 0
      ? { ...h, items: [...(h.items ?? []), { uid: 'convoi-1', name: 'Chariot', trappingId: 'diligence', kind: 'misc', qualities: [], enc: 0, equipped: false, cargo: cargoEnc > 0 ? [{ cargoId: 'vin', enc: cargoEnc, basePriceGold: 10 }] : [] } as never] }
      : h);
    set({ party, travelPlan: plan, journal: [] });
    seedBattleRng(7);
    const lines: string[] = [];
    applyEchouage(get, set, (l) => lines.push(...l));
    return lines.join('\n');
  }

  it('à VIDE (barge sans Enc propre, convoi vide) → renflouage sur Intermédiaire, aucune ligne de malus', () => {
    const j = strand(0);
    expect(j).toContain('s\'échoue');
    expect(j).not.toMatch(/malus −/);
  });

  it('CHARGÉE lourdement → malus = Enc totale (bateau + cargaison), l.99', () => {
    expect(strand(80)).toMatch(/malus −80 Enc : 0 bateau \+ 80 cargaison/);
  });

  it('cargaison légère ≠ cargaison lourde → malus DIFFÉRENT (l\'Enc suivie)', () => {
    expect(strand(20)).toMatch(/malus −20 Enc/);
    expect(strand(120)).toMatch(/malus −120 Enc/);
  });

  it('la coque encaisse 12 Dégâts à l\'échouage (l.99), cargaison ou non', () => {
    strand(50);
    expect(get().travelPlan!.vehicle!.wounds.current).toBe(48); // 60 − 12
  });
});

describe('influence effective — Résilience sur un jet du jour fluvial', () => {
  it('la Résilience force la réussite d\'un jet du jour (le mécanisme UNIQUE de cascade s\'applique)', () => {
    launch();
    // Un héros doté de points de Résilience à dépenser sur son jet du jour.
    set({ party: get().party.map((h) => (h.id === 'r-gunnar' ? { ...h, resilience: 2 } : h)) });
    seedBattleRng(7);
    get().startTravel('r-reik', 'barge');
    const pc = get().pendingCascade!;
    expect(pc.purpose).toBe('travelDay');
    // La 1ʳᵉ étape-jet est bien un participant influençable de la cascade.
    const cur = pc.participants[pc.cursor];
    expect(cur.target).not.toBeNull();
    // On force la réussite (forceSuccess) AVANT de rouler : l'API de cascade l'accepte (mécanisme partagé).
    get().cascadeForceSuccess(cur.id);
    const after = get().pendingCascade!.participants[get().pendingCascade!.cursor];
    expect(after.result?.success).toBe(true);
  });
});

describe('exposition hydrique de la descente (T2C ch.14) — l\'Effet waterExposure EXERCÉ après le jour', () => {
  it('un tirage garanti (chance 100 %) ouvre la cascade de Test de Résistance (Exposition) à la clôture du jour', () => {
    launch(false, 45, { riverExposure: { source: 'aval-grande-ville-8km', mode: 'ingestion', chancePct: 100 } });
    seedBattleRng(4);
    get().startTravel('r-reik', 'barge');
    // On draine d'abord la cascade du JOUR (travelDay) ; sa clôture ouvre la cascade d'Exposition (test).
    let g = 0;
    while (get().pendingCascade?.purpose === 'travelDay' && g++ < 200) {
      const p = get().pendingCascade!;
      const cur = p.participants[p.cursor];
      if (cur && cur.target != null && !cur.result) get().cascadeRoll(cur.id);
      else get().cascadeNext();
    }
    const pc = get().pendingCascade;
    // Purpose DÉDIÉ (#344) : la clôture de l'Exposition reprend la fin du jour (halte différée), au lieu du
    // purpose générique `test` qui n'a aucune continuation (→ soft-lock quand le Repos la court-circuite).
    expect(pc?.purpose).toBe('riverExposure');
    expect(pc?.participants.every((s) => s.kind === 'waterExposure')).toBe(true);
    expect(pc?.participants.length).toBe(get().party.filter((h) => !h.dead).length);
  });

  it('#344 : jour → Exposition → halte de nuit DIFFÉRÉE → jour suivant se ré-arme (aucun soft-lock)', () => {
    // 24 km (1 jour ne suffit pas : ~plusieurs étapes de descente) avec exposition GARANTIE chaque jour.
    launch(false, 24, { riverExposure: { source: 'grande-ville-marais', mode: 'ingestion', chancePct: 100 } });
    seedBattleRng(4);
    get().startTravel('r-reik', 'barge');
    expect(get().pendingCascade?.purpose).toBe('travelDay');
    // Draine la cascade du JOUR puis, ENCHAÎNÉE, la cascade d'Exposition (purpose riverExposure).
    drainCascade();
    // La halte de nuit s'est ouverte APRÈS l'Exposition (jamais court-circuitée) — plus aucune cascade pendante.
    expect(get().pendingCascade).toBeNull();
    expect(get().pendingRest).toBeTruthy();
    // La nuit franchie, la journée SUIVANTE se ré-arme (nouvelle cascade travelDay) — le voyage repart.
    get().restSleep();
    expect(get().pendingRest).toBeNull();
    expect(get().pendingCascade?.purpose).toBe('travelDay');
    expect(get().travelPlan?.river).toBeTruthy();
    expect(get().travelPlan?.interrupted).toBe(false);
  });

  it('un héros peut CONTRACTER la maladie sur échec du Test d\'Exposition (contraction directe, T2C ch.14)', () => {
    launch(false, 45, { riverExposure: { source: 'grande-ville-marais', mode: 'ingestion', chancePct: 100 } });
    set({ party: get().party.map((h) => ({ ...h, characteristics: { ...h.characteristics, endurance: 1 } })) });
    seedBattleRng(1);
    get().startTravel('r-reik', 'barge');
    drainCascade(); // draine le jour PUIS l'exposition (chaînés)
    const anyDiseased = get().party.some((h) => (h.diseases ?? []).length > 0);
    expect(anyDiseased).toBe(true);
  });
});

describe('entretien du jour de voyage — la Faim se résout À LA HALTE, après le repas (LDB 18 l.417-422)', () => {
  const stripRations = () => set({ party: get().party.map((h) => ({ ...h, items: (h.items ?? []).filter((i) => i.trappingId !== 'ration'), hunger: undefined })) });

  it('AUCUN Test de Faim n\'est roulé EAGER pendant le jour de descente (avant la halte)', () => {
    launch(false, 45);
    stripRations();
    seedBattleRng(7);
    get().startTravel('r-reik', 'barge');
    drainCascade(); // draine la cascade du jour → halte de nuit
    expect(get().pendingRest).toBeTruthy();
    expect(get().journal.join('\n')).not.toMatch(/Faim : Test de Résistance/);
    for (const h of get().party) expect(h.hunger?.days ?? 0).toBe(0);
  });

  it('le repas d\'auberge à la halte couvre la journée → PERSONNE n\'est affamé au réveil', () => {
    launch(false, 45);
    stripRations();
    seedBattleRng(7);
    get().startTravel('r-reik', 'barge');
    drainCascade();
    expect(get().pendingRest).toBeTruthy();
    for (const h of get().party) get().restSet(h.id, { food: 'repas' });
    get().restSleep();
    drainCascade();
    for (const h of get().party) {
      expect(h.hunger?.days ?? 0).toBe(0);
      expect(h.hunger?.failures ?? 0).toBe(0);
    }
  });

  it('SANS repas ni ration (belle étoile, ventre vide), la Faim suit son cours — étape de cascade, pas de régression', () => {
    launch(false, 45);
    stripRations();
    seedBattleRng(7);
    get().startTravel('r-reik', 'barge');
    drainCascade();
    expect(get().pendingRest).toBeTruthy();
    for (const h of get().party) get().restSet(h.id, { lodging: 'dehors', food: 'rien' });
    get().restSleep();
    drainCascade();
    for (const h of get().party) expect(h.hunger?.days ?? 0).toBe(1);
  });
});

describe('descente end-to-end — le Reik jusqu\'à Altdorf (cascades jour + nuit enchaînées)', () => {
  beforeEach(() => launch(false, 120, { riverPerils: [{ perilId: 'debris', chancePct: 40 }] }));

  it('la barge descend jusqu\'à destination (jours + haltes traversés), le voyage retombe à null', () => {
    seedBattleRng(9);
    get().startTravel('r-reik', 'barge');
    for (let i = 0; i < 120; i++) {
      if (!get().travelPlan && get().scene?.id === 'quai-b') break;
      if (get().pendingCascade) { drainCascade(); continue; }
      if (get().pendingRest) { get().restSleep(); drainCascade(); continue; }
      if (!get().travelPlan) break;
    }
    expect(get().travelPlan).toBeNull();
    expect(get().scene?.id).toBe('quai-b'); // arrivée à Altdorf
    expect(get().gameTime).toBeGreaterThanOrEqual(24 * 60); // au moins une journée a passé
  });
});

/**
 * #270 — sous-tests de CONSÉQUENCE d'un péril (esquive d'éclats de Critique) : jusqu'ici inline même en
 * cascade `travelDay` (aucune Chance offerte sur un jet de survie subi). Gate CONTRÔLEUR (`humanControlled`,
 * état neuf du test = `combat-cadence` par défaut 'manuel' → héros non-`aiControlled` = piloté par un
 * humain) : victime humaine → étape `riverSplinterDodge` INSÉRÉE (influençable) ; victime IA → inline
 * (comportement historique, conséquence identique).
 */
describe('#270 — Critique au gréement : esquive d’éclats gâtée par contrôleur', () => {
  function riggingFailStep(actorId: string) {
    return { title: 'Journée', purpose: 'travelDay' as const, cursor: 0, log: [],
      participants: [{ id: 'rig', kind: 'riverRigging', actorId, rollLabel: 'Voile', base: 40, target: 40,
        result: { roll: 90, target: 40, sl: -5, success: false }, interactive: true }] };
  }

  it('victime PILOTÉE PAR UN HUMAIN → esquive INFLUENÇABLE insérée (riverSplinterDodge), pas résolue d’office', () => {
    launch();
    const plan = buildRiverPlan(get, 'r-reik', 'A', 'B', get().worldMap!.routes[0])!;
    set({ travelPlan: plan, journal: [] });
    seedBattleRng(1);
    const h = get().party[0];
    set({ pendingCascade: riggingFailStep(h.id) as never });
    get().cascadeNext(); // valide l'échec → Critique au gréement
    const pc = get().pendingCascade;
    expect(pc).toBeTruthy();
    expect(pc!.participants.some((s) => s.kind === 'riverSplinterDodge' && s.actorId === h.id)).toBe(true);
    expect(get().party.find((x) => x.id === h.id)!.dead).toBeFalsy(); // pas encore résolu
  });

  it('même Critique, victime IA (`aiControlled`) → esquive résolue INLINE (aucune étape insérée)', () => {
    launch();
    const plan = buildRiverPlan(get, 'r-reik', 'A', 'B', get().worldMap!.routes[0])!;
    set({ travelPlan: plan, journal: [] });
    seedBattleRng(1);
    const h = { ...get().party[0], aiControlled: true };
    set({ party: [h, ...get().party.slice(1)] });
    set({ pendingCascade: riggingFailStep(h.id) as never });
    get().cascadeNext();
    expect(get().pendingCascade).toBeNull(); // 1 seule étape, résolue inline → cascade close
    expect(get().journal.join('\n')).toMatch(/Critique au greement/);
  });
});
