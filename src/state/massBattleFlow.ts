/**
 * Combat de masse / Puissance de Bataille — orchestration (ADE II ch.8, l.13-321).
 *
 * Couche STATE au-dessus du moteur PUR `engine/massBattle` : conduit la boucle de bataille.
 *
 *   PRÉ-BATAILLE (l.79-110) : jusqu'à 3 Activités (Discours l.71, Planification, Infiltration,
 *     Rassembler des forces, Repérage, Sabotage) dont l'issue alimente la Puissance de départ et les
 *     modificateurs permanents (`allyTestMod`) AVANT le premier Round.
 *   ROUND DE BATAILLE (l.114-124) : (1) configuration du terrain → composition d'une SITUATION (un
 *     SOUS-ENSEMBLE de Scènes du moment : tirage/authorées + Scènes IMPOSÉES par l'ennemi — menaces
 *     l.219 et enchaînements l.169/175/208/217/225), PAS tout le catalogue ; (2) Scènes cinématiques
 *     MULTI-PJ (l.116-118 : « les Personnages peuvent choisir de participer à l'une des Scènes » ; le MJ
 *     « inclut tous les Personnages dans au moins une Scène ») : plusieurs PJ peuvent s'engager dans UNE
 *     Scène de Test/Tenue, résolue en SOUTIEN (LDB 12 ; l.153 « tous les Personnages engagés dans la
 *     Scène », l.157 « en soutien », l.163 « Test opposé contre les Personnages ») — le meneur lance, les
 *     assistants capables ajoutent +10 (plafonné) ; les deltas plafonnés (l.135) se CUMULENT entre Scènes.
 *     Les Scènes de combat/menace engagent tout le groupe ; (3) Test spectaculaire de Puissance NON opposé
 *     (l.120) ; (4) Rassemblement (l.122) : Test de Résistance de guérison entre Rounds.
 *
 * Les jets des PJ passent par une modale de jet différée (`pendingBattleTest`, même fabrique
 * `makeRollFlow` que tous les autres flux). Le Test spectaculaire NON opposé est un jet d'ARMÉE (sans
 * Chance/Résilience personnelles) résolu directement. Une Scène `combat`/`threat` réutilise le combat
 * tactique existant (`startCombat`) ; sa victoire nourrit la réduction de Puissance (touches + kills).
 */
import type { GameState } from './store';
import type { Get, Set } from './flowTypes';
import type { PendingBase } from './rollFlow';
import type { Combatant, CharKey, Difficulty } from '../engine/types';
import { battleRng } from './battleRng';
import { d10, d100, type RNG } from '../engine/dice';
import { partyBest, testValue, bestForSkills, bestForCombined, bestAssistedOption } from '../engine/skills';
import { isStructure } from '../engine/structures';
import { bonus, effectiveChar } from '../engine/characteristics';
import { refLabel } from '../data';
import { CHAR_LABELS, DIFFICULTY_MODIFIERS } from '../engine/types';
import {
  battleSceneById, battleActivityById, BATTLE_ACTIVITIES, inspireDifficulty, INSPIRE_BONUS, resolveClash,
  sceneDeltas, sceneChains, testResolution, combatResolution, combatLossResolution, rallyHealAmount,
  activityOutcomes, applyMightDelta, battleOutcome, isDestroyed, battleHazard, clampMight,
  initHoldState, resolveHoldRound, holdEnemyBonus,
  type BattleSceneDef, type BattleActivityDef, type ClashResult, type BattleOutcome,
  type ActivityOutcome, type SceneResolution, type HoldState,
} from '../engine/massBattle';

