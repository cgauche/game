/**
 * MARQUEUR DE SOURCE LUMINEUSE de l'éditeur (#1176, P3-3, vague B) — la géométrie de son cercle de
 * PORTÉE, et rien d'autre. Le marqueur lui-même est une affordance d'auteur (`EditorCanvas`) : en
 * atelier, l'écran est en plein jour et la photométrie éteint toutes les flaques (`extinctionDe(1)`
 * vaut 0), donc rien ne trahirait une lampe posée.
 *
 * POURQUOI UN MODULE : le cercle de portée est un cercle de GRILLE (rayon en cases), et sa projection
 * n'est pas un cercle — c'est une ellipse dont les demi-axes dépendent de la VUE. Les prendre au pif
 * (une diagonale d'écran, un aplatissement constant) donne une portée fausse : mesuré avant ce
 * correctif, −21 % en losange et −50 % en vue du DESSUS, celle où l'auteur travaille son plan.
 */
import { tileCenter, type Dims } from '../../geometry/iso';

/** Demi-axes ÉCRAN du cercle de rayon `r` cases centré sur `(x,y)` de la couche `z`. */
export interface EllipseAxes {
  rx: number;
  ry: number;
}

/**
 * Demi-axes de l'ellipse PROJETÉE, exacts et dérivés de la projection courante.
 *
 * La projection d'une carte est AFFINE : un pas d'une case en `x` donne un vecteur écran `u`, un pas
 * en `y` un vecteur `v` (tous deux lus sur `tileCenter`, la source unique). Le cercle de grille
 * `p(θ) = r·(cosθ·u + sinθ·v)` a donc, par composante, l'amplitude `r·hypot(uₓ, vₓ)` en x et
 * `r·hypot(u_y, v_y)` en y — le maximum de `a·cosθ + b·sinθ`. Aucune approximation, aucun
 * échantillonnage : en vue du DESSUS où `u` et `v` sont orthogonaux et de même longueur, le résultat
 * est un cercle ROND, comme il doit l'être. PURE.
 */
export function projectedRangeAxes(x: number, y: number, z: number, radiusTiles: number, dims: Dims): EllipseAxes {
  const o = tileCenter(x, y, dims, z);
  const u = tileCenter(x + 1, y, dims, z);
  const v = tileCenter(x, y + 1, dims, z);
  const ux = u.cx - o.cx, uy = u.cy - o.cy;
  const vx = v.cx - o.cx, vy = v.cy - o.cy;
  return { rx: radiusTiles * Math.hypot(ux, vx), ry: radiusTiles * Math.hypot(uy, vy) };
}
