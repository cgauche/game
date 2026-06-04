/**
 * Tests & Degrés de Réussite (DR) — Livre de base, chapitre « Tests ».
 *
 * On réussit un Test si le jet de d100 est inférieur ou égal à la valeur de
 * Compétence/Caractéristique (modifiée par la Difficulté). Le nombre de Degrés
 * de Réussite est la différence des dizaines : DR = dizaine(cible) − dizaine(jet).
 */
import { d100, RNG, defaultRNG } from './dice';
import { Difficulty, DIFFICULTY_MODIFIERS } from './types';

const tens = (n: number) => Math.floor(n / 10);

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
): TestResult {
  const target = clamp(value + DIFFICULTY_MODIFIERS[difficulty] + modifier);
  const r = d100(rng);
  return evaluateTest(r, target);
}

/** Évalue un jet déjà obtenu contre une cible (utile pour rejouer un jet). */
export function evaluateTest(r: number, target: number): TestResult {
  const success = r <= target;
  // SL = dizaine(cible) − dizaine(jet). Un 100 (« 00 ») compte comme 0 dizaines de jet réussi.
  const sl = tens(target) - tens(r === 100 ? 100 : r);
  const isDouble = r === 100 || r % 11 === 0;
  return { roll: r, target, success, sl, isDouble };
}

export interface OpposedResult {
  attacker: TestResult;
  defender: TestResult;
  attackerWins: boolean;
  /** DR net du vainqueur (sert aux dégâts en combat). */
  netSL: number;
}

/**
 * Test opposé. Le vainqueur est celui dont le DR est le plus élevé. En cas
 * d'égalité, l'attaquant l'emporte si sa valeur cible est supérieure ou égale.
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
  // En test opposé, un échec compte comme un DR « relatif » : on compare les SL,
  // l'échec étant traité comme négatif (déjà le cas dans evaluateTest).
  let attackerWins: boolean;
  if (attacker.sl !== defender.sl) attackerWins = attacker.sl > defender.sl;
  else attackerWins = attacker.target >= defender.target;
  // Si aucun des deux ne réussit, le « vainqueur » est celui qui a le moins échoué.
  const netSL = Math.abs(attacker.sl - defender.sl);
  return { attacker, defender, attackerWins, netSL };
}

function clamp(v: number): number {
  return Math.max(1, Math.min(99, v));
}