/** Une armée engagée dans la Puissance de Bataille. */
export interface MassBattleArmy {
  name: string;
  /** Puissance courante (0-100), recalculée à la fin de chaque Round (l.19). */
  might: number;
  /** Puissance de DÉPART — plafond des gains d'une Scène (l.135). */
  startMight: number;
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
  /** 'inspire' = pré-bataille (Activités) ; 'round' = Round actif ; 'over' = terminée. */
  phase: 'inspire' | 'round' | 'over';
  /** Description narrative de la configuration du terrain du Round (l.126). */
  terrain?: string;
  /** Modificateur PERMANENT au Test de Puissance allié (Planification +10/+20, l.81). */
  allyMod: number;
  /** Bonus au Test de Puissance allié du PREMIER Round seul (Discours inspirant réussi, l.71). */
  firstRoundBonus: number;
  /** Discours inspirant déjà tenté (une fois avant la bataille). */
  inspired?: boolean;
  // ── Activités de bataille pré-combat (l.79-110) ──
  /** Ids des Activités déjà réalisées (max 3 au total avec le Discours, l.65). */
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
  /** PJ ayant agi CE Round : tout PJ engagé dans une Scène résolue (l.116-118). Une Scène de Test/Tenue
   *  MULTI-PJ consomme TOUT son équipage engagé (Soutien, l.153/157) ; un combat consomme ses frappeurs. */
  actedHeroes: string[];
  /** AFFECTATION explicite de PJ à une action CE Round — clé = id d'action (Scène OU Activité), valeur =
   *  liste ordonnée des ids de PJ postés. Une Scène de Test/Tenue accepte PLUSIEURS PJ (ADE II ch.8
   *  l.116-118 : Scènes MULTI-PJ), résolus en SOUTIEN (LDB 12 : le meneur lance, les assistants capables
   *  ajoutent +10, plafonné — l.153/157/163). Les Activités pré-combat restent SOLO (un seul id honoré,
   *  RAW l.71/75/102/106 « un Personnage »). C'est le POSTE choisi par le joueur : la résolution l'HONORE
   *  (à défaut d'affectation, ou si les PJ postés ne sont plus disponibles, on retombe sur la SUGGESTION
   *  `bestForSkills`/`bestForCombined`). Réinitialisé à chaque Round (comme `actedHeroes`). */
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
  /** État PERSISTANT par Scène entre Rounds (générique) — ex. Point de rupture d'une Scène « Tenez votre
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

/** Jet de PJ d'une bataille de masse — modale différée. */
export interface PendingBattleTest extends PendingBase {
  actorId: string;
  actorName: string;
  /** Intitulé de la situation (titre de la modale). */
  label: string;
  /** Libellé de la Compétence/Caractéristique testée (cadre de jet). */
  skill: string;
  skillId?: string;
  spec?: string;
  char?: CharKey;
  skillValue: number;
  difficulty: Difficulty;
  /** But du jet : Discours inspirant / Scène cinématique / Activité pré-combat / Rassemblement / Tenue. */
  purpose: 'inspire' | 'scene' | 'activity' | 'rally' | 'hold';
  /** Scène concernée (`purpose:'scene'`/`'hold'`). */
  sceneId?: string;
  /** Activité concernée (`purpose:'activity'`). */
  activityId?: string;
  /** TOUS les PJ engagés dans la Scène MULTI-PJ (Test/Tenue) — meneur `actorId` compris (ADE II ch.8
   *  l.116-118). Tous sont marqués « ayant agi » à la résolution (l'équipage entier est consommé). */
  heroIds?: string[];
  /** Détail du SOUTIEN fondu dans `skillValue` (l.153/157, LDB 12) — informatif pour la modale : nombre
   *  d'assistants capables et bonus cumulé (déjà inclus dans la cible). */
  support?: { count: number; bonus: number };
  // ── Test COMBINÉ (Infiltration/Repérage, l.75/102 — un jet vs DEUX compétences, LDB 12 l.229) ──
  /** Libellé de la 2ᵈᵉ compétence (Test combiné). */
  skill2?: string;
  /** Valeur NUE de la 2ᵈᵉ compétence (Test combiné). */
  skillValue2?: number;
  /** Cible EFFECTIVE de la 2ᵈᵉ compétence (base + Difficulté + mod). */
  target2?: number;
  /** Résultat vs la 2ᵈᵉ compétence (Test combiné) — mémorisé pour l'affichage/la ré-influence. */
  sl2?: number;
  success2?: boolean;
  /** Niveau du Test combiné : `full` = les deux réussies ; `partial` = une seule ; `fail` = aucune. */
  combinedLevel?: 'full' | 'partial' | 'fail';
  // ── Test OPPOSÉ de « Tenez votre position » (l.161) : l'ennemi oppose son jet FIGÉ ──
  /** Valeur (cible effective) de l'ENNEMI au Test opposé de tenue. */
  enemyValue?: number;
  /** Jet FIGÉ de l'ennemi (opposé) — posé à l'ouverture, ré-utilisé à la résolution. */
  enemyRoll?: number;
  /** DR net de l'ennemi au Test opposé de tenue (positif = l'ennemi l'emporte). */
  enemySL?: number;
  roll: number | null;
  target: number;
  sl: number;
  success: boolean;
  forced?: boolean;
  rerolled?: boolean;
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
 *  catalogue) + Scènes IMPOSÉES (enchaînements) + MENACES actives. Retourne aussi les menaces mises à
 *  jour et vide les imposées consommées. */
function composeSituation(mb: MassBattleState, rng: RNG): { situation: string[]; activeThreats: string[]; imposed: string[] } {
  const idx = mb.round - 1;
  const authored = mb.situations && mb.situations.length
    ? (mb.situations[idx] ?? mb.situations[mb.situations.length - 1])
    : null;
  const base = authored ?? drawSubset(mb.pool, mb.situationSize, rng);
  const ids = uniq([...base, ...mb.imposed, ...mb.activeThreats]).filter((id) => !!battleSceneById(id));
  // Toute Scène MENACE présentée (base/imposée) et non résolue rejoint les menaces actives.
  const threats = uniq([...mb.activeThreats, ...ids.filter((id) => battleSceneById(id)?.kind === 'threat')]);
  return { situation: ids, activeThreats: threats, imposed: [] };
}

/** Pénalité active infligée aux Tests des Scènes ce Round (Intrus l.219 : −20 tant que la menace vit). */
export function massBattleThreatPenalty(mb: MassBattleState): number {
  return mb.activeThreats.reduce((sum, id) => sum + (battleSceneById(id)?.threat?.penalty ?? 0), 0);
}

/** Nombre d'Activités de préparation déjà réalisées (Discours compris, l.65 : max 3). */
export function prepCount(mb: MassBattleState): number {
  return mb.activitiesDone.length + (mb.inspired ? 1 : 0);
}

/** Activités pré-combat disponibles (prérequis satisfaits, quota de 3 non atteint, non déjà faites). */
export function battleActivitiesAvailable(mb: MassBattleState): BattleActivityDef[] {
  if (prepCount(mb) >= 3) return [];
  return BATTLE_ACTIVITIES.filter((a) => {
    if (mb.activitiesDone.includes(a.id)) return false;
    if (a.requires === 'planned' && !mb.planned) return false;
    if (a.requires === 'scouted' && !mb.scouted) return false;
    return true;
  });
}

// ── Amorçage ─────────────────────────────────────────────────────────────────────────────────────

const DEFAULT_SITUATION_SIZE = 3;

/** Ouvre une bataille de masse et bascule sur sa vue. */
export function startMassBattle(get: Get, set: Set, spec: MassBattleSpec): void {
  if (get().battle) { get().log('Impossible d\'ouvrir une bataille de masse en plein combat tactique.'); return; }
  const allyMight = clampMight(spec.allyMight);
  const enemyMight = clampMight(spec.enemyMight);
  const pool = (spec.scenes && spec.scenes.length ? spec.scenes : DEFAULT_POOL).filter((id) => !!battleSceneById(id));
  const mb: MassBattleState = {
    ally: { name: spec.allyName ?? 'Armée des Personnages', might: allyMight, startMight: allyMight },
    enemy: { name: spec.enemyName ?? 'Armée ennemie', might: enemyMight, startMight: enemyMight },
    plannedRounds: Math.max(1, Math.floor(spec.plannedRounds ?? 1)),
    round: 1,
    phase: 'inspire',
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
    // Rencontres des Scènes de combat (par id) — mémorisées pour `startBattleCombat`.
    sceneEncounters: spec.sceneEncounters,
    sceneState: {},
    log: [`Bataille engagée : ${spec.allyName ?? 'les Personnages'} (Puissance ${allyMight}) contre ${spec.enemyName ?? 'l\'ennemi'} (Puissance ${enemyMight}).`],
  };
  set({ massBattle: mb, screen: 'massBattle' });
}

/** Catalogue par défaut (tout ce qui existe) — la pioche des situations. */
const DEFAULT_POOL = [
  'motivation', 'pluie-de-fleches', 'protection', 'tenez-votre-position', 'compte-a-rebours',
  'percee', 'ligne-de-mire', 'tuez-la-bete', 'survol', 'charge', 'duel', 'intrus',
];

/** Passe de la phase pré-bataille aux Rounds : compose la situation du Round 1. */
export function massBattleBegin(get: Get, set: Set): void {
  const mb = get().massBattle;
  if (!mb || mb.phase !== 'inspire') return;
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

// ── Activités pré-combat (l.79-110) ──────────────────────────────────────────────────────────────

/** Ouvre le Test de Commandement du Discours inspirant (l.71). Difficulté = écart de Puissance
 *  arrondi à la dizaine ; en cas de succès → +10 au Test de Puissance du premier Round. */
export function openMassBattleInspire(get: Get, set: Set): void {
  const mb = get().massBattle;
  if (!mb || mb.phase !== 'inspire' || mb.inspired || prepCount(mb) >= 3) return;
  // Acteur = PJ posté au Discours (à défaut, SUGGESTION = meilleur en Commandement). Sans poste, l'acteur EST
  // la suggestion et `testValue(chosen, 'commandement')` reproduit `partyBest(...).value` → byte-identique.
  const party = get().party.filter((h) => !h.dead);
  const chosen = assignedHeroesFor(mb, party, 'inspire')[0] ?? partyBest(party, 'commandement')?.actor;
  if (!chosen) return;
  const difficulty = inspireDifficulty(mb.ally.might, mb.enemy.might);
  openBattleTest(get, set, {
    actor: chosen, skillValue: testValue(chosen, 'commandement'), skillId: 'commandement', difficulty,
    label: 'Discours inspirant', purpose: 'inspire',
  });
}

/** Résout l'AFFECTATION explicite d'une action (`assignment[actionId]`) en la LISTE des PJ effectivement
 *  DISPONIBLES : membres du groupe, vivants, non encore engagés ce Round (`actedHeroes`). Ordre des ids
 *  postés préservé, entrées invalides (absent/mort/déjà agi) écartées. Tableau vide si aucun poste valable
 *  — l'appelant retombe alors sur la SUGGESTION (`bestForSkills`/`bestForCombined`). Une Scène MULTI-PJ
 *  (ADE II ch.8 l.116-118) est ainsi résolue en Soutien sur TOUT cet équipage. Pur : lit l'état, ne mute rien. */
export function assignedHeroesFor(mb: MassBattleState, party: Combatant[], actionId: string): Combatant[] {
  const ids = mb.assignment[actionId] ?? [];
  return ids
    .map((id) => party.find((h) => h.id === id))
    .filter((h): h is Combatant => !!h && !h.dead && !mb.actedHeroes.includes(h.id));
}

/** Enregistre l'AFFECTATION de PJ à une action du Round (Scène MULTI-PJ / Activité SOLO) : remplace la
 *  liste postée par `heroIds` (efface la clé si vide). N'agit qu'en présence d'une bataille ; ne valide PAS
 *  la disponibilité ici (la résolution la re-vérifie via `assignedHeroesFor`, retombant sur la suggestion
 *  si les postes sont devenus invalides). Le picker de l'UI compose la liste (ajout/retrait). */
export function setMassBattleHero(get: Get, set: Set, actionId: string, heroIds: string[]): void {
  const mb = get().massBattle;
  if (!mb) return;
  const assignment = { ...mb.assignment };
  if (heroIds.length) assignment[actionId] = heroIds; else delete assignment[actionId];
  set({ massBattle: { ...mb, assignment } });
}

/** Ouvre le Test d'une Activité de bataille pré-combat (Planification/Infiltration/… l.79-106). Un Test
 *  COMBINÉ (Infiltration/Repérage, `def.combined`) confronte UN jet aux DEUX compétences de l'acteur. */
export function openMassBattleActivity(get: Get, set: Set, activityId: string): void {
  const mb = get().massBattle;
  const def = battleActivityById(activityId);
  if (!mb || mb.phase !== 'inspire' || !def) return;
  if (mb.activitiesDone.includes(activityId) || prepCount(mb) >= 3) return;
  if (def.requires === 'planned' && !mb.planned) return;
  if (def.requires === 'scouted' && !mb.scouted) return;
  const party = get().party.filter((h) => !h.dead);
  // Le Repérage/Infiltration boostent le Test de Planification (`planningBonus`, l.75/100).
  const mod = activityId === 'planification' ? mb.planningBonus : 0;
  if (def.combined && def.skills && def.skills.length >= 2) {
    // Test COMBINÉ (l.75/102) : l'acteur posté décide (à défaut, SUGGESTION = celui maximisant le PLUS FAIBLE
    // des deux, le facteur limitant). Les DEUX valeurs de l'acteur RETENU sont dérivées via une passe
    // SINGLETON (`bestForCombined([chosen], …)`), puis testées par un même jet à la résolution.
    const chosen = assignedHeroesFor(mb, party, activityId)[0] ?? bestForCombined(party, def.skills[0], def.skills[1], def.char)?.actor;
    if (!chosen) return;
    const picked = bestForCombined([chosen], def.skills[0], def.skills[1], def.char);
    if (!picked) return;
    openBattleTest(get, set, {
      actor: picked.actor, skillValue: picked.value1, skillId: def.skills[0].skillId, spec: def.skills[0].spec, char: def.char,
      difficulty: def.difficulty ?? 'intermediaire', label: def.label, purpose: 'activity', activityId, mod,
      combined: { skillId: def.skills[1].skillId, spec: def.skills[1].spec, value: picked.value2 },
    });
    return;
  }
  // Activité SOLO (RAW l.71/75/102/106 « un Personnage ») : acteur = PJ posté (à défaut, SUGGESTION = meilleur
  // du groupe) ; ses valeurs de compétence dérivées par une passe SINGLETON `bestForSkills([chosen], …)` —
  // sans poste, l'acteur EST la suggestion, byte-identique. PAS de Soutien pour une Activité pré-combat.
  const chosen = assignedHeroesFor(mb, party, activityId)[0] ?? bestForSkills(party, def.skills, def.char)?.actor;
  if (!chosen) return;
  const picked = bestForSkills([chosen], def.skills, def.char);
  if (!picked) return;
  openBattleTest(get, set, {
    actor: picked.actor, skillValue: picked.value, skillId: picked.skillId, spec: picked.spec, char: def.char,
    difficulty: def.difficulty ?? 'intermediaire', label: def.label, purpose: 'activity', activityId, mod,
  });
}

// ── Scènes cinématiques (l.116-225) ──────────────────────────────────────────────────────────────

/** Choisit une Scène de la SITUATION : 'test' → modale de jet ; 'hold' → Test opposé de tenue ;
 *  'combat'/'threat' → combat tactique. Scène MULTI-PJ (l.116-118) : plusieurs PJ peuvent s'engager dans
 *  une Scène de Test/Tenue, résolue en SOUTIEN (LDB 12 ; l.153/157) — le meneur lance la valeur SOUTENUE ;
 *  à défaut d'affectation, le meilleur PJ DISPONIBLE décide seul. Les combats engagent tous les frappeurs. */
export function openMassBattleScene(get: Get, set: Set, sceneId: string): void {
  const mb = get().massBattle;
  const scene = battleSceneById(sceneId);
  if (!mb || mb.phase !== 'round' || mb.awaitingNext || !scene) return;
  if (!mb.situation.includes(sceneId) || mb.resolvedScenes.includes(sceneId)) return;
  if (scene.kind === 'combat' || scene.kind === 'threat') { startBattleCombat(get, set, scene); return; }
  if (scene.kind === 'hold') { openHoldScene(get, set, scene); return; }
  // Scène 'test' MULTI-PJ (l.116-118/151/153) : compétences AU CHOIX. Équipe = les PJ POSTÉS disponibles ;
  // à défaut, la SUGGESTION = le meilleur PJ disponible SEUL (comportement inchangé sans affectation). La
  // valeur SOUTENUE (`bestAssistedOption` : meneur + Soutien LDB 12) est jouée par le meneur (`picked.actor`).
  const party = get().party.filter((h) => !h.dead && !mb.actedHeroes.includes(h.id));
  if (!party.length) { get().log('Tous les Personnages ont déjà agi ce Round.'); return; }
  const crew = assignedHeroesFor(mb, party, scene.id);
  const solo = bestForSkills(party, scene.skills, scene.char)?.actor;
  const team = crew.length ? crew : (solo ? [solo] : []);
  if (!team.length) return;
  const picked = bestAssistedOption(team, scene.skills, scene.char);
  if (!picked) return;
  const mod = massBattleThreatPenalty(mb); // Intrus l.219 : −20 aux Tests des autres Scènes.
  openBattleTest(get, set, {
    actor: picked.actor, skillValue: picked.value, skillId: picked.skillId, spec: picked.spec, char: scene.char,
    difficulty: scene.difficulty ?? 'intermediaire', label: scene.label, purpose: 'scene', sceneId: scene.id, mod,
    heroIds: team.map((h) => h.id), support: picked.support,
  });
}

/** Ouvre le Test OPPOSÉ d'une Scène « Tenez votre position » (l.161-163 : « l'ennemi effectue un Test opposé
 *  contre les Personnages ») : les PJ engagés défendent la position en SOUTIEN (LDB 12 ; le meneur lance la
 *  valeur soutenue) ; l'ennemi oppose un jet FIGÉ (valeur = Puissance ennemie, abstraction de « des
 *  Compétences adaptées à la situation ») augmenté du bonus cumulatif de tenue (`holdEnemyBonus` selon les
 *  Rounds déjà tenus, l.163). Le DR net de l'ennemi alimente le Point de rupture à la résolution. */
function openHoldScene(get: Get, set: Set, scene: BattleSceneDef): void {
  const mb = get().massBattle;
  if (!mb || !scene.hold) return;
  const state = mb.sceneState[scene.id] ?? initHoldState();
  if (state.broken) { get().log(`Scène « ${scene.label} » : la position a déjà cédé (déroute).`); return; }
  const party = get().party.filter((h) => !h.dead && !mb.actedHeroes.includes(h.id));
  if (!party.length) { get().log('Tous les Personnages ont déjà agi ce Round.'); return; }
  // Défenseurs = PJ postés disponibles ; à défaut, le meilleur PJ disponible SEUL. Résolution SOUTENUE
  // (`bestAssistedOption`) : le meneur lance, les assistants capables ajoutent +10 (plafonné, l.153/157).
  const crew = assignedHeroesFor(mb, party, scene.id);
  const solo = bestForSkills(party, scene.skills, scene.char)?.actor;
  const team = crew.length ? crew : (solo ? [solo] : []);
  if (!team.length) return;
  const picked = bestAssistedOption(team, scene.skills, scene.char);
  if (!picked) return;
  const held = state.held;
  const enemyBonus = holdEnemyBonus(scene.hold, held); // +10 cumulatif par Round déjà tenu (l.163).
  const mod = massBattleThreatPenalty(mb);
  // Jet FIGÉ de l'ennemi (Test opposé, l.161) : Puissance ennemie + bonus cumulatif de tenue, borné [1,99].
  const enemyValue = Math.max(1, Math.min(99, mb.enemy.might + enemyBonus));
  const enemyRoll = d100(battleRng());
  openBattleTest(get, set, {
    actor: picked.actor, skillValue: picked.value, skillId: picked.skillId, spec: picked.spec, char: scene.char,
    difficulty: scene.difficulty ?? 'intermediaire', label: scene.label, purpose: 'hold', sceneId: scene.id, mod,
    enemyValue, enemyRoll, heroIds: team.map((h) => h.id), support: picked.support,
  });
}

// ── Rassemblement (l.122) ────────────────────────────────────────────────────────────────────────

/** Ouvre le Test de Résistance de guérison du Rassemblement (l.122) pour le prochain PJ vivant n'ayant
 *  pas encore récupéré ce Round. Disponible entre les Rounds (post-clash). */
export function openMassBattleRally(get: Get, set: Set): void {
  const mb = get().massBattle;
  if (!mb || mb.phase !== 'round' || !mb.awaitingNext) return;
  const hero = get().party.find((h) => !h.dead && !mb.ralliedHeroes.includes(h.id) && h.wounds.current < h.wounds.max);
  if (!hero) { get().log('Aucun Personnage à soigner au Rassemblement.'); return; }
  openBattleTest(get, set, {
    actor: hero, skillValue: testValue(hero, 'resistance'), skillId: 'resistance',
    difficulty: 'intermediaire', label: 'Rassemblement (Résistance)', purpose: 'rally',
  });
}

// ── Fabrique de modale + application des jets ────────────────────────────────────────────────────

/** Fabrique commune d'une modale de jet de bataille (Discours/Scène/Activité/Rassemblement/Tenue). Porte
 *  le Test COMBINÉ (`combined` : seconde compétence testée par le MÊME jet, l.75/102) et le Test OPPOSÉ de
 *  tenue (`enemyValue`/`enemyRoll`, l.161 : jet ENNEMI figé). */
function openBattleTest(get: Get, set: Set, o: {
  actor: Combatant; skillValue: number; skillId?: string; spec?: string; char?: CharKey;
  difficulty: Difficulty; label: string; purpose: PendingBattleTest['purpose']; sceneId?: string; activityId?: string; mod?: number;
  combined?: { skillId: string; spec?: string; value: number };
  enemyValue?: number; enemyRoll?: number;
  /** PJ engagés dans une Scène MULTI-PJ (meneur compris) — tous consommés à la résolution (l.116-118). */
  heroIds?: string[];
  /** Détail du Soutien fondu dans `skillValue` (informatif pour la modale). */
  support?: { count: number; bonus: number };
}): void {
  const skill = o.skillId ? refLabel('skills', { id: o.skillId, spec: o.spec }) : o.char ? CHAR_LABELS[o.char] : 'Test';
  const diffMod = DIFFICULTY_MODIFIERS[o.difficulty] + (o.mod ?? 0);
  // Cible EFFECTIVE précalculée (base + Difficulté + modificateur de situation), bornée à [1, 99].
  const target = Math.max(1, Math.min(99, o.skillValue + diffMod));
  const combined = o.combined
    ? { skill2: refLabel('skills', { id: o.combined.skillId, spec: o.combined.spec }), skillValue2: o.combined.value, target2: Math.max(1, Math.min(99, o.combined.value + diffMod)) }
    : {};
  set({
    pendingBattleTest: {
      actorId: o.actor.id, actorName: o.actor.name, label: o.label, skill,
      skillId: o.skillId, spec: o.spec, char: o.char, skillValue: o.skillValue, difficulty: o.difficulty,
      purpose: o.purpose, sceneId: o.sceneId, activityId: o.activityId, roll: null, target, sl: 0, success: false,
      enemyValue: o.enemyValue, enemyRoll: o.enemyRoll, heroIds: o.heroIds, support: o.support, ...combined,
    },
  });
}

/** Applique un delta de Puissance à un camp (plafonné à la Puissance de départ pour un gain, l.135). */
function applyDelta(mb: MassBattleState, side: 'ally' | 'enemy', delta: number): MassBattleState {
  const army = mb[side];
  const might = applyMightDelta(army.might, army.startMight, delta);
  return { ...mb, [side]: { ...army, might } };
}

/** Applique les deltas + enchaînements d'une Scène résolue, met à jour situation/menaces/agissants. */
function applySceneResolution(
  mb: MassBattleState, scene: BattleSceneDef, res: SceneResolution, heroes: string[],
): { mb: MassBattleState; lines: string[] } {
  let next = mb;
  const deltas = sceneDeltas(scene, res);
  const shown: SceneDelta[] = [];
  for (const d of deltas) {
    next = applyDelta(next, d.side, d.amount);
    shown.push({ side: d.side, amount: d.amount, label: scene.label });
  }
  const chains = sceneChains(scene, res);
  const lines: string[] = [];
  if (res.success || deltas.length) lines.push(sceneOutcomeLine(scene, res, deltas));
  else lines.push(`Scène « ${scene.label} » échouée — aucun effet sur la Puissance.`);
  for (const cid of chains) {
    const cname = battleSceneById(cid)?.label ?? cid;
    lines.push(`Enchaînement : la Scène « ${cname} » s'impose au prochain Round.`);
  }
  next = {
    ...next,
    resolvedScenes: uniq([...next.resolvedScenes, scene.id]),
    actedHeroes: uniq([...next.actedHeroes, ...heroes]),
    imposed: uniq([...next.imposed, ...chains]),
    activeThreats: scene.kind === 'threat' ? next.activeThreats.filter((id) => id !== scene.id) : next.activeThreats,
    sceneDeltas: [...next.sceneDeltas, ...shown],
  };
  return { mb: next, lines };
}

function sceneOutcomeLine(scene: BattleSceneDef, res: SceneResolution, deltas: { side: 'ally' | 'enemy'; amount: number }[]): string {
  if (!deltas.length) return `Scène « ${scene.label} » résolue — aucun effet sur la Puissance.`;
  const parts = deltas.map((d) => `Puissance ${d.side === 'ally' ? 'alliée' : 'ennemie'} ${d.amount >= 0 ? '+' : ''}${d.amount}`);
  return `Scène « ${scene.label} » résolue : ${parts.join(' ; ')}.`;
}

/** Applique un Round de « Tenez votre position » (l.161-163) : accumule le Point de rupture depuis le DR
 *  net de l'ennemi (`pt.enemySL`), persiste l'état de tenue dans `sceneState`, et — TANT QUE la position
 *  TIENT — applique la réduction −2 de la Puissance ennemie (effet `success` de la Scène) et RÉIMPOSE la
 *  Scène au Round suivant (elle recommence chaque Round). Rupture (Point de rupture ≥ seuil OU Rounds max)
 *  → déroute : la Scène n'est plus réimposée. Les PJ engagés (`heroes`) sont consommés ce Round (Scène
 *  MULTI-PJ résolue en Soutien, ADE II ch.8 l.116-118/153/157/163). */
function applyHoldResolution(
  mb: MassBattleState, scene: BattleSceneDef, pt: PendingBattleTest, heroes: string[],
): { mb: MassBattleState; lines: string[] } {
  const hold = scene.hold!;
  const prev = mb.sceneState[scene.id] ?? initHoldState();
  const r = resolveHoldRound(prev, hold, pt.enemySL ?? 0);
  const lines: string[] = [];
  let next: MassBattleState = { ...mb, sceneState: { ...mb.sceneState, [scene.id]: r.next } };
  const shown: SceneDelta[] = [];
  if (r.held) {
    // Tenu : −2 de Puissance ennemie (effet `success` de la Scène, gaté par la tenue), et la Scène se
    // représente au Round suivant avec un bonus d'opposition accru (l.163).
    const res = testResolution(true, pt.sl);
    for (const d of sceneDeltas(scene, res)) {
      next = applyDelta(next, d.side, d.amount);
      shown.push({ side: d.side, amount: d.amount, label: scene.label });
    }
    lines.push(`Tenez votre position : la position tient (Point de rupture ${r.next.breakpoint}/${hold.breakpoint}) — Puissance ennemie −2. L'ennemi redoublera d'efforts (opposition +${holdEnemyBonus(hold, r.next.held)} au prochain Round).`);
  }
  if (r.next.broken) {
    lines.push(`Tenez votre position : la position CÈDE (Point de rupture ${r.next.breakpoint}/${hold.breakpoint}) — les Personnages sont submergés, déroute.`);
  } else {
    // Non rompue : la Scène RECOMMENCE au Round suivant (réimposée), le Point de rupture PERSISTE.
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

/** « Appliquer » d'un jet de bataille : consomme le résultat et applique l'effet selon le `purpose`. */
export function battleTestConfirm(get: Get, set: Set): void {
  const pt = get().pendingBattleTest;
  const mb = get().massBattle;
  set({ pendingBattleTest: null });
  if (!pt || pt.roll == null || !mb) return;
  const lines: string[] = [];
  let next = mb;

  if (pt.purpose === 'inspire') {
    if (pt.success) {
      next = { ...next, firstRoundBonus: next.firstRoundBonus + INSPIRE_BONUS };
      lines.push(`${pt.actorName} galvanise les troupes (Discours inspirant réussi) : +${INSPIRE_BONUS} au Test de Puissance du premier Round.`);
    } else {
      lines.push(`${pt.actorName} ne parvient pas à galvaniser les troupes (Discours inspirant raté).`);
    }
    next = { ...next, inspired: true };

  } else if (pt.purpose === 'activity' && pt.activityId) {
    const def = battleActivityById(pt.activityId);
    if (def) {
      // Test COMBINÉ (l.75/102) : l'Activité RÉUSSIT sur `full` (les deux compétences réussies) ; le DR qui
      // décide du palier (Stupéfiant/normal/Échec Stupéfiant) est le PLUS FAIBLE des deux (facteur limitant).
      const { success, sl } = activityTestResult(pt);
      const outcomes = activityOutcomes(def, success, sl);
      next = applyActivityOutcomes(next, outcomes);
      if (success && def.grantsFlag) next = { ...next, [def.grantsFlag]: true } as MassBattleState;
      next = { ...next, activitiesDone: uniq([...next.activitiesDone, pt.activityId]) };
      lines.push(activityOutcomeLine(pt.actorName, def, success, sl, outcomes, pt.combinedLevel));
    }

  } else if (pt.purpose === 'hold' && pt.sceneId) {
    const scene = battleSceneById(pt.sceneId);
    if (scene?.hold) {
      // Scène MULTI-PJ : TOUS les défenseurs engagés sont consommés ce Round (l.116-118), pas seulement le meneur.
      const applied = applyHoldResolution(next, scene, pt, pt.heroIds ?? [pt.actorId]);
      next = applied.mb;
      lines.push(...applied.lines);
    }

  } else if (pt.purpose === 'rally') {
    const hero = get().party.find((h) => h.id === pt.actorId);
    if (hero) {
      const be = bonus(effectiveChar(hero, 'E'));
      const heal = pt.success ? rallyHealAmount(pt.sl, be) : 0;
      if (heal > 0) {
        set({ party: get().party.map((h) => h.id === hero.id ? { ...h, wounds: { ...h.wounds, current: Math.min(h.wounds.max, h.wounds.current + heal) } } : h) });
        lines.push(`${pt.actorName} récupère au Rassemblement : +${heal} Blessures soignées (DR ${pt.sl} + BE ${be}).`);
      } else {
        lines.push(`${pt.actorName} ne parvient pas à récupérer au Rassemblement.`);
      }
      next = { ...next, ralliedHeroes: uniq([...next.ralliedHeroes, hero.id]) };
    }

  } else if (pt.purpose === 'scene' && pt.sceneId) {
    const scene = battleSceneById(pt.sceneId);
    if (scene) {
      const res = testResolution(pt.success, pt.sl);
      // Scène MULTI-PJ : TOUT l'équipage engagé est consommé ce Round (l.116-118), pas seulement le meneur.
      const applied = applySceneResolution(next, scene, res, pt.heroIds ?? [pt.actorId]);
      next = applied.mb;
      lines.push(...applied.lines);
    }
  }

  set({ massBattle: { ...next, log: [...next.log, ...lines] } });
  for (const l of lines) get().log(l);
}

/** Applique les issues chiffrées d'une Activité pré-combat à la Puissance/aux modificateurs. */
function applyActivityOutcomes(mb: MassBattleState, outcomes: ActivityOutcome[]): MassBattleState {
  let next = mb;
  for (const o of outcomes) {
    switch (o.target) {
      case 'allyTestMod': next = { ...next, allyMod: next.allyMod + o.amount }; break;
      case 'firstRoundBonus': next = { ...next, firstRoundBonus: next.firstRoundBonus + o.amount }; break;
      case 'planningBonus': next = { ...next, planningBonus: next.planningBonus + o.amount }; break;
      case 'allyMight': {
        // Pré-bataille : ajuste la Puissance ALLIÉE de départ ET courante (plafond l.135 recalé).
        const might = clampMight(Math.max(0, next.ally.might + o.amount));
        const startMight = clampMight(Math.max(0, next.ally.startMight + o.amount));
        next = { ...next, ally: { ...next.ally, might, startMight } };
        break;
      }
      case 'enemyMight': {
        const might = clampMight(Math.max(0, next.enemy.might + o.amount));
        const startMight = clampMight(Math.max(0, next.enemy.startMight + o.amount));
        next = { ...next, enemy: { ...next.enemy, might, startMight } };
        break;
      }
    }
  }
  return next;
}

/** Issue effective (Succès + DR de palier) d'une Activité, Test COMBINÉ compris (l.75/102) : un Test
 *  combiné RÉUSSIT sur `full` (les deux compétences réussies) ; son DR de palier (Stupéfiant/Échec
 *  Stupéfiant) = le PLUS FAIBLE des deux DR (facteur limitant). Un Test simple retourne son propre couple. */
function activityTestResult(pt: PendingBattleTest): { success: boolean; sl: number } {
  if (pt.combinedLevel) {
    const sl = Math.min(pt.sl, pt.sl2 ?? pt.sl);
    return { success: pt.combinedLevel === 'full', sl };
  }
  return { success: pt.success, sl: pt.sl };
}

function activityOutcomeLine(actor: string, def: BattleActivityDef, success: boolean, sl: number, outcomes: ActivityOutcome[], combinedLevel?: 'full' | 'partial' | 'fail'): string {
  const combinedNote = combinedLevel === 'partial' ? ' (Test combiné : une seule Compétence réussie)' : '';
  if (!success && !outcomes.length) return `${actor} échoue à l'Activité « ${def.label} »${combinedNote} — sans effet.`;
  if (!success) return `${actor} rate l'Activité « ${def.label} » (Échec Stupéfiant) : ${describeOutcomes(outcomes)}.`;
  const kind = sl >= 6 ? 'Succès Stupéfiant' : 'Succès';
  return `${actor} réussit l'Activité « ${def.label} » (${kind}) : ${describeOutcomes(outcomes)}.`;
}

function describeOutcomes(outcomes: ActivityOutcome[]): string {
  if (!outcomes.length) return 'aucun effet';
  const label: Record<ActivityOutcome['target'], string> = {
    allyTestMod: 'modificateur aux Tests de Puissance alliés',
    allyMight: 'Puissance alliée',
    enemyMight: 'Puissance ennemie',
    firstRoundBonus: 'bonus au premier Round',
    planningBonus: 'bonus à la Planification',
  };
  return outcomes.map((o) => `${o.amount >= 0 ? '+' : ''}${o.amount} ${label[o.target]}`).join(' ; ');
}

// ── Scène de COMBAT tactique (l.137-145/211-225) ─────────────────────────────────────────────────

/** Démarre une Scène de COMBAT/MENACE : réutilise le combat existant. La victoire nourrit la réduction
 *  de Puissance (touches + kills, l.139/145 ; issue de Duel −20/−10+Charge, l.225). */
function startBattleCombat(get: Get, set: Set, scene: BattleSceneDef): void {
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

/** Comptage EN DIRECT des touches d'une Scène de COMBAT (l.139/145) — appelé par `applyAttackResult`
 *  à chaque touche. Ne compte QUE les touches d'un HÉROS sur un ENNEMI (hors structure de siège). */
export function massBattleTrackHit(get: Get, set: Set, attacker: Combatant, target: Combatant): void {
  const mb = get().massBattle;
  if (!mb?.combatScene) return;
  if (attacker.kind !== 'hero' || target.kind !== 'enemy' || isStructure(target)) return;
  const cs = mb.combatScene;
  const hitters = cs.hitters.includes(attacker.id) ? cs.hitters : [...cs.hitters, attacker.id];
  set({ massBattle: { ...mb, combatScene: { ...cs, hits: cs.hits + 1, hitters } } });
}

/** Reprise après une Scène de COMBAT (appelée par `dismissVictory`/`dismissDefeat`) : applique la
 *  réduction/malus de Puissance selon l'issue, puis revient à la vue de bataille. VICTOIRE (`won`) :
 *  touches + kills (l.139), effets `combatWon`. DÉFAITE (`lost`) : effets `combatLost` (Duel l.223 : le
 *  camp allié vaincu perd −20 ; Percée l.175 : échec→Charge) — la bataille CONTINUE (pas d'écran de
 *  défaite). Les héros sont soignés (le combat de scène ne tue pas définitivement le groupe). */
export function massBattleResumeCombat(get: Get, set: Set, kills: number, outcome: 'won' | 'lost' = 'won'): void {
  const mb = get().massBattle;
  if (!mb?.combatScene) return;
  const scene = battleSceneById(mb.combatScene.sceneId);
  const cs = mb.combatScene;
  let next: MassBattleState = { ...mb, combatScene: undefined };
  const lines: string[] = [];
  if (scene) {
    const res = outcome === 'won'
      ? combatResolution(cs.hits, kills, cs.hitters.length)
      : combatLossResolution(cs.hits, cs.hitters.length);
    const applied = applySceneResolution(next, scene, res, cs.hitters);
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
  const clash = resolveClash(mb.ally.might, mb.enemy.might, { allyMod, enemyMod: 0, rng: battleRng() });
  const lines: string[] = [
    `Round ${mb.round}/${mb.plannedRounds} — Test spectaculaire de Puissance : les Personnages réduisent l'ennemi de ${clash.enemyLoss}, l'ennemi réduit les Personnages de ${clash.allyLoss}.`,
    `Puissance : ${mb.ally.name} ${clash.allyMight} · ${mb.enemy.name} ${clash.enemyMight}.`,
  ];
  let next: MassBattleState = {
    ...mb,
    ally: { ...mb.ally, might: clash.allyMight },
    enemy: { ...mb.enemy, might: clash.enemyMight },
    lastClash: clash,
  };
  const destroyed = isDestroyed(clash.allyMight) || isDestroyed(clash.enemyMight);
  if (destroyed || mb.round >= mb.plannedRounds) {
    const outcome = battleOutcome(clash.allyMight, clash.enemyMight);
    next = { ...next, phase: 'over', outcome };
    lines.push(outcomeLine(next, outcome, destroyed));
  } else {
    next = { ...next, awaitingNext: true };
  }
  set({ massBattle: { ...next, log: [...next.log, ...lines] } });
  for (const l of lines) get().log(l);
}

/** Passe au Round suivant (l.124) : compose la nouvelle SITUATION et réinitialise l'état par-Round.
 *  Les MENACES actives et les Scènes IMPOSÉES (enchaînements) sont conservées puis intégrées. */
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
export function massBattleScenes(mb: MassBattleState): BattleSceneDef[] {
  return mb.situation
    .map((id) => battleSceneById(id))
    .filter((s): s is BattleSceneDef => !!s);
}
