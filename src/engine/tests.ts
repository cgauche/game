/**
 * Tests & Degrés de Réussite (DR) — Livre de base, chapitre « Tests ».
 *
 * On réussit un Test si le jet de d100 est inférieur ou égal à la valeur de
 * Compétence/Caractéristique (modifiée par la Difficulté). Le nombre de Degrés
 * de Réussite est la différence des dizaines : DR = dizaine(cible) − dizaine(jet).
 */
import { d100, RNG, defaultRNG } from './dice';
import { Difficulty, DIFFICULTY_MODIFIERS } from './types';
import { type TestPolicy, getTestPolicy } from './testPolicy';

/** Chiffre des dizaines d'un d100 (00 = 100 → 10). SOURCE UNIQUE du calcul de DR. */
export const tens = (n: number): number => Math.floor(n / 10);

/** Échelle de Difficulté ORDONNÉE, du plus FACILE (tresFacile +60) au plus difficile (impossible −50, EDO App.2). */
export const DIFFICULTY_LADDER: Difficulty[] = ['tresFacile', 'facile', 'accessible', 'intermediaire', 'complexe', 'difficile', 'tresDifficile', 'presqueImpossible', 'impossible'];

/** Difficulté (clé) depuis un libellé FR — paramétrage générique d'un Test par l'argument d'instance
 *  d'un porteur (« Venin (Difficile) » → difficile). Ordre des tests : variantes « Très » avant la base.
 *  Défaut Intermédiaire (le RAW : « si aucune Difficulté n'est indiquée, le Test est Intermédiaire »). */
export function difficultyFromLabel(label: string | undefined): Difficulty {
  const l = (label ?? '').toLowerCase();
  if (l.includes('très facile') || l.includes('tres facile')) return 'tresFacile';
  if (l.includes('facile')) return 'facile';
  if (l.includes('accessible')) return 'accessible';
  if (l.includes('très difficile') || l.includes('tres difficile')) return 'tresDifficile';
  // EDO App.2 : « presque impossible » AVANT « impossible » (sinon le second matche le premier).
  if (l.includes('presque impossible')) return 'presqueImpossible';
  if (l.includes('impossible')) return 'impossible';
  if (l.includes('complexe')) return 'complexe';
  if (l.includes('difficile')) return 'difficile';
  return 'intermediaire';
}

/** Décale une difficulté de `steps` crans vers PLUS FACILE (bornée aux extrémités de l'échelle). PUR. */
export function easeDifficulty(base: Difficulty, steps: number): Difficulty {
  const i = DIFFICULTY_LADDER.indexOf(base);
  return DIFFICULTY_LADDER[Math.max(0, Math.min(DIFFICULTY_LADDER.length - 1, i - steps))];
}

export interface TestResult {
  roll: number;
  target: number; // valeur effective après difficulté
  success: boolean;
  /** Degrés de Réussite (positif = réussite, négatif = échec). */
  sl: number;
  /** Double réussi/raté (11,22,…,99,00) — déclenche Critique/Maladresse en combat. */
  isDouble: boolean;
}

/** Effectue un Test simple contre une valeur cible. */
export function rollTest(
  value: number,
  difficulty: Difficulty = 'intermediaire',
  rng: RNG = defaultRNG,
  modifier = 0,
  policy: TestPolicy = getTestPolicy(),
): TestResult {
  const target = clamp(value + DIFFICULTY_MODIFIERS[difficulty] + modifier, policy);
  const r = d100(rng);
  return evaluateTest(r, target, policy);
}

/** Évalue un jet déjà obtenu contre une cible (utile pour rejouer un jet). */
/** Un d100 est-il un « double » (11, 22, …, 99, 00=100) ? Génère Critique (réussi) ou Maladresse (raté). */
export function isDoubleRoll(roll: number): boolean {
  return roll === 100 || roll % 11 === 0;
}

