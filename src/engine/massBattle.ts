/**
 * Combat de masse / Puissance de Bataille — ADE II ch.8 « Le théâtre de la guerre » (l.13-321).
 *
 * Règles FACULTATIVES de bataille à grande échelle qui restent centrées sur les Personnages : deux
 * camps opposés portent un Attribut de PUISSANCE (0-100 — « la taille de leur armée entière, et la
 * maîtrise relative de leurs soldats », l.17-19), réduit à chaque Round de bataille par un « Test
 * spectaculaire de Puissance » NON opposé. Les Personnages influent sur l'issue via des Scènes
 * cinématiques (quelques Rounds de Combat OU un Test de Compétence) et un Discours inspirant.
 *
 * Moteur PUR (aucun import `state`, règle 3) + data-driven (`mass-battle.json` : tables verbatim de
 * l'estimation de Puissance, des modificateurs, des machines de guerre, des structures, des facteurs
 * environnementaux et des Scènes cinématiques). Aucune valeur inventée (règle 1).
 */
import data from '../data/mass-battle.json';
import { rollTest, type TestResult } from './tests';
import { DIFFICULTY_MODIFIERS, type Difficulty } from './types';
import { RNG, defaultRNG } from './dice';
import { findTableEntry } from './tables';
import type { TestSpec } from './skills';

// ── Tables verbatim (`mass-battle.json`) ─────────────────────────────────────────────────────────

/** Une ligne de la table d'estimation par force relative (l.26-33) : Puissance alliée/ennemie de départ. */
export interface PowerEstimateRow { id: string; label: string; ally: number; enemy: number; example: string }
/** Un modificateur de Puissance par ASPECT d'armée (l.36-47) : ±10/±20/±30 selon équipement/Vétérans/Taille. */
export interface MightModifierRow { id: string; label: string; mod: number; example: string }
/** Une machine de guerre (l.235-247) — statistiques verbatim ; `siege` = porte l'Atout Siège. */
export interface WarMachineRow { id: string; label: string; price: string; crew: number; availability: string; range: string; damage: string; traits: string; siege: boolean }
/** Une structure ciblable par les armes de siège (l.282-288) : BE + Blessures + Atout. */
export interface StructureRow { id: string; label: string; be: number; wounds: number; traits: string }
/** Un facteur environnemental d'aléa de bataille (l.311-322, 1d10) — texte verbatim. */
export interface HazardRow { min: number; max: number; label: string; text: string }
/** Genre de Scène : `test` (Compétence des PJ), `combat` (rencontre tactique réutilisant `startCombat`),
 *  `threat` (Scène MENACE qui s'IMPOSE, ex. Intrus l.219 : pénalise les autres Scènes tant qu'elle
 *  n'est pas vaincue), `hold` (Tenez votre position l.161 : Test OPPOSÉ récurrent qui accumule un
 *  Point de rupture entre Rounds). */
export type SceneKind = 'test' | 'combat' | 'threat' | 'hold';
/** Échelle d'un delta de Puissance : `perDR` × DR du Test (l.151) ; `perHit` × touches (Charge/Pluie
 *  de flèches l.139/145) ; `perKill` × ennemis neutralisés (l.139) ; `fixed` = montant plat. */
export type SceneScale = 'perDR' | 'perHit' | 'perKill' | 'fixed';
/** Condition d'application d'un effet/enchaînement, évaluée contre la résolution d'une Scène. Absente
 *  sur un effet = « sur Succès/Victoire ». `generalDown` = le général ennemi est tombé (l.208/217) ;
 *  `intervention`/`noIntervention` = un AUTRE PJ a frappé (Duel l.225) ; `stunningSuccess`/
 *  `stunningFailure` = DR ≥ 6 / DR ≤ −6 (l.217/96) ; `success`/`failure` = issue du Test/Combat ;
 *  `combatWon`/`combatLost` = victoire / DÉFAITE tactique d'une Scène de COMBAT (Percée l.175, Duel
 *  l.223 : le camp vaincu au duel perd −20 — vaut DANS LES DEUX SENS). */
export type SceneCond =
  | 'generalDown' | 'intervention' | 'noIntervention'
  | 'stunningSuccess' | 'stunningFailure' | 'success' | 'failure'
  | 'combatWon' | 'combatLost';

