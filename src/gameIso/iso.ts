/**
 * Projection isométrique (2.5D « à la Baldur's Gate »).
 * Une tuile occupe TW de large et TH de haut en losange.
 * Conventions partagées par le rendu ET le picking (clic → tuile).
 */
export const TW = 64; // largeur d'un losange (pleine)
export const TH = 32; // hauteur d'un losange (pleine)
export const SPRITE_HEADROOM = 160; // place au-dessus des tuiles pour les sprites hauts
export const CELL = 56; // côté d'une case carrée (vue du dessus)
export const LEVEL_H = 96; // hauteur écran (px) d'un étage : un niveau z>0 est dessiné soulevé d'autant
/** Poids de profondeur d'un étage : un niveau z+1 se dessine TOUJOURS après (au-dessus de) tout
 *  le niveau z (les scènes font au plus quelques dizaines de cases → base ≪ LEVEL_DEPTH). */
const LEVEL_DEPTH = 1_000_000;

/** Marge à gauche pour que la tuile la plus à gauche reste visible (dimensions effectives). */
export function originX(dims: Dims) {
  if (dims.view === 'top') return CELL; // marge gauche = 1 case
  const ed = effDims(dims);
  return (ed.h - 1) * (TW / 2) + TW / 2;
}
export function originY() {
  return SPRITE_HEADROOM;
}

export type Rot = 0 | 1 | 2 | 3;

export interface Dims {
  w: number;
  h: number;
  rot?: Rot; // orientation caméra (cran de 90° horaire) ; absent ⇒ 0
  view?: 'iso' | 'top'; // projection ; absent ⇒ 'iso' (losange). 'top' = grille carrée vue du dessus
}

/** Dimensions effectives à l'écran : pour rot impair, une grille W×H tournée occupe H×W. */
export function effDims(dims: Dims): { w: number; h: number } {
  return (dims.rot ?? 0) % 2 === 0 ? { w: dims.w, h: dims.h } : { w: dims.h, h: dims.w };
}

/** Coordonnée de tuile tournée (grille → espace écran tourné). PUR. */
export function rotTile(x: number, y: number, dims: Dims): { x: number; y: number } {
  const W = dims.w,
    H = dims.h;
  switch (dims.rot ?? 0) {
    case 1:
      return { x: y, y: W - 1 - x };
    case 2:
      return { x: W - 1 - x, y: H - 1 - y };
    case 3:
      return { x: H - 1 - y, y: x };
    default:
      return { x, y };
  }
}

/** Inverse de rotTile (espace écran tourné → grille). PUR. */
export function unrotTile(x: number, y: number, dims: Dims): { x: number; y: number } {
  const W = dims.w,
    H = dims.h;
  switch (dims.rot ?? 0) {
    case 1:
      return { x: W - 1 - y, y: x };
    case 2:
      return { x: W - 1 - x, y: H - 1 - y };
    case 3:
      return { x: y, y: H - 1 - x };
    default:
      return { x, y };
  }
}

/** Centre écran d'une tuile (x,y), en tenant compte de la rotation caméra, de la projection et de
 *  l'élévation `z` (niveau d'étage) : un niveau plus haut est soulevé de `z·LEVEL_H` px (cy plus
 *  petit), cx inchangé. z=0 (défaut) = comportement plan-sol historique. */
export function tileCenter(x: number, y: number, dims: Dims, z = 0): { cx: number; cy: number } {
  const r = rotTile(x, y, dims);
  const lift = z * LEVEL_H;
  if (dims.view === 'top') {
    return { cx: originX(dims) + r.x * CELL, cy: originY() + r.y * CELL - lift };
  }
  return {
    cx: originX(dims) + (r.x - r.y) * (TW / 2),
    cy: originY() + (r.x + r.y) * (TH / 2) - lift,
  };
}

