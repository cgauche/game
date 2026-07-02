/**
 * Options de Prière (règles optionnelles du Livre de base) :
 *  - « Prêchez ma sœur ! » (LDB 40 l.40-42) : une Prière murmurée / sans conviction subit une Difficulté
 *    plus élevée.
 *  - « Petites Prières » (LDB 25 l.22-24) : un non-Béni qui prie dans un site sacré peut être entendu
 *    (1d100 secret du MJ, exaucé sur 01 ; le pourcentage monte avec la Compétence Prière).
 * Le retrait de Points de Péché par comportement pieux (LDB 40 l.50) est déjà couvert par l'Activité
 * « Pénitence » (engine/activities : Test de Prière → `sinMod`), inutile de le redéfinir ici.
 */
import { Difficulty } from './types';

/** Ordre des Difficultés du plus FACILE au plus DIFFICILE (LDB 12) — base d'un décalage d'un cran. */
const DIFF_ORDER: Difficulty[] = [
  'tresFacile', 'facile', 'accessible', 'intermediaire', 'complexe', 'difficile', 'tresDifficile', 'presqueImpossible', 'impossible',
];

/**
 * « Prêchez ma sœur ! » (LDB 40 l.42) : « le MJ peut exiger que tous les Tests de Prière entonnés
 * discrètement ou sans conviction subissent une Difficulté plus élevée. » Décale d'UN cran vers le plus
 * difficile quand la Prière est murmurée ; sinon la Difficulté est inchangée. Le décalage borne à la
 * Difficulté la plus dure du barème.
 */
export function discreetPrayerDifficulty(base: Difficulty, discreet: boolean): Difficulty {
  if (!discreet) return base;
  const i = DIFF_ORDER.indexOf(base);
  return i >= 0 && i < DIFF_ORDER.length - 1 ? DIFF_ORDER[i + 1] : base;
}

/**
 * « Petites Prières » (LDB 25 l.24) : « le MJ peut secrètement lancer 1d100 pour voir si votre Prière est
 * entendue. Ce qui est le cas sur un résultat de 01. Si vous avez la Compétence Prière, le MJ peut
 * augmenter ce pourcentage. » `threshold` = seuil de réussite (1 par défaut = « sur un résultat de 01 » ;
 * l'appelant le relève si le priant possède la Compétence Prière). Vrai = la Prière est entendue.
 */
export function petitePriereAnswered(roll: number, threshold = 1): boolean {
  return roll <= threshold;
}
