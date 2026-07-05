/**
 * Combat de masse / Puissance de Bataille — orchestration (ADE II ch.8, l.13-321).
 *
 * Couche STATE au-dessus du moteur PUR `engine/massBattle` : conduit la boucle de bataille.
 *
 *   PRÉ-BATAILLE (l.79-110) : jusqu'à 3 Activités (Discours l.71, Planification, Infiltration,
 *     Rassembler des forces, Repérage, Sabotage) dont l'issue alimente la Puissance de départ et les
 *     modificateurs permanents (`allyMod`) AVANT le premier Round.
 *   ROUND DE BATAILLE (l.114-124) : (1) composition d'une SITUATION (un SOUS-ENSEMBLE de Scènes du
 *     moment : tirage/authorées + Scènes IMPOSÉES par l'ennemi — menaces l.219 et enchaînements) ; (2)
 *     Scènes cinématiques MULTI-PJ (l.116-118) résolues en SOUTIEN (LDB 12) ; (3) Test spectaculaire de
 *     Puissance NON opposé (l.120) ; (4) Rassemblement (l.122) entre Rounds.
 *
 * TOUS les jets des PJ passent par le CANAL UNIQUE des Activités : `PendingActivity` (marqué `battle`) +
 * la modale `RollShell` (via la fabrique `activity` de `rollFlowSpecs`). Les Activités de préparation et
 * les Scènes sont des `ActivityDef` (contextes 'bataille'/'bataille-round') d'`activities.json`, dont
 * l'issue (bandes `outcomes` + `battle`) est appliquée à l'ARMÉE par `confirmBattleActivity`. Le Test
 * spectaculaire NON opposé est un jet d'ARMÉE (sans Chance/Résilience personnelles) résolu directement.
 * Une Scène `combat`/`threat` réutilise le combat tactique existant (`startCombat`).
 */
import type { Get, Set } from './flowTypes';
import type { Combatant, CharKey, Difficulty } from '../engine/types';
import { battleRng } from './battleRng';
import { d10, d100, type RNG } from '../engine/dice';
import { partyBest, testValue, bestForSkills, bestForCombined, bestAssistedOption } from '../engine/skills';
import { isStructure } from '../engine/structures';
import { inanimateCombatant } from '../engine/inanimate';
import { applyOps } from '../engine/ops';
import { bonus, effectiveChar } from '../engine/characteristics';
import { refLabel } from '../data';
import { CHAR_LABELS, DIFFICULTY_MODIFIERS } from '../engine/types';
import {
  ACTIVITIES, activityById, activitiesFor, matchBattleOutcomes, battleOutcomeAmount,
  type ActivityDef, type BattleResolution, type BattleOutcome as BattleOutcomeDelta,
} from '../engine/activities';
import type { PendingActivity } from './interludeFlow';
import {
  inspireDifficulty, INSPIRE_BONUS, resolveClash, rallyHealAmount, battleOutcome, isDestroyed,
  battleHazard, clampMight, initHoldState, resolveHoldRound, holdEnemyBonus,
  type ClashResult, type BattleOutcome, type HoldState, type BattleHold,
} from '../engine/massBattle';

/** Une armée engagée dans la Puissance de Bataille, modélisée comme un COMBATTANT INANIMÉ à Blessures
 *  (même patron que les structures de siège `structureCombatant`) : `combatant.wounds.current` = Puissance
 *  courante (0-100, recalculée chaque Round, l.19), `combatant.wounds.max` = Puissance de DÉPART (plafond
 *  des gains d'une Scène, l.135). Les deltas de Puissance sont de purs `GameOp` (`heal`/`wounds`) exécutés
 *  par `applyOps` — le plafond « pas au-dessus du départ » est celui, NATUREL, de `heal` à `wounds.max`. */
export interface MassBattleArmy {
  name: string;
  /** Combattant inanimé porteur de la Puissance (Blessures courantes/max). */
  combatant: Combatant;
}

/** Puissance COURANTE d'une armée (= Blessures restantes du Combattant, 0-100). */
export function armyMight(a: MassBattleArmy): number {
  return a.combatant.wounds.current;
}

/** Puissance de DÉPART d'une armée (= Blessures max du Combattant) — plafond des gains d'une Scène (l.135). */
export function armyStartMight(a: MassBattleArmy): number {
  return a.combatant.wounds.max;
}

/** Construit le Combattant inanimé d'une armée depuis sa Puissance de départ (`wounds.current = wounds.max
 *  = startMight`). `inert:true` : la perte de Blessures ne déclenche AUCUNE conséquence de créature. */
function makeArmy(name: string, startMight: number): MassBattleArmy {
  const m = clampMight(startMight);
  return {
    name,
    combatant: inanimateCombatant({ id: `army-${name}`, name, refId: 'mass-army', bodyShape: 'structure', hull: { e: 0, woundsB: m }, inert: true }),
  };
}

/** Clone une armée en appliquant un delta de Puissance COURANTE par `GameOp` (langue unique des effets) :
 *  gain → `heal` (plafonné NATURELLEMENT à `wounds.max` = départ, l.135) ; perte → `wounds` (mitigation nulle
 *  — E:0 → soustraction exacte, plancher 0). Pur : ne mute pas l'entrée. */
function armyWithMightDelta(a: MassBattleArmy, delta: number): MassBattleArmy {
  if (delta === 0) return a;
  const combatant = cloneArmyCombatant(a.combatant);
  applyOps(combatant, [delta > 0 ? { op: 'heal', amount: delta } : { op: 'wounds', amount: -delta }]);
  return { ...a, combatant };
}

/** Clone une armée en ajustant sa Puissance de DÉPART (`wounds.max`) du delta — Sabotage/Rassembler des
 *  forces (l.96/106 : renfort/affaiblissement AVANT la bataille). La Puissance courante suit le même delta
 *  (patron `refreshWounds`), bornée [0, nouveau max]. Pur. */
function armyWithStartMightDelta(a: MassBattleArmy, delta: number): MassBattleArmy {
  if (delta === 0) return a;
  const combatant = cloneArmyCombatant(a.combatant);
  const newMax = clampMight(combatant.wounds.max + delta);
  combatant.wounds.max = newMax;
  if (combatant.wounds.base != null) combatant.wounds.base = newMax;
  combatant.wounds.current = Math.max(0, Math.min(newMax, combatant.wounds.current + delta));
  return { ...a, combatant };
}

/** Clone profond (suffisant) du Combattant-armée pour muter les Blessures hors de l'état Zustand. */
function cloneArmyCombatant(c: Combatant): Combatant {
  return { ...c, wounds: { ...c.wounds } };
}

/** Delta de Puissance d'une Scène résolue (affichage). */
export interface SceneDelta { side: 'ally' | 'enemy'; amount: number; label: string }

/** Scène de COMBAT en cours (Charge/Pluie de flèches/Duel/Intrus…) : touches et PJ frappeurs suivis
 *  EN DIRECT par `massBattleTrackHit` durant la mêlée (l.139/145 ; intervention en Duel l.225). */
export interface MassBattleCombatScene {
  sceneId: string;
  /** Total des touches portées à l'ennemi par les PJ (−1/touche, l.139). */
  hits: number;
  /** Ids des PJ ayant porté au moins une touche (≥ 2 ⇒ intervention en Duel, l.225). */
  hitters: string[];
}