/** Taille totale du canvas SVG pour une carte donnée (dimensions effectives). */
export function stageSize(dims: Dims): { w: number; h: number } {
  const ed = effDims(dims);
  if (dims.view === 'top') {
    return { w: ed.w * CELL + 2 * CELL, h: ed.h * CELL + SPRITE_HEADROOM + CELL };
  }
  return {
    w: (ed.w + ed.h) * (TW / 2) + TW,
    h: (ed.w + ed.h) * (TH / 2) + SPRITE_HEADROOM + TH,
  };
}

/** Inverse : point écran (relatif au SVG) → coordonnées de tuile entières (dé-tourne). */
export function screenToTile(px: number, py: number, dims: Dims): { x: number; y: number } {
  if (dims.view === 'top') {
    const rx = Math.round((px - originX(dims)) / CELL);
    const ry = Math.round((py - originY()) / CELL);
    return unrotTile(rx, ry, dims);
  }
  const dx = px - originX(dims);
  const dy = py - originY();
  const a = dx / (TW / 2);
  const b = dy / (TH / 2);
  const rx = Math.round((a + b) / 2);
  const ry = Math.round((b - a) / 2);
  return unrotTile(rx, ry, dims);
}

/** Inverse de `tileCenter` POUR UN NIVEAU DONNÉ `z` : ré-applique l'élévation (le point écran a été
 *  soulevé de z·LEVEL_H) avant l'inversion plan-sol. Le picking 3D itère z du haut vers le bas et
 *  retient la 1re tuile occupée. z=0 (défaut) ≡ screenToTile. */
export function screenToTileAtZ(px: number, py: number, dims: Dims, z = 0): { x: number; y: number } {
  return screenToTile(px, py + z * LEVEL_H, dims);
}

/** Les 4 sommets (et le centre) d'une tuile — source unique de la géométrie, partagée par
 *  diamondPath et le raccord d'arêtes (ground.ts). Losange (TW/TH) en iso ; carré (CELL) en
 *  vue du dessus, où top=NO, right=NE, bot=SE, left=SO (l'ordre compose avec groundTile/diamondPath). */
export function diamondCorners(x: number, y: number, dims: Dims, z = 0) {
  const { cx, cy } = tileCenter(x, y, dims, z);
  if (dims.view === 'top') {
    const h = CELL / 2;
    return {
      cx,
      cy,
      top: [cx - h, cy - h] as [number, number],
      right: [cx + h, cy - h] as [number, number],
      bot: [cx + h, cy + h] as [number, number],
      left: [cx - h, cy + h] as [number, number],
    };
  }
  return {
    cx,
    cy,
    top: [cx, cy - TH / 2] as [number, number],
    right: [cx + TW / 2, cy] as [number, number],
    bot: [cx, cy + TH / 2] as [number, number],
    left: [cx - TW / 2, cy] as [number, number],
  };
}

/** Chemin SVG d'un losange de sol centré sur la tuile. */
export function diamondPath(x: number, y: number, dims: Dims, z = 0): string {
  const { top, right, bot, left } = diamondCorners(x, y, dims, z);
  return `M${top[0]},${top[1]} L${right[0]},${right[1]} L${bot[0]},${bot[1]} L${left[0]},${left[1]} Z`;
}

/** Profondeur de tri (plus grand = devant), dans l'orientation courante, niveau `z` compris.
 *  iso : diagonale écran (r.x+r.y) ; top : par rangée écran (r.y prime, r.x départage). Un niveau
 *  z+1 ajoute LEVEL_DEPTH → il se dessine TOUJOURS après tout le niveau z (ordre intra-niveau
 *  préservé). `dims` optionnel : absent ⇒ rot 0 (rétro-compat des appelants non encore migrés).
 *  z=0 (défaut) = comportement plan-sol historique. */
export function depth(x: number, y: number, dims?: Dims, z = 0) {
  const r = dims ? rotTile(x, y, dims) : { x, y };
  const base = dims?.view === 'top' ? r.y * (dims.w + dims.h) + r.x : r.x + r.y;
  return base + z * LEVEL_DEPTH;
}
