/**
 * GRILLE DE CASES de l'éditeur (#1176, P3-3) — la surcouche d'authoring qui rend les LIMITES de cases
 * lisibles, et la fonction de base d'un éditeur de plan.
 *
 * POURQUOI ELLE EXISTE MAINTENANT : sur la voie AFFINE, chaque losange de sol est tracé avec son
 * contour (`authoring/floorsSvg.ts` : `stroke` sur le `path` de base), et cette couture DONNE la
 * grille — mesuré à l'écran, une périodicité franche au pas de la case. Le monde VOLUMIQUE, lui,
 * fusionne les faces coplanaires de même matériau en une géométrie continue : deux cases voisines de
 * même terrain n'ont plus aucune limite visible. La grille cesse donc d'être un effet de bord du
 * dessin, et devient ce qu'elle aurait toujours dû être : une SURCOUCHE d'auteur, explicite.
 * Elle rejoint la lisibilité de plateau que demande l'arbitrage utilisateur du 2026-08-12 (vue TOP =
 * tactique tabletop : pions, découvert, grille).
 *
 * COÛT : un segment par RANGÉE et par COLONNE (`w + h + 2` chemins), jamais un par case — une carte
 * 32×38 en pose 72, contre 1 216 losanges.
 */
import { tileCenter, type Dims } from '../../geometry/iso';

/** Un trait de grille, en coordonnées de PROJECTION (le repère du viewBox de l'éditeur). */
export interface GridLine {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

/**
 * Les traits de la grille d'une carte, au niveau `z` : les `w+1` lignes de colonne et les `h+1`
 * lignes de rangée, posées sur les BORDS de case (les demi-entiers de la grille, la même convention
 * que les coins de `diamondPath`). Projetées par `tileCenter`, donc justes sous toute vue et tout
 * cran — la grille suit la carte, elle n'est pas un quadrillage d'écran. PURE.
 */
export function gridLines(dims: Dims, z = 0): GridLine[] {
  const out: GridLine[] = [];
  const coin = (gx: number, gy: number) => tileCenter(gx - 0.5, gy - 0.5, dims, z);
  for (let x = 0; x <= dims.w; x++) {
    const a = coin(x, 0);
    const b = coin(x, dims.h);
    out.push({ x1: a.cx, y1: a.cy, x2: b.cx, y2: b.cy });
  }
  for (let y = 0; y <= dims.h; y++) {
    const a = coin(0, y);
    const b = coin(dims.w, y);
    out.push({ x1: a.cx, y1: a.cy, x2: b.cx, y2: b.cy });
  }
  return out;
}
