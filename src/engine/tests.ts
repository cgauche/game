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

/** Échelle de Difficulté ORDONNÉE, du plus FACILE (tresFacile +60) au plus difficile (tresDifficile −30). */
export const DIFFICULTY_LADDER: Difficulty[] = ['tresFacile', 'facile', 'accessible', 'intermediaire', 'complexe', 'difficile', 'tresDifficile'];

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

function clamp(v: number, policy: TestPolicy): number {
  return Math.max(policy.targetMin, Math.min(policy.targetMax, v));
}
