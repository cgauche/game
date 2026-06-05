/**
 * Projection isométrique (2.5D « à la Baldur's Gate »).
 * Une tuile occupe TW de large et TH de haut en losange.
 * Conventions partagées par le rendu ET le picking (clic → tuile).
 */
export const TW = 64; // largeur d'un losange (pleine)
export const TH = 32; // hauteur d'un losange (pleine)
export const SPRITE_HEADROOM = 160; // place au-dessus des tuiles pour les sprites hauts

/** Marge à gauche pour que la tuile la plus à gauche reste visible (dimensions effectives). */
export function originX(dims: Dims) {
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

/** Centre écran d'une tuile (x,y), en tenant compte de la rotation caméra. */
export function tileCenter(x: number, y: number, dims: Dims): { cx: number; cy: number } {
  const r = rotTile(x, y, dims);
  return {
    cx: originX(dims) + (r.x - r.y) * (TW / 2),
    cy: originY() + (r.x + r.y) * (TH / 2),
  };
}

/** Taille totale du canvas SVG pour une carte donnée (dimensions effectives). */
export function stageSize(dims: Dims): { w: number; h: number } {
  const ed = effDims(dims);
  return {
    w: (ed.w + ed.h) * (TW / 2) + TW,
    h: (ed.w + ed.h) * (TH / 2) + SPRITE_HEADROOM + TH,
  };
}

/** Inverse : point écran (relatif au SVG) → coordonnées de tuile entières (dé-tourne). */
export function screenToTile(px: number, py: number, dims: Dims): { x: number; y: number } {
  const dx = px - originX(dims);
  const dy = py - originY();
  const a = dx / (TW / 2);
  const b = dy / (TH / 2);
  const rx = Math.round((a + b) / 2);
  const ry = Math.round((b - a) / 2);
  return unrotTile(rx, ry, dims);
}

/** Les 4 sommets (et le centre) du losange d'une tuile — source unique de la
 *  géométrie TW/TH, partagée par diamondPath et le raccord d'arêtes (ground.ts). */
export function diamondCorners(x: number, y: number, dims: Dims) {
  const { cx, cy } = tileCenter(x, y, dims);
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
export function diamondPath(x: number, y: number, dims: Dims): string {
  const { top, right, bot, left } = diamondCorners(x, y, dims);
  return `M${top[0]},${top[1]} L${right[0]},${right[1]} L${bot[0]},${bot[1]} L${left[0]},${left[1]} Z`;
}

/** Profondeur de tri (plus grand = devant). */
export function depth(x: number, y: number) {
  return x + y;
}