/** Delta de Puissance appliqué par une Scène résolue : camp visé + échelle. `amount` porte le SIGNE
 *  (gain allié +, réduction ennemie −). `when` gate l'effet (ex. « −15 SI le général est tué »). */
export interface BattleSceneEffect { side: 'ally' | 'enemy'; scale: SceneScale; amount: number; when?: SceneCond }
/** Une Scène IMPOSÉE au Round suivant (enchaînement l.169/175/208/217/225). `when` gate le déclenchement. */
export interface BattleSceneChain { sceneId: string; when?: SceneCond }
/** Paramètre d'une Scène MENACE (Intrus l.219) : pénalité infligée aux TESTS des autres Scènes du Round
 *  tant que la menace n'est pas vaincue. */
export interface BattleThreat { penalty: number }
/** Paramètre d'une Scène « Tenez votre position » (l.161-163) : le seuil du Point de rupture (10 par
 *  RAW), le nombre de Rounds max avant écrasement (5 par RAW), et le bonus cumulatif d'opposition octroyé
 *  à l'ennemi à chaque Round tenu (« un bonus cumulatif de +10 pour les Rounds successifs »). */
export interface BattleHold { breakpoint: number; maxRounds: number; enemyBonusPerHold: number }

/** Une Scène cinématique (l.133-225) : description VERBATIM + résolution `test`/`combat`/`threat`/`hold`.
 *  Les effets s'appliquent sur succès/victoire (ou selon leur `when`) ; les enchaînements imposent une
 *  Scène au Round suivant. Data-driven : `ref` cite la ligne source. */
export interface BattleSceneDef extends TestSpec {
  id: string;
  label: string;
  kind: SceneKind;
  /** Référence canon (ADE II 08 l.NNN). */
  ref: string;
  desc: string;
  /** `skills?` (Scène 'test'/'hold' : AU CHOIX ; en 'hold' l'ennemi oppose la même compétence, l.161),
   *  `char?`, `difficulty?` viennent de `TestSpec`. */
  /** Scène 'combat'/'threat' : id de rencontre de la scène à démarrer (`startCombat`). */
  encounter?: string;
  /** Durée max en Rounds de Combat (l.139/157/175… — indicatif narratif). */
  rounds?: number;
  /** Effets de Puissance appliqués à la résolution (chacun gated par son `when`). */
  effects: BattleSceneEffect[];
  /** Scènes imposées au Round suivant (enchaînements). */
  chains?: BattleSceneChain[];
  /** Paramètre MENACE (kind 'threat'). */
  threat?: BattleThreat;
  /** Paramètre de la Scène « Tenez votre position » (kind 'hold', l.161). */
  hold?: BattleHold;
}

/** Cible d'une Activité de bataille pré-combat (l.79-106) : modificateur PERMANENT aux Tests de
 *  Puissance alliés (Planification) ; Puissance alliée/ennemie de DÉPART (Rassembler/Sabotage) ; bonus
 *  au premier Round (Discours) ; bonus au Test de Planification (Repérage/Infiltration). */
export type ActivityTarget = 'allyTestMod' | 'allyMight' | 'enemyMight' | 'firstRoundBonus' | 'planningBonus';
export interface ActivityOutcome { target: ActivityTarget; amount: number }
/** Une Activité de bataille (l.79-106) : Test de Compétence dont l'issue alimente la Puissance/les
 *  modificateurs AVANT la bataille (max 3 Activités, l.65). `requires` = prérequis (Sabotage ⇐ Repérage
 *  réussi, Infiltration ⇐ Planification réussie). `grantsFlag` = débloque une Activité dépendante. */
