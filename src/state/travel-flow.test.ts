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
import { buildWeatherResistanceSteps, buildStageSteps } from './travelPostes';
import type { Combatant, ItemInstance } from '../engine/types';

const get = () => useGame.getState();
const set = useGame.setState;

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
    if (cur?.participants && cur.participants.some((part) => !part.result)) { for (const part of cur.participants) if (!part.result) get().cascadeBatchRoll(part.id); }
    else if (cur && cur.target != null && !cur.result) get().cascadeRoll(cur.id);
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

  it('les postes AVEC Test = UN pas BATCH (arbitrage user : jets indépendants), une rangée par héros', () => {
    seedBattleRng(1);
    const h = hero({ travelRole: 'approvisionnement', items: [], skills: [{ skillId: 'survie-en-exterieur', advances: 40 } as any] });
    setup(map({ km: 12, perilDie: 0 }), [h]);
    get().startTravel('r1', 'pied');
    const pc = get().pendingCascade;
    expect(pc?.purpose).toBe('travelDay'); // le jour ne s'auto-résout plus
    const batch = pc!.participants.find((s) => s.kind === 'stagePosteBatch');
    expect(batch?.participants?.length).toBe(1); // une rangée pour le seul héros posté
    const part = batch!.participants![0];
    expect(part.target).toBeGreaterThan(0);
    expect(part.result ?? null).toBeNull(); // pas encore roulé → influençable par rangée
  });

  it('la Résilience force la réussite d’une RANGÉE du batch (mécanisme UNIQUE de cascade)', () => {
    seedBattleRng(5); // seed où l'Approvisionnement échoue (parité : 78/70)
    const h = hero({ id: 'h', travelRole: 'approvisionnement', resilience: 2, items: [], skills: [{ skillId: 'survie-en-exterieur', advances: 40 } as any] });
    setup(map({ km: 12, perilDie: 0 }), [h]);
    get().startTravel('r1', 'pied');
    const pc = get().pendingCascade!;
    expect(pc.purpose).toBe('travelDay');
    const batch = pc.participants.find((s) => s.kind === 'stagePosteBatch')!;
    get().cascadeBatchForceSuccess(batch.participants![0].id); // Résilience « Je ne faillirai pas ! » par rangée
    const after = get().pendingCascade!.participants.find((s) => s.kind === 'stagePosteBatch')!;
    expect(after.participants![0].result?.success).toBe(true);
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
    // Le jet est DÉJÀ affiché par la rangée de l'étape (CascadeModal) — succès sans effet PROPRE (le
    // gain de ration vient de l'agrégation de fin d'Étape) → aucune ligne de verdict (#295 Lot 5).
    expect(j).not.toContain('réussi (DR');
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
    // La conséquence est DÉRIVÉE de l'op `condition` appliqué (#295, opConsequenceLine) — plus de
    // chaîne composée « Nom — Activité : Exténué. » : ligne structurée (l'État surfacé sur la rangée).
    expect(st.journal.join('\n')).toContain('État Exténué subi.');
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
    // Le jet est DÉJÀ affiché par la rangée de l'étape (CascadeModal) — pas de re-print (#295 Lot 5).
    expect(st.journal.join('\n')).toContain("Exposition de fin d'Étape (Pluie) : transi par le froid.");
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
    // Le jet est DÉJÀ affiché par la rangée de l'étape (CascadeModal) — pas de re-print (#295 Lot 5).
    expect(j).toContain('Survie en extérieur (+20) : un itinéraire de substitution est trouvé.');
  });

  it('Péripétie seed 3 : « Voyage reposant », soigne toutes les Blessures (routé par applyHealWounds, #473)', () => {
    seedBattleRng(3);
    const h = hero({ wounds: { current: 5, max: 12 } });
    setup(map({ km: 12, perilDie: 8 }), [h]);
    get().startTravel('r1', 'pied');
    drainCascade();
    const st = get();
    expect(st.scene?.id).toBe('lieu-b-scene');
    expect(st.party[0].wounds.current).toBe(12); // soin total (non-régression sans munition logée)
    expect(st.journal.join('\n')).toContain('Hilda récupère toutes ses Blessures.');
  });

  it('Péripétie seed 3 : « Voyage reposant », munition logée plafonne le soin (LDB 62 l.250)', () => {
    seedBattleRng(3);
    const h = hero({ wounds: { current: 5, max: 12 }, conditions: [{ name: 'munition-logee', value: 1 }] });
    setup(map({ km: 12, perilDie: 8 }), [h]);
    get().startTravel('r1', 'pied');
    drainCascade();
    const st = get();
    expect(st.party[0].wounds.current).toBe(11); // plafonné à max−1
    expect(st.journal.join('\n')).toContain('Hilda récupère des Blessures (munition logée bloque le reste).');
  });

  it('Rencontre seed 7 : Succès Impressionnant → « fullRecovery », soigne toutes les Blessures (routé par applyHealWounds, #473)', () => {
    setRule('travel-etapes', true);
    seedBattleRng(7);
    const h = hero({ travelRole: 'approvisionnement', items: [], skills: [{ skillId: 'survie-en-exterieur', advances: 60 } as any], wounds: { current: 5, max: 12 } });
    setup(map({ km: 12, perilDie: 0 }), [h]);
    get().startTravel('r1', 'pied');
    drainCascade();
    const st = get();
    expect(st.party[0].wounds.current).toBe(12); // soin total (non-régression sans munition logée)
    expect(st.journal.join('\n')).toContain('Voyage tranquille : le groupe récupère toutes ses Blessures et tous ses États Exténué.');
  });

  it('Rencontre seed 7 : « fullRecovery » avec munition logée → soin plafonné (LDB 62 l.250)', () => {
    setRule('travel-etapes', true);
    seedBattleRng(7);
    const h = hero({ travelRole: 'approvisionnement', items: [], skills: [{ skillId: 'survie-en-exterieur', advances: 60 } as any], wounds: { current: 5, max: 12 }, conditions: [{ name: 'munition-logee', value: 1 }] });
    setup(map({ km: 12, perilDie: 0 }), [h]);
    get().startTravel('r1', 'pied');
    drainCascade();
    const st = get();
    expect(st.party[0].wounds.current).toBe(11); // plafonné à max−1
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

// ─────────────────────────────────────────────────────────────────────────────────────────────
// #341 follow-up — Test de RÉSISTANCE de traversée (Neige l.86 / Blizzard l.127) au démarrage du jour,
// DISTINCT de l'Exposition de fin d'Étape ; + breakdown de mods sur les rangées BATCH d'activité.
// ─────────────────────────────────────────────────────────────────────────────────────────────
describe('#341 — Résistance de traversée Neige/Blizzard (pas BATCH au démarrage du jour)', () => {
  it('Neige : un pas BATCH par héros voyageant, enjeu VERBATIM EDOC, cible = Résistance + Accessible', () => {
    const h1 = hero({ id: 'h1' });
    const h2 = hero({ id: 'h2' });
    set({ party: [h1, h2] });
    const steps = buildWeatherResistanceSteps(get, 'neige');
    expect(steps.length).toBe(1);
    const step = steps[0];
    expect(step.kind).toBe('weatherResistance');
    expect(step.participants?.length).toBe(2); // un jet INDÉPENDANT par héros
    expect(step.stake).toContain('Résistance Accessible (+20)'); // enjeu verbatim (l.86)
    const p0 = step.participants![0];
    expect(p0.target).toBe(Math.min(99, p0.base + 20)); // Accessible +20 baké dans la cible
    expect(p0.mods?.some((m) => m.value === 20)).toBe(true);
  });

  it('Blizzard sans Test de traversée pour beau temps : aucune météo clémente ne produit de pas', () => {
    set({ party: [hero({ id: 'h1' })] });
    expect(buildWeatherResistanceSteps(get, 'blizzard').length).toBe(1); // Intermédiaire (+0)
    expect(buildWeatherResistanceSteps(get, 'beau').length).toBe(0);
    expect(buildWeatherResistanceSteps(get, 'pluie').length).toBe(0);
  });

  it('échec du Test de Résistance (Neige) → Exténué APPLIQUÉ, ligne DÉRIVÉE (op condition) sur la rangée', () => {
    const h = hero({ id: 'h' });
    set({ party: [h], pendingCascade: null, journal: [] });
    const steps = buildWeatherResistanceSteps(get, 'neige');
    // Jet FORCÉ en échec (déterministe) : la rangée est prête → cascadeNext commit → applier.
    steps[0].participants![0].result = { roll: 99, target: steps[0].participants![0].target, sl: -4, success: false };
    set({ pendingCascade: { title: 'Traversée', icon: 'rest/cold', purpose: 'test', cursor: 0, log: [], participants: steps } as never });
    get().cascadeNext();
    const st = get();
    expect(st.party[0].conditions.some((c) => c.name === 'extenue')).toBe(true);
    expect(st.journal.join('\n')).toContain('État Exténué subi.'); // opConsequenceLine case condition
  });
});

describe('#341 — breakdown de mods sur les rangées BATCH d’activité (source unique avec le mono)', () => {
  it('Pluie diluvienne : Plein air porte la ligne « Météo » ; carto (Métier=Dex) la ligne « Tests physiques »', () => {
    setRule('travel-etapes', true);
    const hOut = hero({ id: 'hOut', travelRole: 'plein-air', skills: [{ skillId: 'survie-en-exterieur', advances: 20 } as never] });
    const hCarto = hero({ id: 'hCarto', travelRole: 'etablir-cartes', skills: [{ skillId: 'metier', spec: 'Cartographe', advances: 20 } as never] });
    set({ party: [hOut, hCarto], travelPlan: {
      routeId: 'r1', fromPlaceId: 'pa', toPlaceId: 'pb', mode: 'pied', hoursPerDay: 6, km: 12, kmDone: 0, interrupted: false,
      postes: { hOut: { activityId: 'plein-air' }, hCarto: { activityId: 'etablir-cartes' } },
    } as never });
    const steps = buildStageSteps(get, set, 'pluie-diluvienne', 'ete');
    const batch = steps.find((s) => s.kind === 'stagePosteBatch')!;
    const outPart = batch.participants!.find((p) => p.id === 'hOut')!;
    const cartoPart = batch.participants!.find((p) => p.id === 'hCarto')!;
    expect(outPart.mods?.some((m) => typeof m.label === 'string' && m.label.startsWith('Météo'))).toBe(true); // Plein air -20 (l.106)
    expect(cartoPart.mods?.some((m) => m.label === 'Tests physiques' && m.value === -10)).toBe(true); // pluie diluvienne l.82, carac Dex
    resetRule('travel-etapes');
  });
});
