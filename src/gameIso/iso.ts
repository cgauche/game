/**
 * Conversion px-iso → MÈTRES MONDE (dépend de `state/relief` : `METRES_PER_LEVEL`) — seule partie de
 * l'ex-projection isométrique qui a besoin du MONDE plutôt que du seul écran. La géométrie de
 * projection elle-même (grille↔écran, centres/arêtes de tuile, tri de profondeur…) vit dans
 * `src/geometry/iso.ts` (#161 : `state` en a besoin, ce n'est pas QUE du rendu) — ce module la
 * RÉ-IMPORTE pour ses propres besoins, il ne la redéfinit pas.
 */
import { METRES_PER_LEVEL } from '../state/relief';
import { LEVEL_H, WALL_H } from '../geometry/iso';

/** Conversion px-iso → MÈTRES MONDE (SOURCE UNIQUE, ex-`pxToM` du POV) : `LEVEL_H` px (un étage écran)
 *  ⇔ `METRES_PER_LEVEL` m. Les hauteurs px des defs d'apparence (merlons, bandes, linteaux…) passent
 *  par ici pour devenir des hauteurs MONDE consommées par les builders puis les DEUX backends. */
export const isoPxToM = (px: number): number => (px / LEVEL_H) * METRES_PER_LEVEL;
/** Hauteur MÉTRIQUE d'une cloison d'arête (`WALL_H` px ≈ 2.25 m) — vérité partagée builder/backends/POV. */
export const WALL_H_M = isoPxToM(WALL_H);