export interface BattleActivityDef extends TestSpec {
  id: string;
  label: string;
  ref: string;
  desc: string;
  /** De `TestSpec` : `skills?` (au CHOIX par défaut ; en Test COMBINÉ `combined:true`, l.75/102, les DEUX
   *  PREMIÈRES sont testées ENSEMBLE — un seul jet vs deux valeurs, un Test combiné exige donc DEUX
   *  compétences), `char?`, `difficulty?`, `combined?` (l.75 Infiltration : Discrétion + Perception ;
   *  l.102 Repérage : Chevaucher + Perception — un d100 confronté aux deux valeurs, LDB 12 l.229). */
  requires?: 'planned' | 'scouted';
  grantsFlag?: 'planned' | 'scouted';
  onSuccess: ActivityOutcome[];
  /** Succès Stupéfiant (DR ≥ 6) — REMPLACE `onSuccess`. */
  onStunning?: ActivityOutcome[];
  /** Échec Stupéfiant (DR ≤ −6). */
  onStunningFail?: ActivityOutcome[];
}

export const POWER_ESTIMATE = data.powerEstimate as PowerEstimateRow[];
export const MIGHT_MODIFIERS = data.mightModifiers as MightModifierRow[];
export const WAR_MACHINES = data.warMachines as WarMachineRow[];
export const STRUCTURES = data.structures as StructureRow[];
export const BATTLE_HAZARDS = data.hazards as HazardRow[];
export const BATTLE_SCENES = data.scenes as BattleSceneDef[];
export const BATTLE_ACTIVITIES = data.activities as BattleActivityDef[];

export const MIGHT_MIN = 0;
export const MIGHT_MAX = 100;

/** Puissance ARRONDIE et bornée à [0, 100] (l.24 : « une valeur comprise entre 0 et 100 »). */
export function clampMight(m: number): number {
  return Math.max(MIGHT_MIN, Math.min(MIGHT_MAX, Math.round(m)));
}

/** Ligne de Scène par id (repli undefined). */
export function battleSceneById(id: string): BattleSceneDef | undefined {
  return BATTLE_SCENES.find((s) => s.id === id);
}

/** Activité de bataille par id (repli undefined). */
export function battleActivityById(id: string): BattleActivityDef | undefined {
  return BATTLE_ACTIVITIES.find((a) => a.id === id);
}

// ── Estimation de la Puissance de départ ─────────────────────────────────────────────────────────

/** Puissance de départ par la table de FORCE RELATIVE (l.24-33) : « Estimez la force du camp des
 *  Personnages par rapport à celle de leurs adversaires » → couple {allié, ennemi}. */
export function mightFromRelation(id: string): { ally: number; enemy: number } {
  const row = POWER_ESTIMATE.find((r) => r.id === id) ?? POWER_ESTIMATE[2]; // repli « De force égale »
  return { ally: row.ally, enemy: row.enemy };
}

/** Machine de guerre pour le calcul de Puissance (l.302-304). */
export interface MightMachine {
  /** Porte l'Atout Siège (l.290-292). */
  siege?: boolean;
  /** Équipage complet ? Sinon sa contribution est divisée par deux (« Si elles n'ont pas d'Équipes
   *  complètes, divisez leur Puissance par deux », l.304). */
  fullCrew?: boolean;
}

/** Apport de Puissance des machines de guerre (l.302-304) : « chaque machine de guerre apporte +5 de
 *  Puissance. Si la bataille est un siège, toutes les machines de guerre avec l'Atout Siège du côté
 *  offensif augmentent la Puissance de l'armée de +10 à la place. Si elles n'ont pas d'Équipes
 *  complètes, divisez leur Puissance par deux. » */
export function warMachineMight(machines: MightMachine[], opts: { siege?: boolean; offensive?: boolean } = {}): number {
  return machines.reduce((sum, m) => {
    const base = opts.siege && opts.offensive && m.siege ? 10 : 5;
    return sum + (m.fullCrew === false ? base / 2 : base);
  }, 0);
}

/** Puissance BRUTE d'une armée par la méthode des ASPECTS (l.34-47) : « Faites commencer chaque armée
 *  avec une Puissance de 30, et accordez-lui un modificateur pour chaque aspect qui s'y applique »,
 *  plus l'apport des machines de guerre (l.302). NON normalisée (cf. `normalizeMights`). */
export function estimateMightFromAspects(
  modifierIds: string[],
  machines: MightMachine[] = [],
  opts: { siege?: boolean; offensive?: boolean } = {},
): number {
  const mods = modifierIds.reduce((sum, id) => sum + (MIGHT_MODIFIERS.find((m) => m.id === id)?.mod ?? 0), 0);
  return 30 + mods + warMachineMight(machines, opts);
}

