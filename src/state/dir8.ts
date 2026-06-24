/**
 * Orientation MONDE d'une entité/combattant : 8 directions grille (4 cardinales + 4 diagonales).
 * Source de vérité de l'orientation ; projetée au rendu par `project()`
 * (src/gameIso/rig/facing.ts) en tenant compte de la rotation caméra (`camRot`).
 *
 * Distincte de `Facing` (4-dir, src/state/scene.ts), qui sert UNIQUEMENT à orienter la
 * porte/les ouvertures d'un bâtiment — pas l'orientation d'un personnage.
 */
export type Dir8 = 'N' | 'NE' | 'E' | 'SE' | 'S' | 'SO' | 'O' | 'NO';

/** Les 8 caps en ordre HORAIRE, 45° par cran — SOURCE UNIQUE (arc de tir, rotation, rendu). */
export const DIR8_ORDER: Dir8[] = ['N', 'NE', 'E', 'SE', 'S', 'SO', 'O', 'NO'];

/**
 * Tourne un cap de `steps` crans de 45° (HORAIRE si `steps > 0` = vers tribord/droite ; anti-horaire si
 * `< 0` = vers bâbord/gauche). PUR. Ex. `rotateDir8('N', 2)` = 'E' (90° à droite, vire tribord) ;
 * `rotateDir8('N', -2)` = 'O' (90° à gauche, vire bâbord) ; `rotateDir8('N', -1)` = 'NO' (45° à gauche).
 */
export function rotateDir8(dir: Dir8, steps: number): Dir8 {
  return DIR8_ORDER[(DIR8_ORDER.indexOf(dir) + (steps % 8) + 8) % 8];
}
