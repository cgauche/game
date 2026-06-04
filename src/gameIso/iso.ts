/**
 * Projection isométrique (2.5D « à la Baldur's Gate »).
 * Une tuile occupe TW de large et TH de haut en losange.
 * Conventions partagées par le rendu ET le picking (clic → tuile).
 */
export const TW = 64; // largeur d'un losange (pleine)
export const TH = 32; // hauteur d'un losange (pleine)
export const SPRITE_HEADROOM = 160; // place au-dessus des tuiles pour les sprites hauts

/** Marge à gauche pour que la tuile la plus à gauche (x=0,y=h-1) reste visible. */
export function originX(h: number) {
  return (h - 1) * (TW / 2) + TW / 2;
}
export function originY() {
  return SPRITE_HEADROOM;
}

export interface Dims {
  w: number;
  h: number;
}

/** Centre écran d'une tuile (x,y). */
export function tileCenter(x: number, y: number, dims: Dims): { cx: number; cy: number } {
  return {
    cx: originX(dims.h) + (x - y) * (TW / 2),
    cy: originY() + (x + y) * (TH / 2),
  };
}

/** Taille totale du canvas SVG pour une carte donnée. */
export function stageSize(dims: Dims): { w: number; h: number } {
  return {
    w: (dims.w + dims.h) * (TW / 2) + TW,
    h: (dims.w + dims.h) * (TH / 2) + SPRITE_HEADROOM + TH,
  };
}

/** Inverse : point écran (relatif au SVG) → coordonnées de tuile entières. */
export function screenToTile(px: number, py: number, dims: Dims): { x: number; y: number } {
  const dx = px - originX(dims.h);
  const dy = py - originY();
  const a = dx / (TW / 2);
  const b = dy / (TH / 2);
  return { x: Math.round((a + b) / 2), y: Math.round((b - a) / 2) };
}

/** Chemin SVG d'un losange de sol centré sur la tuile. */
export function diamondPath(x: number, y: number, dims: Dims): string {
  const { cx, cy } = tileCenter(x, y, dims);
  return `M${cx},${cy - TH / 2} L${cx + TW / 2},${cy} L${cx},${cy + TH / 2} L${cx - TW / 2},${cy} Z`;
}

/** Profondeur de tri (plus grand = devant). */
export function depth(x: number, y: number) {
  return x + y;
}