/** Normalise deux Puissances BRUTES (l.34) : « Ensuite, retirez 10 aux deux armées jusqu'à ce que la
 *  Puissance soit comprise entre 0 et 100. » `decided` = « Si la différence de Puissance entre les deux
 *  Armées est supérieure à 100, l'issue du combat est déjà décidée. » (mesurée sur l'écart BRUT). */
export function normalizeMights(rawAlly: number, rawEnemy: number): { ally: number; enemy: number; decided: boolean } {
  const decided = Math.abs(rawAlly - rawEnemy) > 100;
  let a = rawAlly;
  let b = rawEnemy;
  while (a > MIGHT_MAX || b > MIGHT_MAX) { a -= 10; b -= 10; }
  return { ally: clampMight(a), enemy: clampMight(b), decided };
}

// ── Test spectaculaire de Puissance (l.120) ──────────────────────────────────────────────────────
//
// Lecture de la coquille OCR l.120 (« … et sur le score de Puissance actuelle la Puissance de leur
// adversaire de 10 + DR (5 minimum) ») : la phrase mutilée décrit un Test NON opposé où chaque armée
// jette sa Puissance courante (d100 ≤ Puissance) et RÉDUIT la Puissance adverse de « 10 + DR (5
// minimum) ». Les deux attaques sont résolues EN MÊME TEMPS (« Chaque attaque est résolue en même
// temps sur le score de Puissance actuelle des armées »). Reconstitution confirmée par la boucle du
// chapitre (l.19 : « La Puissance est utilisée lors de chaque Round … pour infliger des dégâts à
// l'armée adverse, et est recalculée à la fin de chaque Round ») et par l'issue (l.124 : « l'armée
// avec la Puissance la plus élevée gagne »). `DR` = le DR du Test de l'armée qui frappe.

/** Réduction de Puissance infligée à l'adversaire (l.120) : « 10 + DR (5 minimum) ». Un DR négatif
 *  (Test raté) réduit la casse jusqu'au plancher de 5. */
export function mightReduction(sl: number): number {
  return Math.max(5, 10 + sl);
}

/** Un Test spectaculaire de Puissance NON opposé (l.120) : d100 ≤ Puissance courante, modifié par les
 *  bonus/malus de bataille (Planification/Discours/aléas). `modifier` = somme des modificateurs. */
export function rollMightTest(might: number, modifier = 0, rng: RNG = defaultRNG): TestResult {
  return rollTest(might, 'intermediaire', rng, modifier);
}

/** Issue de l'affrontement d'un Round : les deux Tests + les pertes infligées + les Puissances après. */
export interface ClashResult {
  allyTest: TestResult;
  enemyTest: TestResult;
  /** Puissance perdue par l'ennemi (= `mightReduction` du DR allié). */
  enemyLoss: number;
  /** Puissance perdue par l'allié (= `mightReduction` du DR ennemi). */
  allyLoss: number;
  allyMight: number;
  enemyMight: number;
}

/** Résout l'affrontement d'un Round de bataille (l.120) : chaque armée teste sa Puissance courante et
 *  réduit celle de l'adverse de 10 + DR (min 5), simultanément (les deux DR sont figés AVANT réduction). */
export function resolveClash(
  allyMight: number,
  enemyMight: number,
  opts: { allyMod?: number; enemyMod?: number; rng?: RNG } = {},
): ClashResult {
  const rng = opts.rng ?? defaultRNG;
  const allyTest = rollMightTest(allyMight, opts.allyMod ?? 0, rng);
  const enemyTest = rollMightTest(enemyMight, opts.enemyMod ?? 0, rng);
  const enemyLoss = mightReduction(allyTest.sl);
  const allyLoss = mightReduction(enemyTest.sl);
  return {
    allyTest,
    enemyTest,
    enemyLoss,
    allyLoss,
    allyMight: clampMight(Math.max(0, allyMight - allyLoss)),
    enemyMight: clampMight(Math.max(0, enemyMight - enemyLoss)),
  };
}

// ── Discours inspirant (l.69-71) ─────────────────────────────────────────────────────────────────