/** État runtime d'une bataille de masse. */
export interface MassBattleState {
  ally: MassBattleArmy;
  enemy: MassBattleArmy;
  /** Rounds de bataille prévus (escarmouche = 1, siège ≥ 5, l.124). */
  plannedRounds: number;
  /** Round de bataille courant (1-based). */
  round: number;
  /** 'prep' = pré-bataille (Activités de préparation, via l'interlude) ; 'round' = Round actif ;
   *  'over' = terminée. */
  phase: 'prep' | 'round' | 'over';
  /** Description narrative de la configuration du terrain du Round (l.126). */
  terrain?: string;
  /** Modificateur PERMANENT au Test de Puissance allié (Planification +10/+20, l.81). */
  allyMod: number;
  /** Bonus au Test de Puissance allié du PREMIER Round seul (Discours inspirant réussi, l.71). */
  firstRoundBonus: number;
  /** Discours inspirant déjà tenté (une fois avant la bataille) — anti-répétition, PAS un budget. */
  inspired?: boolean;
  // ── Activités de bataille pré-combat (l.79-110) ──
  /** Ids des Activités de préparation déjà réalisées — set ANTI-RÉPÉTITION seul (« Les Activités ratées ne
   *  peuvent être réessayées », l.67). Le BUDGET des 3 Activités est celui, UNIQUE, de l'interlude
   *  (`interlude.perHero[id].left`, LDB 23 l.6 / ADE II ch.8 l.65). */
  activitiesDone: string[];
  /** Planification réussie (prérequis de l'Infiltration). */
  planned?: boolean;
  /** Repérage réussi (prérequis du Sabotage) — révèle aussi la Puissance ennemie (l.100). */
  scouted?: boolean;
  /** Bonus cumulé au Test de Planification (Repérage/Infiltration, l.75/100). */
  planningBonus: number;
  // ── Round courant ──
  /** Facteur environnemental du Round (l.309) — narratif (le MJ/joueur l'applique en Scène). */
  hazard?: { label: string; text: string };
  /** Catalogue des Scènes disponibles (pioche des situations). */
  pool: string[];
  /** Situations AUTHORÉES par Round (l.128) : `situations[round-1]` sinon la dernière ; à défaut, tirage. */
  situations?: string[][];
  /** Taille du tirage par défaut d'une situation (si non authorée). */
  situationSize: number;
  /** Scènes PRÉSENTÉES ce Round (la SITUATION du moment, l.114-116) — PAS tout le catalogue. */
  situation: string[];
  /** Scènes IMPOSÉES au Round suivant (enchaînements l.169/175/208/217/225). */
  imposed: string[];
  /** Scènes MENACE actives non vaincues (Intrus l.219) : pénalisent les Tests des autres Scènes. */
  activeThreats: string[];
  /** Scènes résolues CE Round (une résolution par Scène). */
  resolvedScenes: string[];
  /** PJ ayant agi CE Round : tout PJ engagé dans une Scène résolue (l.116-118). */
  actedHeroes: string[];
  /** AFFECTATION explicite de PJ à une action CE Round — clé = id d'action (Scène OU Activité), valeur =
   *  liste ordonnée des ids de PJ postés. */
  assignment: Record<string, string[]>;
  /** PJ ayant tenté le Rassemblement CE Round (l.122). */
  ralliedHeroes: string[];
  /** Deltas de Puissance appliqués CE Round (affichage, cumulés). */
  sceneDeltas: SceneDelta[];
  /** Post-clash : en attente du Rassemblement / passage au Round suivant. */
  awaitingNext?: boolean;
  /** Résultat du dernier Test spectaculaire (affichage). */
  lastClash?: ClashResult;
  /** Issue finale (phase 'over'). */
  outcome?: BattleOutcome;
  /** Scène de combat tactique en attente de reprise (startCombat). */
  combatScene?: MassBattleCombatScene;
  /** Rencontres à démarrer pour les Scènes de COMBAT/MENACE (par id de Scène → id d'encounter). */
  sceneEncounters?: Record<string, string>;
  /** État PERSISTANT par Scène entre Rounds (générique) — ex. Point de rupture d'une « Tenez votre
   *  position » (`HoldState`, l.161). Clé = id de Scène. */
  sceneState: Record<string, HoldState>;
  /** Journal de bataille (une ligne par événement marquant). */
  log: string[];
}

/** Spec d'amorçage d'une bataille (scénario de test / recette `__wfrp`). */
export interface MassBattleSpec {
  allyName?: string;
  enemyName?: string;
  allyMight: number;
  enemyMight: number;
  /** Rounds prévus (défaut 1 = escarmouche). */
  plannedRounds?: number;
  terrain?: string;
  /** Catalogue de Scènes (défaut : tout le catalogue) — la pioche des situations. */
  scenes?: string[];
  /** Situations authorées par Round (l.128) : chacune un ENSEMBLE de Scènes du moment. */
  situations?: string[][];
  /** Taille du tirage d'une situation par défaut (si non authorée). Défaut 3. */
  situationSize?: number;
  /** Rencontres à démarrer pour les Scènes de COMBAT/MENACE (par id de Scène → id d'encounter). */
  sceneEncounters?: Record<string, string>;
  /** Modificateur de Planification permanent (l.81). */
  allyMod?: number;
}

// ── Catalogues data-driven des Activités/Scènes de bataille (`activities.json`) ────────────────────

/** Toutes les Activités de PRÉPARATION (contexte 'bataille'). */
const PREP_ACTIVITIES = (): ActivityDef[] => activitiesFor('bataille');
/** Toutes les Scènes de Round (contexte 'bataille-round'). */
const ROUND_SCENES = (): ActivityDef[] => activitiesFor('bataille-round');
/** Scène de Round par id (repli undefined). */
export function battleSceneById(id: string): ActivityDef | undefined {
  const d = activityById(id);
  return d?.contexts.includes('bataille-round') ? d : undefined;
}
/** Activité de préparation par id (repli undefined). */
export function battleActivityById(id: string): ActivityDef | undefined {
  const d = activityById(id);
  return d?.contexts.includes('bataille') ? d : undefined;
}

/** Une Scène est-elle un COMBAT tactique (combat/menace) ? (engage tout le groupe, `startCombat`). */
function isCombatScene(def: ActivityDef): boolean {
  return def.sceneKind === 'combat' || def.sceneKind === 'threat';
}

// ── Utilitaires purs de composition ──────────────────────────────────────────────────────────────

function uniq(ids: string[]): string[] {
  return [...new Set(ids)];
}