export function evaluateTest(r: number, target: number, policy: TestPolicy = getTestPolicy()): TestResult {
  // 1) Réussite « numérique » : jet ≤ cible.
  let success = r <= target;
  // 2) Bandes automatiques (LDB 12 l.46). 'normal' = RAW (01..autoSuccessMax réussite auto,
  //    autoFailMin..00 échec auto) ; 'inverted' = maison (bandes échangées) ; 'off' = aucune.
  const lowBand = r <= policy.autoSuccessMax;
  const highBand = r >= policy.autoFailMin;
  let forced: 'success' | 'fail' | null = null;
  if (policy.bandsMode === 'normal') {
    if (lowBand) { success = true; forced = 'success'; }
    else if (highBand) { success = false; forced = 'fail'; }
  } else if (policy.bandsMode === 'inverted') {
    if (lowBand) { success = false; forced = 'fail'; }
    else if (highBand) { success = true; forced = 'success'; }
  }
  // 3) DR : 'fast' = dizaines du jet sur une RÉUSSITE (LDB 12 l.128) ; sinon différence de dizaines.
  const baseSL = policy.slMode === 'fast' && success ? tens(r) : tens(target) - tens(r);
  // 4) DR auto des bandes (LDB 12 l.147-149) : réussite forcée ≥ +1 ; échec forcé ≤ −1.
  const sl = forced === 'success' ? Math.max(1, baseSL) : forced === 'fail' ? Math.min(-1, baseSL) : baseSL;
  return { roll: r, target, success, sl, isDouble: isDoubleRoll(r) };
}

/** Valeur maximale d'un dé FORCÉ par la Résilience « Je ne faillirai pas ! » (LDB 17 l.73) : le dé
 *  choisi doit RESTER une réussite — ≤ cible ET hors bande d'échec auto. En mode 'normal' la bande
 *  haute (≥ autoFailMin) échoue toujours (LDB 12 l.46), d'où le plafond `autoFailMin − 1` — DÉRIVÉ
 *  de la policy, jamais un nombre en dur. SOURCE UNIQUE (sélecteur + résolveurs de jet forcé). */
export function maxForcedRoll(target: number, policy: TestPolicy = getTestPolicy()): number {
  const ceil = policy.bandsMode === 'normal' ? policy.autoFailMin - 1 : policy.targetMax;
  return Math.min(target, ceil);
}

/** Issue d'un Test Combiné (LDB 12 l.229, règle optionnelle) : UN seul d100 confronté à DEUX valeurs. */
export interface CombinedTestResult {
  roll: number;
  /** Résultat vs la 1ʳᵉ valeur (même jet). */
  a: TestResult;
  /** Résultat vs la 2ᵈᵉ valeur (même jet). */
  b: TestResult;
  /** `full` = les deux réussies ; `partial` = une seule ; `fail` = aucune. */
  level: 'full' | 'partial' | 'fail';
}

/** Test Combiné (LDB 12 l.229) : un MÊME jet d100 est évalué contre deux valeurs cibles (deux
 *  Compétences). Réutilise `evaluateTest` (bandes/DR identiques) pour chaque cible. PUR : la primitive
 *  est neutre ; l'activation (règle `test-combined`) et le branchement des issues vivent côté flux. */
export function evaluateCombinedTest(roll: number, target1: number, target2: number, policy: TestPolicy = getTestPolicy()): CombinedTestResult {
  const a = evaluateTest(roll, target1, policy);
  const b = evaluateTest(roll, target2, policy);
  const passed = (a.success ? 1 : 0) + (b.success ? 1 : 0);
  return { roll, a, b, level: passed === 2 ? 'full' : passed === 1 ? 'partial' : 'fail' };
}

/** Détail d'AFFICHAGE d'un Test (base + mod = cible · d100 · DR) — la forme des lignes de jet
 *  (RollLine / NightEntry.d). UNE construction partagée, au lieu d'objets recopiés par site. */