/** Arrondi à la dizaine la plus proche (l.71 : « arrondie à la dizaine la plus proche »). */
export function roundToTen(n: number): number {
  return Math.round(n / 10) * 10;
}

/** Difficulté (bande la plus proche) d'un modificateur brut de Test — mappe l'écart de Puissance sur
 *  l'échelle de Difficulté du jeu (le Test de Commandement du Discours inspirant est joué avec une
 *  Difficulté, pas un modificateur libre). */
export function difficultyFromModifier(mod: number): Difficulty {
  let best: Difficulty = 'intermediaire';
  let bestDist = Infinity;
  for (const key of Object.keys(DIFFICULTY_MODIFIERS) as Difficulty[]) {
    const dist = Math.abs(DIFFICULTY_MODIFIERS[key] - mod);
    if (dist < bestDist) { bestDist = dist; best = key; }
  }
  return best;
}

/** Difficulté du Test de Commandement du Discours inspirant (l.71) : « une Difficulté déterminée par la
 *  différence de Puissance entre les armées, arrondie à la dizaine la plus proche ». Un écart FAVORABLE
 *  (allié > ennemi) rend le Test plus facile ; défavorable, plus difficile. En cas de Succès → +10 au
 *  Test de Puissance du premier Round (`INSPIRE_BONUS`). */
export function inspireDifficulty(allyMight: number, enemyMight: number): Difficulty {
  return difficultyFromModifier(roundToTen(allyMight - enemyMight));
}

/** Bonus au Test de Puissance du premier Round de bataille en cas de Discours inspirant réussi (l.71). */
export const INSPIRE_BONUS = 10;

// ── Scènes cinématiques (l.133-225) ──────────────────────────────────────────────────────────────

/** Résolution d'une Scène : issue du Test/Combat + compteurs qui alimentent les échelles/conditions.
 *  `hits`/`kills` = touches portées / ennemis neutralisés d'une Scène de COMBAT (l.139/145) ;
 *  `generalDown` = le général ennemi est tombé (l.208/217) ; `intervention` = un AUTRE PJ a frappé
 *  le général en Duel (l.225) ; `combat` = la résolution vient d'une Scène de COMBAT tactique (distingue
 *  `combatWon`/`combatLost` d'un simple `success`/`failure` de Test). */
export interface SceneResolution {
  success: boolean;
  sl: number;
  hits: number;
  kills: number;
  generalDown: boolean;
  intervention: boolean;
  combat: boolean;
}

/** Une résolution `test` : succès + DR (compteurs de combat à 0). `generalDown` sur Succès Stupéfiant
 *  (DR ≥ 6) — le coup isolé fait tomber le capitaine/général (l.208/217). */
export function testResolution(success: boolean, sl: number): SceneResolution {
  return { success, sl, hits: 0, kills: 0, generalDown: success && sl >= 6, intervention: false, combat: false };
}

/** Une résolution `combat` GAGNÉE : touches + kills. `intervention` = plus d'un PJ a frappé (rompt
 *  l'accord tacite du Duel, l.225). `generalDown` = victoire (le général est la rencontre). */
export function combatResolution(hits: number, kills: number, hitterCount: number): SceneResolution {
  return { success: true, sl: 0, hits, kills, generalDown: true, intervention: hitterCount > 1, combat: true };
}

/** Une résolution `combat` PERDUE (Scène de combat de bataille où les PJ sont mis hors d'action) : les
 *  touches portées comptent toujours (l.139), mais l'issue est un échec — nourrit `combatLost` (Percée
 *  l.175 : échec→Charge ; Duel l.223 : le camp allié vaincu perd −20). */
export function combatLossResolution(hits: number, hitterCount: number): SceneResolution {
  return { success: false, sl: 0, hits, kills: 0, generalDown: false, intervention: hitterCount > 1, combat: true };
}

/** Une condition `when` est-elle satisfaite par la résolution ? Un effet SANS `when` s'applique sur
 *  Succès/Victoire. */
export function condMet(cond: SceneCond | undefined, r: SceneResolution): boolean {
  switch (cond) {
    case undefined: return r.success;
    case 'success': return r.success;
    case 'failure': return !r.success;
    case 'stunningSuccess': return r.success && r.sl >= 6;
    case 'stunningFailure': return !r.success && r.sl <= -6;
    case 'generalDown': return r.generalDown;
    case 'intervention': return r.success && r.intervention;
    case 'noIntervention': return r.success && !r.intervention;
    case 'combatWon': return r.combat && r.success;
    case 'combatLost': return r.combat && !r.success;
  }
}

