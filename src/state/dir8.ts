/**
 * Orientation MONDE d'une entité/combattant : 8 directions grille (4 cardinales + 4 diagonales).
 * Source de vérité de l'orientation ; projetée au rendu par `project()`
 * (src/gameIso/rig/facing.ts) en tenant compte de la rotation caméra (`camRot`).
 *
 * Distincte de `Facing` (4-dir, src/state/scene.ts), qui sert UNIQUEMENT à orienter la
 * porte/les ouvertures d'un bâtiment — pas l'orientation d'un personnage.
 */
export type Dir8 = 'N' | 'NE' | 'E' | 'SE' | 'S' | 'SO' | 'O' | 'NO';