export function testDetail(label: string, base: number, t: TestResult): {
  label: string; base: number; modifier: number; target: number; roll: number; success: boolean; sl: number;
} {
  return { label, base, modifier: t.target - base, target: t.target, roll: t.roll, success: t.success, sl: t.sl };
}

export interface OpposedResult {
  attacker: TestResult;
  defender: TestResult;
  /** Vainqueur du test opposé. `tie` = statu quo (aucun vainqueur). */
  winner: 'attacker' | 'defender' | 'tie';
  /** Conservé pour compatibilité : true uniquement si `winner === 'attacker'`. */
  attackerWins: boolean;
  /** DR net du vainqueur (sert aux dégâts en combat). */
  netSL: number;
}

/**
 * Test opposé (12 - Tests.md). Le vainqueur est celui dont le DR est le plus
 * élevé ; en cas d'égalité de DR, celui dont la valeur cible (Compétence/
 * Caractéristique) est STRICTEMENT la plus élevée ; si elles sont aussi égales,
 * aucun vainqueur (statu quo / relance au choix du MJ). Pas de priorité
 * « attaquant » (corrigé suite à l'audit de fidélité).
 */
export function opposedTest(
  attackerValue: number,
  defenderValue: number,
  rng: RNG = defaultRNG,
  attackerDifficulty: Difficulty = 'intermediaire',
  defenderDifficulty: Difficulty = 'intermediaire',
): OpposedResult {
  const attacker = rollTest(attackerValue, attackerDifficulty, rng);
  const defender = rollTest(defenderValue, defenderDifficulty, rng);
  return resolveOpposed(attacker, defender);
}

export function resolveOpposed(attacker: TestResult, defender: TestResult): OpposedResult {
  // 1) DR le plus élevé l'emporte. 2) Égalité de DR → valeur cible strictement
  // la plus haute. 3) Encore égal → statu quo (tie), aucun vainqueur.
  let winner: 'attacker' | 'defender' | 'tie';
  if (attacker.sl !== defender.sl) winner = attacker.sl > defender.sl ? 'attacker' : 'defender';
  else if (attacker.target !== defender.target) winner = attacker.target > defender.target ? 'attacker' : 'defender';
  else winner = 'tie';
  const netSL = Math.abs(attacker.sl - defender.sl);
  return { attacker, defender, winner, attackerWins: winner === 'attacker', netSL };
}

/** Influence « +`by` DR » sur un jet DÉJÀ résolu (Pacte du Marteau, LDB 17 l.73 ; bonus de Piège-lame, LDB 62) :
 *  renvoie une copie du `TestResult` avec son Degré de Réussite augmenté, pour le RÉ-opposer ou le réappliquer.
 *  Atome PARTAGÉ des relances d'influence des Tests opposés — un seul point au lieu de `{ ...t, sl: t.sl + 1 }`
 *  recopié dans chaque résolveur (marchandage, désengagement, dissipation, opposition de sort, cascade). */
export function bumpSL(t: TestResult, by = 1): TestResult {
  return { ...t, sl: t.sl + by };
}

/** `TestResult` d'une réussite FORCÉE (Résilience « Je ne faillirai pas ! » LDB 17 l.73 / Résistance
 *  Menace LDB 10) au dé `roll`, DR `sl` imposé. Collapse le littéral `{ roll, target, success: true,
 *  sl, isDouble: isDoubleRoll(roll) }` recopié dans chaque résolveur forcé — atome PARTAGÉ, voisin de `bumpSL`. */
export function forcedTR(roll: number, target: number, sl: number): TestResult {
  return { roll, target, success: true, sl, isDouble: isDoubleRoll(roll) };
}

/** Test Soutenu (LDB 12 l.214-225) — BONUS de coopération : chaque soutien octroie +10 au Test, MAIS le
 *  meneur ne peut être soutenu par plus de Personnages que son propre Bonus de Caractéristique de la carac
 *  testée (`cap`, l.225). Primitive PURE et GÉNÉRALE de la coopération : le « plus compétent lance » est
 *  porté par `partyBest`/`partyAssisted` (engine/skills) qui appelle ceci. Réutilisée PARTOUT où le groupe
 *  œuvre de concert (Test étendu, Tests de groupe hors combat, Dissipation à plusieurs LDB 46 l.207…). */