/** Montant SIGNÉ d'un effet pour une résolution (l'échelle multiplie le compteur adéquat). */
export function effectAmount(effect: BattleSceneEffect, r: SceneResolution): number {
  switch (effect.scale) {
    case 'fixed': return effect.amount;
    case 'perDR': return effect.amount * Math.max(0, r.sl);
    case 'perHit': return effect.amount * Math.max(0, r.hits);
    case 'perKill': return effect.amount * Math.max(0, r.kills);
  }
}

/** Deltas de Puissance appliqués par une Scène résolue (chaque effet gated par son `when`). */
export function sceneDeltas(scene: BattleSceneDef, r: SceneResolution): { side: 'ally' | 'enemy'; amount: number }[] {
  const out: { side: 'ally' | 'enemy'; amount: number }[] = [];
  for (const e of scene.effects) {
    if (!condMet(e.when, r)) continue;
    const amount = effectAmount(e, r);
    if (amount !== 0) out.push({ side: e.side, amount });
  }
  return out;
}

/** Ids des Scènes IMPOSÉES au Round suivant par une Scène résolue (enchaînements gated par `when`). */
export function sceneChains(scene: BattleSceneDef, r: SceneResolution): string[] {
  return (scene.chains ?? []).filter((c) => condMet(c.when, r)).map((c) => c.sceneId);
}

// ── « Tenez votre position » — Point de rupture (l.161-163) ──────────────────────────────────────

/** État PERSISTANT (entre Rounds de bataille) d'une Scène « Tenez votre position » (l.161-163) : le
 *  Point de rupture (`breakpoint`, DR cumulés de l'ennemi), le nombre de Rounds tenus, et si la position
 *  a déjà cédé (déroute — l'ennemi a percé). Générique : porté par `MassBattleState.sceneState`, pas un
 *  champ ad hoc « Tenez ». */
export interface HoldState {
  /** Somme cumulée des DR de l'ennemi au Test opposé (« On nomme le nombre cumulé des DR : Point de rupture »). */
  breakpoint: number;
  /** Nombre de Rounds où la position a été TENUE (Point de rupture < seuil). */
  held: number;
  /** La position a-t-elle cédé ? (Point de rupture ≥ seuil, ou `maxRounds` atteint → déroute.) */
  broken: boolean;
}

/** État de tenue vierge (avant le 1ᵉʳ Round de la Scène). */
export function initHoldState(): HoldState {
  return { breakpoint: 0, held: 0, broken: false };
}

/** Issue d'un Round de « Tenez votre position » (l.161-163). */
export interface HoldResolution {
  /** Nouvel état persistant (à réécrire dans `sceneState`). */
  next: HoldState;
  /** La position a-t-elle TENU ce Round (breakpoint encore < seuil, hors déroute) ? */
  held: boolean;
  /** DR net de l'ennemi ce Round (positif = l'ennemi progresse et fait monter le Point de rupture). */
  enemySL: number;
  /** Bonus cumulatif d'opposition que l'ennemi APPLIQUERA au Round suivant (« +10 pour les Rounds
   *  successifs ») — dérivé du nombre de Rounds déjà tenus. */
  nextEnemyBonus: number;
}

/** Bonus cumulatif d'opposition de l'ennemi au Round `heldSoFar+1` d'une Scène « Tenez votre position »
 *  (l.163 : « obtient un bonus cumulatif de +10 pour les Rounds successifs ») : +`enemyBonusPerHold`
 *  par Round DÉJÀ tenu. Pur — le flux le passe en modificateur du Test opposé de l'ennemi. */
export function holdEnemyBonus(hold: BattleHold, heldSoFar: number): number {
  return Math.max(0, heldSoFar) * hold.enemyBonusPerHold;
}

