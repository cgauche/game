/**
 * Règles de déplacement étendu — Livre de base, ch.15 « Déplacement ».
 */
import { RNG, defaultRNG } from './dice';
import { rollTest } from './tests';

/**
 * Course (LDB 15-Déplacement l.79-82) : « vous pouvez utiliser votre Action pour courir. Vous avez
 * besoin d'un Test d'Athlétisme Accessible (+20)… Vous pouvez courir sur une distance équivalente à
 * votre Mouvement de Course + DR ». On parcourt donc sa Marche (Mouvement) PLUS cette distance de course.
 *
 * Grille du jeu : 2 m/case ; le Mouvement de Course = 2×Mouvement cases (cf. Charge). Le DR du Test est
 * exprimé en MÈTRES par le livre → converti en cases (÷2, arrondi). `bonusCases` = la distance de course
 * ajoutée à la Marche, plancher 0. Le `success` sert à l'affichage ; le bonus s'applique même sur un DR
 * négatif (le livre court « Course + DR » avec un DR pouvant être négatif), clampé ≥ 0.
 */
export function resolveRun(
  athletics: number,
  movement: number,
  rng: RNG = defaultRNG,
): { success: boolean; roll: number; target: number; dr: number; bonusCases: number } {
  const t = rollTest(athletics, 'accessible', rng); // Athlétisme Accessible (+20)
  const bonusCases = Math.max(0, 2 * movement + Math.round(t.sl / 2));
  return { success: t.success, roll: t.roll, target: t.target, dr: t.sl, bonusCases };
}

/**
 * Saut (LDB 15-Déplacement l.114-115). « Vous pouvez sauter de votre valeur de Mouvement/3 en mètres
 * SANS avoir à effectuer de Test. » Échelle du jeu = 2 m/case (précédent `resolveRun` : les mètres du
 * livre se convertissent en cases ÷2). Saut libre = `floor((M/3)/2)` = `floor(M/6)` cases.
 */
export function freeJumpTiles(movement: number): number {
  return Math.max(0, Math.floor(movement / 6));
}

/**
 * Distance MAXIMALE qu'on peut TENTER (au prix d'un Test d'Athlétisme) = saut libre + 1 case. Le livre
 * étend le saut de « 30 cm par DR » sur réussite ; sur la grille à 2 m/case, l'incrément minimal
 * praticable est UNE case. Au-delà, le gouffre est infranchissable.
 */
export function maxJumpTiles(movement: number): number {
  return freeJumpTiles(movement) + 1;
}

/** Un saut de `tiles` cases exige-t-il un Test d'Athlétisme ? Oui dès qu'il dépasse le saut libre. */
export function jumpNeedsTest(movement: number, tiles: number): boolean {
  return tiles > freeJumpTiles(movement);
}
