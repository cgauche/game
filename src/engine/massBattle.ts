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
import { DIFFICULTY_MODIFIERS, type Difficulty, type CharKey } from './types';
import { RNG, defaultRNG } from './dice';
import { findTableEntry } from './tables';

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
/** Delta de Puissance appliqué par une Scène résolue : camp visé + échelle. `perDR`/`perKill` × un
 *  compteur (DR du Test, l.151 ; ennemis neutralisés, l.139), `fixed` = montant plat. `amount` porte
 *  le SIGNE (gain allié +, réduction ennemie −). */
export interface BattleSceneEffect { side: 'ally' | 'enemy'; scale: 'perDR' | 'perKill' | 'fixed'; amount: number }
/** Une Scène cinématique (l.133-225) : description VERBATIM + résolution `test` (Compétence des PJ) ou
 *  `combat` (rencontre tactique réutilisant le combat existant). L'effet s'applique sur succès/victoire. */
export interface BattleSceneDef {
  id: string;
  label: string;
  kind: 'test' | 'combat';
  desc: string;
  /** Scène 'test' : compétences AU CHOIX (la meilleure du PJ décide). */
  skills?: { skillId: string; spec?: string }[];
  char?: CharKey;
  difficulty?: Difficulty;
  /** Scène 'combat' : id de rencontre de la scène à démarrer (`startCombat`). */
  encounter?: string;
  effect: BattleSceneEffect;
}

export const POWER_ESTIMATE = data.powerEstimate as PowerEstimateRow[];
export const MIGHT_MODIFIERS = data.mightModifiers as MightModifierRow[];
export const WAR_MACHINES = data.warMachines as WarMachineRow[];
export const STRUCTURES = data.structures as StructureRow[];
export const BATTLE_HAZARDS = data.hazards as HazardRow[];
export const BATTLE_SCENES = data.scenes as BattleSceneDef[];

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

/** Delta de Puissance SIGNÉ d'une Scène résolue. `counter` = DR du Test (Scènes `perDR`) ou nombre
 *  d'ennemis neutralisés (Scènes `perKill`, l.139) ; ignoré pour `fixed`. */
export function sceneMightDelta(effect: BattleSceneEffect, counter: number): number {
  if (effect.scale === 'fixed') return effect.amount;
  return effect.amount * Math.max(0, counter);
}

/** Applique un delta de Puissance à une armée. Les GAINS d'une Scène sont plafonnés à la Puissance de
 *  DÉPART (l.135 : « Les Scènes cinématiques ne peuvent pas augmenter votre Puissance au-delà de sa
 *  valeur de départ ») ; les pertes vont jusqu'à 0. */
export function applyMightDelta(might: number, startMight: number, delta: number): number {
  const next = might + delta;
  return clampMight(delta > 0 ? Math.min(next, startMight) : next);
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