/** Tirage déterministe d'un sous-ensemble du catalogue (mélange de Fisher-Yates borné par le RNG). */
function drawSubset(pool: string[], size: number, rng: RNG): string[] {
  const a = [...pool];
  for (let i = a.length - 1; i > 0; i--) {
    const j = rng.int(0, i);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a.slice(0, Math.max(0, Math.min(size, a.length)));
}

/** Compose la SITUATION du Round courant (l.114-116) : base (situation authorée OU tirage du
 *  catalogue) + Scènes IMPOSÉES (enchaînements) + MENACES actives. */
function composeSituation(mb: MassBattleState, rng: RNG): { situation: string[]; activeThreats: string[]; imposed: string[] } {
  const idx = mb.round - 1;
  const authored = mb.situations && mb.situations.length
    ? (mb.situations[idx] ?? mb.situations[mb.situations.length - 1])
    : null;
  const base = authored ?? drawSubset(mb.pool, mb.situationSize, rng);
  const ids = uniq([...base, ...mb.imposed, ...mb.activeThreats]).filter((id) => !!battleSceneById(id));
  const threats = uniq([...mb.activeThreats, ...ids.filter((id) => battleSceneById(id)?.sceneKind === 'threat')]);
  return { situation: ids, activeThreats: threats, imposed: [] };
}

/** Pénalité active infligée aux Tests des Scènes ce Round (Intrus l.219 : −20 tant que la menace vit). */
export function massBattleThreatPenalty(mb: MassBattleState): number {
  return mb.activeThreats.reduce((sum, id) => sum + (battleSceneById(id)?.threat?.penalty ?? 0), 0);
}

/** Flags de préparation acquis (satisfaction des `requires`, octroi des `grantsFlag`). */
function prepFlags(mb: MassBattleState): ReadonlySet<string> {
  const flags = [...(mb.planned ? ['planned'] : []), ...(mb.scouted ? ['scouted'] : [])];
  return new Set(flags);
}

// ── Amorçage ─────────────────────────────────────────────────────────────────────────────────────

const DEFAULT_SITUATION_SIZE = 3;

/** Ouvre une bataille de masse et bascule sur sa vue. */
export function startMassBattle(get: Get, set: Set, spec: MassBattleSpec): void {
  if (get().battle) { get().log('Impossible d\'ouvrir une bataille de masse en plein combat tactique.'); return; }
  const allyMight = clampMight(spec.allyMight);
  const enemyMight = clampMight(spec.enemyMight);
  // Le Rassemblement (sceneKind 'rally', l.122) n'est PAS une Scène cinématique de la pioche : il s'ouvre
  // entre les Rounds (`openMassBattleRally`). La pioche par défaut = les Scènes cinématiques (test/combat/
  // threat/hold, l.137-225).
  const defaultPool = ROUND_SCENES().filter((d) => d.sceneKind !== 'rally').map((d) => d.id);
  const pool = (spec.scenes && spec.scenes.length ? spec.scenes : defaultPool).filter((id) => !!battleSceneById(id));
  const mb: MassBattleState = {
    ally: makeArmy(spec.allyName ?? 'Armée des Personnages', allyMight),
    enemy: makeArmy(spec.enemyName ?? 'Armée ennemie', enemyMight),
    plannedRounds: Math.max(1, Math.floor(spec.plannedRounds ?? 1)),
    round: 1,
    phase: 'prep',
    terrain: spec.terrain,
    allyMod: spec.allyMod ?? 0,
    firstRoundBonus: 0,
    activitiesDone: [],
    planningBonus: 0,
    pool,
    situations: spec.situations && spec.situations.length ? spec.situations : undefined,
    situationSize: Math.max(1, Math.floor(spec.situationSize ?? DEFAULT_SITUATION_SIZE)),
    situation: [],
    imposed: [],
    activeThreats: [],
    resolvedScenes: [],
    actedHeroes: [],
    assignment: {},
    ralliedHeroes: [],
    sceneDeltas: [],
    sceneEncounters: spec.sceneEncounters,
    sceneState: {},
    log: [`Bataille engagée : ${spec.allyName ?? 'les Personnages'} (Puissance ${allyMight}) contre ${spec.enemyName ?? 'l\'ennemi'} (Puissance ${enemyMight}).`],
  };
  set({ massBattle: mb });
  // « Interlude c'est interlude » : la PRÉPARATION (Activités 'bataille') se joue DANS le menu d'interlude,
  // pas sur un écran à part. Avec un interlude ouvert → on reste sur son écran (les prépas y figurent, budget
  // UNIQUE). Sans interlude → aucune préparation possible : la bataille démarre directement au Round 1.
  if (get().interlude) {
    set({ screen: 'interlude' });
  } else {
    massBattleBegin(get, set);
    set({ screen: 'massBattle' });
  }
}

/** Passe de la phase pré-bataille aux Rounds : compose la situation du Round 1. */
export function massBattleBegin(get: Get, set: Set): void {
  const mb = get().massBattle;
  if (!mb || mb.phase !== 'prep') return;
  const { situation, activeThreats, imposed } = composeSituation(mb, battleRng());
  const threatLine = describeThreats(activeThreats);
  set({ massBattle: { ...mb, phase: 'round', situation, activeThreats, imposed, log: threatLine ? [...mb.log, threatLine] : mb.log } });
  if (threatLine) get().log(threatLine);
}

function describeThreats(threats: string[]): string | null {
  if (!threats.length) return null;
  const names = threats.map((id) => battleSceneById(id)?.label ?? id).join(', ');
  return `Menace sur le champ de bataille : ${names} — les autres Scènes du Round subissent une pénalité tant qu'elle n'est pas vaincue.`;
}

// ── Construction de la modale de jet (canal UNIQUE : PendingActivity + flux `activity`) ────────────

/** Fabrique une `PendingActivity` de bataille (préparation ou Scène) et l'ouvre. Le flux `activity`
 *  (RollShell) résout ensuite le jet (combiné/opposé compris) ; `confirmBattleActivity` applique l'issue. */
function openBattlePending(get: Get, set: Set, o: {
  actor: Combatant; battle: 'prep' | 'round'; def: ActivityDef;
  skillValue: number; skillId?: string; spec?: string; char?: CharKey; difficulty: Difficulty;
  label?: string; mod?: number; modLabel?: string;
  combined?: { skillId?: string; spec?: string; value: number };
  enemyValue?: number; enemyRoll?: number;
  heroIds?: string[]; support?: { count: number; bonus: number };
}): void {
  const skillLabel = o.skillId ? refLabel('skills', { id: o.skillId, spec: o.spec }) : o.char ? CHAR_LABELS[o.char] : 'Test';
  const diffMod = DIFFICULTY_MOD(o.difficulty) + (o.mod ?? 0);
  const target = Math.max(1, Math.min(99, o.skillValue + diffMod));
  const combined = o.combined
    ? { skill2: o.combined.skillId ? refLabel('skills', { id: o.combined.skillId, spec: o.combined.spec }) : CHAR_LABELS[o.char ?? 'Int'], skillValue2: o.combined.value, target2: Math.max(1, Math.min(99, o.combined.value + diffMod)) }
    : {};
  const pa: PendingActivity = {
    heroId: o.actor.id, kind: 'catalog', activityId: o.def.id, battle: o.battle,
    label: o.label ?? o.def.label, skillLabel, skillValue: o.skillValue, difficulty: o.difficulty,
    roll: null, target, sl: 0, success: false,
    ...(o.mod ? { mod: o.mod, modLabel: o.modLabel } : {}),
    ...(o.support ? { support: o.support } : {}),
    ...(o.heroIds ? { heroIds: o.heroIds } : {}),
    ...(o.enemyValue != null ? { enemyValue: o.enemyValue, enemyRoll: o.enemyRoll } : {}),
    ...combined,
  };
  set({ pendingActivity: pa });
}

const DIFFICULTY_MOD = (d: Difficulty): number => DIFFICULTY_MODIFIERS[d];

/** Budget d'Activités restant d'un héros — le budget UNIQUE de l'interlude (LDB 23 l.6 / ADE II ch.8
 *  l.65). Une prépa de bataille EST une Activité d'interlude : sans interlude ouvert, aucun budget. */
function heroBudget(get: Get, heroId: string): number {
  return get().interlude?.perHero[heroId]?.left ?? 0;
}

/** Héros MENEURS éligibles d'une Activité de préparation : vivants ET disposant du budget d'interlude
 *  (`left > 0`). Sans interlude ouvert, personne — une bataille sans préparation démarre au Round 1. */
function budgetedParty(get: Get): Combatant[] {
  return get().party.filter((h) => !h.dead && heroBudget(get, h.id) > 0);
}

// ── Activités pré-combat (l.79-110) ──────────────────────────────────────────────────────────────

/** Ouvre le Test de Commandement du Discours inspirant (l.71). Difficulté = écart de Puissance arrondi
 *  à la dizaine ; en cas de succès → +10 au Test de Puissance du premier Round. Consomme une Activité
 *  d'interlude du meneur (budget UNIQUE, décrémenté par `confirmActivity`). */
export function openMassBattleInspire(get: Get, set: Set): void {
  const mb = get().massBattle;
  if (!mb || mb.phase !== 'prep' || mb.inspired) return;
  const party = budgetedParty(get);
  if (!party.length) return;
  const chosen = assignedHeroesFor(mb, party, 'inspire')[0] ?? partyBest(party, 'commandement')?.actor;
  if (!chosen) return;
  const difficulty = inspireDifficulty(armyMight(mb.ally), armyMight(mb.enemy));
  // Le Discours est modélisé comme une Activité de préparation SYNTHÉTIQUE : pas d'`ActivityDef` dédié
  // (issue GLOBALE non data-driven « +10 au 1er Round », gérée par `confirmBattleActivity`).
  openBattlePending(get, set, {
    actor: chosen, battle: 'prep', def: INSPIRE_DEF, skillValue: testValue(chosen, 'commandement'),
    skillId: 'commandement', difficulty, label: 'Discours inspirant', heroIds: [chosen.id],
  });
}

/** `ActivityDef` synthétique du Discours inspirant (l.69-71) : issue GLOBALE (+10 au 1er Round) portée par
 *  `confirmBattleActivity` (pas de bande `battle` — l'effet est un cas à part du RAW). Exporté pour le
 *  menu d'interlude (le Discours y figure comme toute Activité de préparation, résolu par
 *  `massBattleInspire`). */
export const INSPIRE_DEF: ActivityDef = {
  id: 'inspire', label: 'Discours inspirant', icon: 'action/lead', contexts: ['bataille'],
  source: { book: 'ADE II', page: 71 }, skills: [{ skillId: 'commandement' }], difficulty: 'intermediaire',
  desc: 'Un bon général doit motiver ses troupes avant la bataille. Un discours inspirant réussi (Test de Commandement dont la Difficulté dépend de l\'écart de Puissance entre les armées) octroie un bonus de +10 au Test de Puissance du premier Round.',
};

/** Entrée d'Activité de préparation pour le menu d'interlude : la définition + son état de blocage
 *  (`done` = déjà réalisée ; `blocked` = raison d'indisponibilité — prérequis non satisfait). Toutes les
 *  Activités de préparation sont RETOURNÉES (jamais filtrées) pour être affichées désactivées avec la raison,
 *  cohérent avec le rendu générique des Activités d'interlude. */
export interface BattlePrepEntry {
  def: ActivityDef;
  done: boolean;
  /** Raison d'indisponibilité (prérequis manquant) — `null` si praticable. */
  blocked: string | null;
}

/** Libellé du prérequis manquant d'une Activité de préparation (l.73/104). */
const REQUIRES_LABEL: Record<string, string> = {
  planned: 'Exige une Planification réussie au préalable.',
  scouted: 'Exige un Repérage réussi au préalable.',
};

/** Toutes les Activités de PRÉPARATION (Discours + `activitiesFor('bataille')`) avec leur état pour le menu
 *  d'interlude : déjà réalisées (anti-répétition, l.67) ou verrouillées par un prérequis (Infiltration ⇐
 *  Planification l.73 ; Sabotage ⇐ Repérage l.104). L'affichage rend l'entrée DÉSACTIVÉE avec la raison. */
export function battlePrepEntries(mb: MassBattleState): BattlePrepEntry[] {
  const flags = prepFlags(mb);
  const defs = [INSPIRE_DEF, ...PREP_ACTIVITIES()];
  return defs.map((def) => {
    const done = def.id === 'inspire' ? !!mb.inspired : mb.activitiesDone.includes(def.id);
    const missing = (def.requires ?? []).find((f) => !flags.has(f));
    return { def, done, blocked: missing ? (REQUIRES_LABEL[missing] ?? `Prérequis manquant : ${missing}.`) : null };
  });
}

/** Résout l'AFFECTATION explicite d'une action (`assignment[actionId]`) en la LISTE des PJ effectivement
 *  DISPONIBLES : membres du groupe, vivants, non encore engagés ce Round (`actedHeroes`). Tableau vide si
 *  aucun poste valable — l'appelant retombe sur la SUGGESTION. Pur : lit l'état, ne mute rien. */
export function assignedHeroesFor(mb: MassBattleState, party: Combatant[], actionId: string): Combatant[] {
  const ids = mb.assignment[actionId] ?? [];
  return ids
    .map((id) => party.find((h) => h.id === id))
    .filter((h): h is Combatant => !!h && !h.dead && !mb.actedHeroes.includes(h.id));
}

/** Enregistre l'AFFECTATION de PJ à une action du Round (Scène MULTI-PJ / Activité). */
export function setMassBattleHero(get: Get, set: Set, actionId: string, heroIds: string[]): void {
  const mb = get().massBattle;
  if (!mb) return;
  const assignment = { ...mb.assignment };
  if (heroIds.length) assignment[actionId] = heroIds; else delete assignment[actionId];
  set({ massBattle: { ...mb, assignment } });
}

/** Ouvre le Test d'une Activité de bataille pré-combat (Planification/Infiltration/… l.79-106). Un Test
 *  COMBINÉ (Infiltration/Repérage, `def.combined`) confronte UN jet aux DEUX compétences de l'acteur ;
 *  une Activité SOUTENABLE (`def.assisted`, Planification l.81) est résolue en Soutien multi-PJ. */
export function openMassBattleActivity(get: Get, set: Set, activityId: string): void {
  const mb = get().massBattle;
  const def = battleActivityById(activityId);
  if (!mb || mb.phase !== 'prep' || !def) return;
  if (mb.activitiesDone.includes(activityId)) return; // anti-répétition (l.67)
  const flags = prepFlags(mb);
  if (!(def.requires ?? []).every((f) => flags.has(f))) return;
  // Budget UNIQUE (l.65) : seuls les meneurs disposant d'une Activité d'interlude peuvent préparer.
  const party = budgetedParty(get);
  if (!party.length) return;
  // Le Repérage/Infiltration boostent le Test de Planification (`planningBonus`, l.75/100).
  const mod = activityId === 'planification' ? mb.planningBonus : 0;
  const modLabel = mod ? 'Préparation' : undefined;
  if (def.combined && def.skills && def.skills.length >= 2) {
    // Test COMBINÉ (l.75/102) : l'acteur posté décide (à défaut, SUGGESTION = celui maximisant le PLUS FAIBLE
    // des deux). Les DEUX valeurs de l'acteur retenu sont dérivées via une passe SINGLETON.
    const chosen = assignedHeroesFor(mb, party, activityId)[0] ?? bestForCombined(party, def.skills[0], def.skills[1], def.char)?.actor;
    if (!chosen) return;
    const picked = bestForCombined([chosen], def.skills[0], def.skills[1], def.char);
    if (!picked) return;
    openBattlePending(get, set, {
      actor: picked.actor, battle: 'prep', def, skillValue: picked.value1, skillId: def.skills[0].skillId, spec: def.skills[0].spec, char: def.char,
      difficulty: def.difficulty ?? 'intermediaire', mod, modLabel,
      combined: { skillId: def.skills[1].skillId, spec: def.skills[1].spec, value: picked.value2 },
    });
    return;
  }
  if (def.assisted) {
    // Activité SOUTENABLE (Planification l.81) : résolue comme une Scène de Round. Équipe = les PJ POSTÉS ;
    // à défaut, la SUGGESTION = le meilleur PJ SEUL. Valeur SOUTENUE (`bestAssistedOption`, LDB 12).
    const crew = assignedHeroesFor(mb, party, activityId);
    const solo = bestForSkills(party, def.skills, def.char)?.actor;
    const team = crew.length ? crew : (solo ? [solo] : []);
    if (!team.length) return;
    const picked = bestAssistedOption(team, def.skills, def.char);
    if (!picked) return;
    openBattlePending(get, set, {
      actor: picked.actor, battle: 'prep', def, skillValue: picked.value, skillId: picked.skillId, spec: picked.spec, char: def.char,
      difficulty: def.difficulty ?? 'intermediaire', mod, modLabel,
      heroIds: team.map((h) => h.id), support: picked.support,
    });
    return;
  }
  // Activité SOLO (RAW l.75/102/106 « un Personnage », sans aide) : acteur = PJ posté (à défaut, SUGGESTION).
  const chosen = assignedHeroesFor(mb, party, activityId)[0] ?? bestForSkills(party, def.skills, def.char)?.actor;
  if (!chosen) return;
  const picked = bestForSkills([chosen], def.skills, def.char);
  if (!picked) return;
  openBattlePending(get, set, {
    actor: picked.actor, battle: 'prep', def, skillValue: picked.value, skillId: picked.skillId, spec: picked.spec, char: def.char,
    difficulty: def.difficulty ?? 'intermediaire', mod, modLabel,
  });
}

// ── Scènes cinématiques (l.116-225) ──────────────────────────────────────────────────────────────

/** Choisit une Scène de la SITUATION : 'test' → modale de jet ; 'hold' → Test opposé de tenue ;
 *  'combat'/'threat' → combat tactique. Scène MULTI-PJ (l.116-118) résolue en SOUTIEN (LDB 12). */
export function openMassBattleScene(get: Get, set: Set, sceneId: string): void {
  const mb = get().massBattle;
  const scene = battleSceneById(sceneId);
  if (!mb || mb.phase !== 'round' || mb.awaitingNext || !scene) return;
  if (!mb.situation.includes(sceneId) || mb.resolvedScenes.includes(sceneId)) return;
  if (isCombatScene(scene)) { startBattleCombat(get, set, scene); return; }
  if (scene.sceneKind === 'hold') { openHoldScene(get, set, scene); return; }
  // Scène 'test' MULTI-PJ (l.116-118/151/153) : compétences AU CHOIX, Soutien LDB 12.
  const party = get().party.filter((h) => !h.dead && !mb.actedHeroes.includes(h.id));
  if (!party.length) { get().log('Tous les Personnages ont déjà agi ce Round.'); return; }
  const crew = assignedHeroesFor(mb, party, scene.id);
  const solo = bestForSkills(party, scene.skills, scene.char)?.actor;
  const team = crew.length ? crew : (solo ? [solo] : []);
  if (!team.length) return;
  const picked = bestAssistedOption(team, scene.skills, scene.char);
  if (!picked) return;
  const mod = massBattleThreatPenalty(mb); // Intrus l.219 : −20 aux Tests des autres Scènes.
  openBattlePending(get, set, {
    actor: picked.actor, battle: 'round', def: scene, skillValue: picked.value, skillId: picked.skillId, spec: picked.spec, char: scene.char,
    difficulty: scene.difficulty ?? 'intermediaire', mod, modLabel: mod ? 'Menace' : undefined,
    heroIds: team.map((h) => h.id), support: picked.support,
  });
}

/** Ouvre le Test OPPOSÉ d'une Scène « Tenez votre position » (l.161-163) : les PJ engagés défendent en
 *  SOUTIEN ; l'ennemi oppose un jet FIGÉ (Puissance ennemie + bonus cumulatif de tenue). */
function openHoldScene(get: Get, set: Set, scene: ActivityDef): void {
  const mb = get().massBattle;
  if (!mb || !scene.hold) return;
  const state = mb.sceneState[scene.id] ?? initHoldState();
  if (state.broken) { get().log(`Scène « ${scene.label} » : la position a déjà cédé (déroute).`); return; }
  const party = get().party.filter((h) => !h.dead && !mb.actedHeroes.includes(h.id));
  if (!party.length) { get().log('Tous les Personnages ont déjà agi ce Round.'); return; }
  const crew = assignedHeroesFor(mb, party, scene.id);
  const solo = bestForSkills(party, scene.skills, scene.char)?.actor;
  const team = crew.length ? crew : (solo ? [solo] : []);
  if (!team.length) return;
  const picked = bestAssistedOption(team, scene.skills, scene.char);
  if (!picked) return;
  const enemyBonus = holdEnemyBonus(scene.hold, state.held); // +10 cumulatif par Round déjà tenu (l.163).
  const mod = massBattleThreatPenalty(mb);
  const enemyValue = Math.max(1, Math.min(99, armyMight(mb.enemy) + enemyBonus));
  const enemyRoll = d100(battleRng());
  openBattlePending(get, set, {
    actor: picked.actor, battle: 'round', def: scene, skillValue: picked.value, skillId: picked.skillId, spec: picked.spec, char: scene.char,
    difficulty: scene.difficulty ?? 'intermediaire', mod, modLabel: mod ? 'Menace' : undefined,
    enemyValue, enemyRoll, heroIds: team.map((h) => h.id), support: picked.support,
  });
}

// ── Rassemblement (l.122) ────────────────────────────────────────────────────────────────────────

/** Ouvre le Test de Résistance de guérison du Rassemblement (l.122, `ActivityDef` sceneKind 'rally') pour
 *  le prochain PJ vivant n'ayant pas récupéré ce Round. Disponible entre les Rounds (post-clash). */
export function openMassBattleRally(get: Get, set: Set): void {
  const mb = get().massBattle;
  if (!mb || mb.phase !== 'round' || !mb.awaitingNext) return;
  const def = activityById('rassemblement');
  if (!def) return;
  const hero = get().party.find((h) => !h.dead && !mb.ralliedHeroes.includes(h.id) && h.wounds.current < h.wounds.max);
  if (!hero) { get().log('Aucun Personnage à soigner au Rassemblement.'); return; }
  openBattlePending(get, set, {
    actor: hero, battle: 'round', def, skillValue: testValue(hero, 'resistance'), skillId: 'resistance',
    difficulty: 'intermediaire', label: 'Rassemblement (Résistance)', heroIds: [hero.id],
  });
}

// ── Application des issues (appelée par `confirmActivity` pour une `PendingActivity` de bataille) ───

/** Applique un delta de Puissance COURANTE à un camp par `GameOp` (`heal`/`wounds`). */
function applyDelta(mb: MassBattleState, side: 'ally' | 'enemy', delta: number): MassBattleState {
  return { ...mb, [side]: armyWithMightDelta(mb[side], delta) };
}

/** Applique une issue de bataille (`BattleOutcome`) à l'état : delta de Puissance courante/départ ou
 *  modificateur de Test. Retourne l'état muté + le delta AFFICHABLE éventuel. */
function applyBattleOutcome(mb: MassBattleState, o: BattleOutcomeDelta, amount: number, label: string): { mb: MassBattleState; shown?: SceneDelta } {
  switch (o.target) {
    case 'might': {
      const side = o.side ?? 'enemy';
      return { mb: applyDelta(mb, side, amount), shown: { side, amount, label } };
    }
    case 'startMight': {
      const side = o.side ?? 'ally';
      return { mb: { ...mb, [side]: armyWithStartMightDelta(mb[side], amount) }, shown: { side, amount, label } };
    }
    case 'allyTestMod': return { mb: { ...mb, allyMod: mb.allyMod + amount } };
    case 'firstRoundBonus': return { mb: { ...mb, firstRoundBonus: mb.firstRoundBonus + amount } };
    case 'planningBonus': return { mb: { ...mb, planningBonus: mb.planningBonus + amount } };
  }
}

/** Issue effective (Succès + DR de palier) d'une Activité/Scène, Test COMBINÉ compris (l.75/102) : un Test
 *  combiné RÉUSSIT sur `full` ; son DR de palier = le PLUS FAIBLE des deux DR (facteur limitant). */
function activityTestResult(pa: PendingActivity): { success: boolean; sl: number } {
  if (pa.combinedLevel) return { success: pa.combinedLevel === 'full', sl: Math.min(pa.sl, pa.sl2 ?? pa.sl) };
  return { success: pa.success, sl: pa.sl };
}

/** Construit la `BattleResolution` d'un Test (Scène de Test/Activité de préparation) : Succès Stupéfiant
 *  (DR ≥ 6) fait tomber le capitaine/général (`generalDown`, l.208/217). */
function testResolution(success: boolean, sl: number): BattleResolution {
  return { success, sl, hits: 0, kills: 0, generalDown: success && sl >= 6, intervention: false, combat: false };
}

/** Applique les bandes d'issue de bataille d'une résolution (deltas `battle` + enchaînements `chains`),
 *  met à jour situation/menaces/agissants pour une Scène. */
function applyBattleBands(
  mb: MassBattleState, def: ActivityDef, res: BattleResolution, heroes: string[], isScene: boolean,
): { mb: MassBattleState; lines: string[] } {
  let next = mb;
  const bands = matchBattleOutcomes(def, res);
  const shown: SceneDelta[] = [];
  const chains: string[] = [];
  const deltaLabels: string[] = [];
  for (const b of bands) {
    for (const o of (b.battle ?? [])) {
      const amount = battleOutcomeAmount(o, res);
      if (amount === 0) continue;
      const r = applyBattleOutcome(next, o, amount, def.label);
      next = r.mb;
      if (r.shown) shown.push(r.shown);
      deltaLabels.push(outcomeLabel(o, amount));
    }
    chains.push(...(b.chains ?? []));
  }
  const lines: string[] = [];
  const noun = isScene ? 'Scène' : 'Activité';
  if (deltaLabels.length) lines.push(`${noun} « ${def.label} » résolue : ${deltaLabels.join(' ; ')}.`);
  else if (res.success) lines.push(`${noun} « ${def.label} » réussie — aucun effet chiffré.`);
  else lines.push(`${noun} « ${def.label} » échouée — aucun effet.`);
  for (const cid of uniq(chains)) {
    lines.push(`Enchaînement : la Scène « ${battleSceneById(cid)?.label ?? cid} » s'impose au prochain Round.`);
  }
  next = {
    ...next,
    ...(isScene ? {
      resolvedScenes: uniq([...next.resolvedScenes, def.id]),
      actedHeroes: uniq([...next.actedHeroes, ...heroes]),
      imposed: uniq([...next.imposed, ...chains]),
      // Intrus (l.219) : la menace PERSISTE tant qu'elle n'est pas VAINCUE — ne la retirer que sur succès/victoire.
      activeThreats: def.sceneKind === 'threat' && res.success ? next.activeThreats.filter((id) => id !== def.id) : next.activeThreats,
      sceneDeltas: [...next.sceneDeltas, ...shown],
    } : {}),
  };
  return { mb: next, lines };
}

/** Libellé chiffré d'une issue appliquée (journal). */
function outcomeLabel(o: BattleOutcomeDelta, amount: number): string {
  const sign = amount >= 0 ? '+' : '';
  switch (o.target) {
    case 'might': return `Puissance ${(o.side ?? 'enemy') === 'ally' ? 'alliée' : 'ennemie'} ${sign}${amount}`;
    case 'startMight': return `Puissance de départ ${(o.side ?? 'ally') === 'ally' ? 'alliée' : 'ennemie'} ${sign}${amount}`;
    case 'allyTestMod': return `${sign}${amount} aux Tests de Puissance alliés`;
    case 'firstRoundBonus': return `${sign}${amount} au premier Round`;
    case 'planningBonus': return `${sign}${amount} à la Planification`;
  }
}

/** Applique un Round de « Tenez votre position » (l.161-163) : accumule le Point de rupture, persiste la
 *  tenue, et — TANT QUE la position TIENT — applique l'issue `on:'success'` de la Scène (−2 Puissance
 *  ennemie) et RÉIMPOSE la Scène au Round suivant. Rupture → déroute. */
function applyHoldResolution(
  mb: MassBattleState, scene: ActivityDef, pa: PendingActivity, heroes: string[],
): { mb: MassBattleState; lines: string[] } {
  const hold = scene.hold as BattleHold;
  const prev = mb.sceneState[scene.id] ?? initHoldState();
  const r = resolveHoldRound(prev, hold, pa.enemySL ?? 0);
  const lines: string[] = [];
  let next: MassBattleState = { ...mb, sceneState: { ...mb.sceneState, [scene.id]: r.next } };
  const shown: SceneDelta[] = [];
  if (r.held) {
    // Tenu : issue `on:'success'` de la Scène (−2 Puissance ennemie), gated par la tenue.
    for (const b of matchBattleOutcomes(scene, testResolution(true, pa.sl))) {
      for (const o of (b.battle ?? [])) {
        const amount = battleOutcomeAmount(o, testResolution(true, pa.sl));
        if (amount === 0) continue;
        const ap = applyBattleOutcome(next, o, amount, scene.label);
        next = ap.mb;
        if (ap.shown) shown.push(ap.shown);
      }
    }
    lines.push(`Tenez votre position : la position tient (Point de rupture ${r.next.breakpoint}/${hold.breakpoint}) — Puissance ennemie −2. L'ennemi redoublera d'efforts (opposition +${holdEnemyBonus(hold, r.next.held)} au prochain Round).`);
  }
  if (r.next.broken) {
    lines.push(`Tenez votre position : la position CÈDE (Point de rupture ${r.next.breakpoint}/${hold.breakpoint}) — les Personnages sont submergés, déroute.`);
  } else {
    next = { ...next, imposed: uniq([...next.imposed, scene.id]) };
    if (!r.held) lines.push(`Tenez votre position : l'ennemi gagne du terrain (Point de rupture ${r.next.breakpoint}/${hold.breakpoint}).`);
  }
  next = {
    ...next,
    resolvedScenes: uniq([...next.resolvedScenes, scene.id]),
    actedHeroes: uniq([...next.actedHeroes, ...heroes]),
    sceneDeltas: [...next.sceneDeltas, ...shown],
  };
  return { mb: next, lines };
}

/** Applique l'issue d'une `PendingActivity` de BATAILLE à `MassBattleState` (appelé par `confirmActivity`).
 *  Route selon le contexte (préparation / Scène de Round) et le genre. Le budget d'Activité (une prépa =
 *  une Activité d'interlude, l.65) est décrémenté par `confirmActivity`, PAS ici (application ⊥ budget). */
export function confirmBattleActivity(get: Get, set: Set, pa: PendingActivity): void {
  const mb = get().massBattle;
  if (!mb || pa.roll == null || !pa.activityId) return;
  const lines: string[] = [];
  let next = mb;

  // Discours inspirant (l.71) : issue GLOBALE (+10 au 1er Round), pas de bande `battle`.
  if (pa.activityId === 'inspire') {
    if (pa.success) {
      next = { ...next, firstRoundBonus: next.firstRoundBonus + INSPIRE_BONUS };
      const name = get().party.find((h) => h.id === pa.heroId)?.name ?? 'Le meneur';
      lines.push(`${name} galvanise les troupes (Discours inspirant réussi) : +${INSPIRE_BONUS} au Test de Puissance du premier Round.`);
    } else {
      lines.push('Le discours ne parvient pas à galvaniser les troupes (Discours inspirant raté).');
    }
    next = { ...next, inspired: true };
    set({ massBattle: { ...next, log: [...next.log, ...lines] } });
    for (const l of lines) get().log(l);
    return;
  }

  const prepDef = pa.battle === 'prep' ? battleActivityById(pa.activityId) : undefined;
  const scene = pa.battle === 'round' ? battleSceneById(pa.activityId) : undefined;

  if (prepDef) {
    const { success, sl } = activityTestResult(pa);
    const res = testResolution(success, sl);
    const applied = applyBattleBands(next, prepDef, res, [], false);
    next = applied.mb;
    if (success && prepDef.grantsFlag) next = { ...next, [prepDef.grantsFlag]: true } as MassBattleState;
    next = { ...next, activitiesDone: uniq([...next.activitiesDone, pa.activityId]) };
    lines.push(...applied.lines);

  } else if (scene?.sceneKind === 'rally') {
    // Rassemblement (l.122) : Test de Résistance de guérison sur le héros acteur (pas l'armée).
    const hero = get().party.find((h) => h.id === pa.heroId);
    if (hero) {
      const be = bonus(effectiveChar(hero, 'E'));
      const heal = pa.success ? rallyHealAmount(pa.sl, be) : 0;
      if (heal > 0) {
        set({ party: get().party.map((h) => h.id === hero.id ? { ...h, wounds: { ...h.wounds, current: Math.min(h.wounds.max, h.wounds.current + heal) } } : h) });
        lines.push(`${hero.name} récupère au Rassemblement : +${heal} Blessures soignées (DR ${pa.sl} + BE ${be}).`);
      } else {
        lines.push(`${hero.name} ne parvient pas à récupérer au Rassemblement.`);
      }
      next = { ...next, ralliedHeroes: uniq([...next.ralliedHeroes, hero.id]) };
    }

  } else if (scene?.sceneKind === 'hold') {
    const applied = applyHoldResolution(next, scene, pa, pa.heroIds ?? [pa.heroId]);
    next = applied.mb;
    lines.push(...applied.lines);

  } else if (scene) {
    // Scène de Test (l.116-225) : delta de Puissance par l'issue.
    const applied = applyBattleBands(next, scene, testResolution(pa.success, pa.sl), pa.heroIds ?? [pa.heroId], true);
    next = applied.mb;
    lines.push(...applied.lines);
  }

  set({ massBattle: { ...next, log: [...next.log, ...lines] } });
  for (const l of lines) get().log(l);
}

// ── Scène de COMBAT tactique (l.137-145/211-225) ─────────────────────────────────────────────────

/** Démarre une Scène de COMBAT/MENACE : réutilise le combat existant. */
function startBattleCombat(get: Get, set: Set, scene: ActivityDef): void {
  const mb = get().massBattle;
  if (!mb) return;
  const encId = mb.sceneEncounters?.[scene.id] ?? scene.encounter;
  const enc = encId && get().scene?.encounters.find((e) => e.id === encId);
  if (!enc) {
    get().log(`Scène « ${scene.label} » : aucune rencontre « ${encId ?? '?'} » dans la scène courante.`);
    return;
  }
  set({ massBattle: { ...mb, combatScene: { sceneId: scene.id, hits: 0, hitters: [] } }, screen: 'campaign' });
  get().log(`Scène « ${scene.label} » : les Personnages s'engagent dans la mêlée.`);
  get().startCombat(encId);
}

/** Comptage EN DIRECT des touches d'une Scène de COMBAT (l.139/145) — appelé par `applyAttackResult`. */
export function massBattleTrackHit(get: Get, set: Set, attacker: Combatant, target: Combatant): void {
  const mb = get().massBattle;
  if (!mb?.combatScene) return;
  if (attacker.kind !== 'hero' || target.kind !== 'enemy' || isStructure(target)) return;
  const cs = mb.combatScene;
  const hitters = cs.hitters.includes(attacker.id) ? cs.hitters : [...cs.hitters, attacker.id];
  set({ massBattle: { ...mb, combatScene: { ...cs, hits: cs.hits + 1, hitters } } });
}

/** Reprise après une Scène de COMBAT (appelée par `dismissVictory`/`dismissDefeat`) : applique la
 *  réduction/malus de Puissance selon l'issue, puis revient à la vue de bataille. */
export function massBattleResumeCombat(get: Get, set: Set, kills: number, outcome: 'won' | 'lost' = 'won'): void {
  const mb = get().massBattle;
  if (!mb?.combatScene) return;
  const scene = battleSceneById(mb.combatScene.sceneId);
  const cs = mb.combatScene;
  let next: MassBattleState = { ...mb, combatScene: undefined };
  const lines: string[] = [];
  if (scene) {
    const res: BattleResolution = outcome === 'won'
      // Victoire : le général (la rencontre) est neutralisé ; intervention si > 1 frappeur (Duel l.225).
      ? { success: true, sl: 0, hits: cs.hits, kills, generalDown: true, intervention: cs.hitters.length > 1, combat: true }
      : { success: false, sl: 0, hits: cs.hits, kills: 0, generalDown: false, intervention: cs.hitters.length > 1, combat: true };
    const applied = applyBattleBands(next, scene, res, cs.hitters, true);
    next = applied.mb;
    lines.push(outcome === 'won'
      ? `Combat « ${scene.label} » remporté : ${cs.hits} touche(s), ${kills} ennemi(s) neutralisé(s).`
      : `Combat « ${scene.label} » perdu : les Personnages sont repoussés (${cs.hits} touche(s) portée(s)).`);
    lines.push(...applied.lines);
  }
  set({ massBattle: { ...next, log: [...next.log, ...lines] }, screen: 'massBattle' });
  for (const l of lines) get().log(l);
}

// ── Aléa, Test spectaculaire, Rounds, issue (l.120-124/309) ──────────────────────────────────────

/** Tire (ou choisit) le facteur environnemental du Round (l.309, 1d10). */
export function massBattleSetHazard(get: Get, set: Set, roll?: number): void {
  const mb = get().massBattle;
  if (!mb || mb.phase !== 'round') return;
  const h = battleHazard(roll ?? d10(battleRng()));
  set({ massBattle: { ...mb, hazard: { label: h.label, text: h.text }, log: [...mb.log, `Facteur environnemental : ${h.label}.`] } });
  get().log(`Facteur environnemental (aléa de bataille) : ${h.label}.`);
}

/** Résout le Test spectaculaire de Puissance du Round (l.120) puis marque l'attente du Rassemblement /
 *  passage au Round suivant (l.122-124). Ne fait PAS avancer le Round (cf. `massBattleAdvance`). */
export function massBattleClash(get: Get, set: Set): void {
  const mb = get().massBattle;
  if (!mb || mb.phase !== 'round' || mb.awaitingNext) return;
  const allyMod = mb.allyMod + (mb.round === 1 ? mb.firstRoundBonus : 0);
  const clash = resolveClash(armyMight(mb.ally), armyMight(mb.enemy), { allyMod, enemyMod: 0, rng: battleRng() });
  const ally = armyWithMightDelta(mb.ally, -clash.allyLoss);
  const enemy = armyWithMightDelta(mb.enemy, -clash.enemyLoss);
  const lines: string[] = [
    `Round ${mb.round}/${mb.plannedRounds} — Test spectaculaire de Puissance : les Personnages réduisent l'ennemi de ${clash.enemyLoss}, l'ennemi réduit les Personnages de ${clash.allyLoss}.`,
    `Puissance : ${ally.name} ${armyMight(ally)} · ${enemy.name} ${armyMight(enemy)}.`,
  ];
  let next: MassBattleState = { ...mb, ally, enemy, lastClash: clash };
  const destroyed = isDestroyed(armyMight(ally)) || isDestroyed(armyMight(enemy));
  if (destroyed || mb.round >= mb.plannedRounds) {
    const outcome = battleOutcome(armyMight(ally), armyMight(enemy));
    next = { ...next, phase: 'over', outcome };
    lines.push(outcomeLine(next, outcome, destroyed));
  } else {
    next = { ...next, awaitingNext: true };
  }
  set({ massBattle: { ...next, log: [...next.log, ...lines] } });
  for (const l of lines) get().log(l);
}

/** Passe au Round suivant (l.124) : compose la nouvelle SITUATION et réinitialise l'état par-Round. */
export function massBattleAdvance(get: Get, set: Set): void {
  const mb = get().massBattle;
  if (!mb || mb.phase !== 'round' || !mb.awaitingNext) return;
  const advanced: MassBattleState = { ...mb, round: mb.round + 1 };
  const { situation, activeThreats, imposed } = composeSituation(advanced, battleRng());
  const threatLine = describeThreats(activeThreats);
  const next: MassBattleState = {
    ...advanced,
    situation, activeThreats, imposed,
    resolvedScenes: [], actedHeroes: [], assignment: {}, ralliedHeroes: [], sceneDeltas: [],
    hazard: undefined, awaitingNext: false,
  };
  set({ massBattle: { ...next, log: threatLine ? [...next.log, threatLine] : next.log } });
  if (threatLine) get().log(threatLine);
}

function outcomeLine(mb: MassBattleState, outcome: BattleOutcome, destroyed: boolean): string {
  if (outcome === 'draw') return 'La bataille s\'achève sans vainqueur clair — les deux armées se retirent.';
  const winner = outcome === 'ally' ? mb.ally.name : mb.enemy.name;
  const loser = outcome === 'ally' ? mb.enemy.name : mb.ally.name;
  return destroyed
    ? `${loser} est anéantie ! ${winner} l'emporte.`
    : `${winner} l'emporte (Puissance supérieure). ${loser} doit fuir sous peine d'être détruite.`;
}

/** Ferme la bataille et revient au jeu. */
export function endMassBattle(get: Get, set: Set): void {
  if (!get().massBattle) return;
  set({ massBattle: null, screen: get().scene ? 'campaign' : 'menu' });
}

// ── Sélecteurs pour la vue ───────────────────────────────────────────────────────────────────────

/** Scènes PRÉSENTÉES ce Round (la situation du moment) — défs complètes, non encore résolues. */
export function massBattleScenes(mb: MassBattleState): ActivityDef[] {
  return mb.situation
    .map((id) => battleSceneById(id))
    .filter((s): s is ActivityDef => !!s);
}

/** Libellé COURT d'une issue de bataille chiffrée (aperçu de la vue). */
function shortOutcomeLabel(o: BattleOutcomeDelta): string {
  const target: Record<BattleOutcomeDelta['target'], string> = {
    might: (o.side ?? 'enemy') === 'ally' ? 'Puiss. alliée' : 'Puiss. ennemie',
    startMight: (o.side ?? 'ally') === 'ally' ? 'Puiss. alliée' : 'Puiss. ennemie',
    allyTestMod: 'Tests alliés', firstRoundBonus: '1er Round', planningBonus: 'Planification',
  };
  const per = o.scale === 'perDR' ? '/DR' : o.scale === 'perHit' ? '/touche' : o.scale === 'perKill' ? '/vaincu' : '';
  return `${o.amount >= 0 ? '+' : ''}${o.amount}${per} ${target[o.target]}`;
}

const BATTLE_WHEN_LABEL: Record<string, string> = {
  generalDown: 'général tué', intervention: 'intervention', noIntervention: 'duel solo',
  combatWon: 'victoire', combatLost: 'défaite',
};

/** Aperçu chiffré des effets d'une Scène de Round (base + conditionnels). */
export function battleSceneEffectLabel(def: ActivityDef): string {
  if (def.threat) return `Menace : ${def.threat.penalty} aux autres Scènes`;
  const parts: string[] = [];
  for (const b of def.outcomes ?? []) {
    for (const o of (b.battle ?? [])) {
      const cond = b.when ? ` (si ${BATTLE_WHEN_LABEL[b.when] ?? b.when})` : b.minSL === 6 ? ' (si Stupéfiant)' : '';
      parts.push(`${shortOutcomeLabel(o)}${cond}`);
    }
  }
  return parts.join(' ; ') || 'Sans effet direct';
}