export function assistBonus(supporters: number, cap: number): number {
  return Math.min(Math.max(0, supporters), Math.max(0, cap)) * 10;
}

function clamp(v: number, policy: TestPolicy): number {
  return Math.max(policy.targetMin, Math.min(policy.targetMax, v));
}

/** Un Round/passe d'un Test ÉTENDU (LDB 12 l.197-211) : le DR du Round s'AJOUTE au cumul `prev` (planché à
 *  0 — « si le DR total passe sous 0, recommencez depuis le début ») ; `done` quand il atteint `targetDR`.
 *  `minStep` (règle optionnelle l.208) : une réussite compte ≥ +1, un échec ≤ −1 (DR 0 non neutre). SOURCE
 *  UNIQUE du cumul, partagée par crochetage/porte (`extendedTest`), Artisanat (LDB 23), chirurgie (LDB 10)
 *  et le Test étendu de Calme contre la Peur (LDB 21 l.27) — fini les 4 copies de la même arithmétique. */
export function extendedTestStep(
  prev: number,
  r: { success: boolean; sl: number },
  targetDR: number,
  minStep = false,
): { total: number; done: boolean } {
  const sl = minStep ? (r.success ? Math.max(1, r.sl) : Math.min(-1, r.sl)) : r.sl;
  const total = Math.max(0, prev + sl);
  return { total, done: total >= targetDR };
}

// ── Tableau des Résultats : bandes de DR (LDB 12 l.103-114) — PRIMITIVE PARTAGÉE ─────────────────
// Source UNIQUE des seuils qualitatifs « Impressionnant / Stupéfiant » jusqu'ici recopiés en nombres
// magiques (critiques, maladies, soin, marchandage, interlude/évaluation, corruption, rencontres de
// voyage). Le « palier » dépend de la MAGNITUDE du DR ; la réussite/l'échec, du drapeau `success`.

/** Seuil de DR du palier « Impressionnant » (LDB 12 : « 4 ou 5 »). « ou mieux » = ≥ ce seuil. */
export const SL_IMPRESSIVE = 4;
/** Seuil de DR du palier « Stupéfiant » (LDB 12 : « 6+ » / « -6 ou moins »). */
export const SL_ASTOUNDING = 6;

/** Palier qualitatif d'un DR (par sa MAGNITUDE), indépendant du succès/échec (LDB 12). */
export type SLTier = 'minime' | 'normal' | 'impressionnant' | 'stupefiant';
export function slTier(sl: number): SLTier {
  const m = Math.abs(sl);
  if (m >= SL_ASTOUNDING) return 'stupefiant';
  if (m >= SL_IMPRESSIVE) return 'impressionnant';
  if (m >= 2) return 'normal';
  return 'minime';
}

/** « Succès Impressionnant ou mieux » (DR ≥ +4 sur une réussite, LDB 12 l.108/107). */
export const isImpressiveSuccess = (success: boolean, sl: number): boolean => success && sl >= SL_IMPRESSIVE;
/** « Échec Impressionnant ou pire » (DR ≤ -4 sur un échec, LDB 12 l.113/114). */
export const isImpressiveFailure = (success: boolean, sl: number): boolean => !success && sl <= -SL_IMPRESSIVE;
/** « Succès Stupéfiant » (DR ≥ +6, LDB 12 l.107). */
export const isAstoundingSuccess = (success: boolean, sl: number): boolean => success && sl >= SL_ASTOUNDING;
/** « Échec Stupéfiant » (DR ≤ -6, LDB 12 l.114). */
export const isAstoundingFailure = (success: boolean, sl: number): boolean => !success && sl <= -SL_ASTOUNDING;
