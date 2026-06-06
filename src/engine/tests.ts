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
/** Un d100 est-il un « double » (11, 22, …, 99, 00=100) ? Génère Critique (réussi) ou Maladresse (raté). */
export function isDoubleRoll(roll: number): boolean {
  return roll === 100 || roll % 11 === 0;
}

export function evaluateTest(r: number, target: number): TestResult {
  const success = r <= target;
  // SL = dizaine(cible) − dizaine(jet). Un 100 (« 00 ») compte comme 0 dizaines de jet réussi.
  const sl = tens(target) - tens(r === 100 ? 100 : r);
  const isDouble = isDoubleRoll(r);
  return { roll: r, target, success, sl, isDouble };
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

function clamp(v: number): number {
  return Math.max(1, Math.min(99, v));
}