/** Résout un Round de « Tenez votre position » (l.161-163) à partir du DR net de l'ENNEMI au Test opposé
 *  de ce Round (positif = l'ennemi l'emporte). Accumule le Point de rupture (jamais sous 0), décide de la
 *  tenue (breakpoint < seuil ET Rounds restants), et calcule le bonus d'opposition du Round suivant. La
 *  réduction −2 de la Puissance ennemie « pour chaque Round tenu » est portée par l'effet `fixed` de la
 *  Scène (gated par la tenue via le flux) — pas ici (le résolveur reste PUR et sans Puissance). */
export function resolveHoldRound(prev: HoldState, hold: BattleHold, enemySL: number): HoldResolution {
  const breakpoint = Math.max(0, prev.breakpoint + enemySL);
  const roundsElapsed = prev.held + 1;
  const broken = breakpoint >= hold.breakpoint || roundsElapsed >= hold.maxRounds;
  // Tenu ce Round si le Point de rupture n'a pas atteint le seuil (l.163 : « avant que le Point de rupture
  // n'atteigne 10 »). Une déroute par nombre de Rounds n'est PAS une tenue supplémentaire.
  const held = breakpoint < hold.breakpoint;
  const nextHeld = held ? prev.held + 1 : prev.held;
  return {
    next: { breakpoint, held: nextHeld, broken },
    held,
    enemySL,
    nextEnemyBonus: holdEnemyBonus(hold, nextHeld),
  };
}

/** Applique un delta de Puissance à une armée. Les GAINS d'une Scène sont plafonnés à la Puissance de
 *  DÉPART (l.135 : « Les Scènes cinématiques ne peuvent pas augmenter votre Puissance au-delà de sa
 *  valeur de départ ») ; les pertes vont jusqu'à 0. */
export function applyMightDelta(might: number, startMight: number, delta: number): number {
  const next = might + delta;
  return clampMight(delta > 0 ? Math.min(next, startMight) : next);
}

// ── Rassemblement (l.122) ────────────────────────────────────────────────────────────────────────

/** Blessures guéries par le Rassemblement (l.122) : « un Test de Résistance Intermédiaire (+0) pour
 *  guérir un nombre de Blessures égal au DR + le Bonus d'Endurance ». Sur Succès uniquement (l'appelant
 *  gate) ; DR négatif borné à 0. */
export function rallyHealAmount(sl: number, enduranceBonus: number): number {
  return Math.max(0, sl) + Math.max(0, enduranceBonus);
}

// ── Activités de bataille pré-combat (l.79-110) ──────────────────────────────────────────────────

/** Issue chiffrée d'une Activité de bataille : sur Succès Stupéfiant (DR ≥ 6) → `onStunning` (si
 *  fourni) ; sur Succès → `onSuccess` ; sur Échec Stupéfiant (DR ≤ −6) → `onStunningFail` ; sinon rien. */
export function activityOutcomes(def: BattleActivityDef, success: boolean, sl: number): ActivityOutcome[] {
  if (success) return sl >= 6 && def.onStunning ? def.onStunning : def.onSuccess;
  if (sl <= -6 && def.onStunningFail) return def.onStunningFail;
  return [];
}

// ── Issue de la bataille (l.124) ─────────────────────────────────────────────────────────────────

export type BattleOutcome = 'ally' | 'enemy' | 'draw';

/** « À la fin des Rounds de bataille prévus, l'armée avec la Puissance la plus élevée gagne. Le côté
 *  adverse doit fuir, sous peine d'être détruit. » (l.124). Égalité → indécis. */
export function battleOutcome(allyMight: number, enemyMight: number): BattleOutcome {
  if (allyMight === enemyMight) return 'draw';
  return allyMight > enemyMight ? 'ally' : 'enemy';
}

/** Une armée réduite à 0 est DÉTRUITE — la bataille se conclut immédiatement (l.19/124). */
export function isDestroyed(might: number): boolean {
  return might <= MIGHT_MIN;
}

// ── Aléa de bataille (l.307-322) ─────────────────────────────────────────────────────────────────

/** Facteur environnemental tiré/choisi (l.309, 1d10) — « vous pouvez faire un jet sur la table
 *  ci-dessous, ou simplement choisir l'un des résultats ». */
export function battleHazard(roll: number): HazardRow {
  return findTableEntry(BATTLE_HAZARDS, roll);
}
