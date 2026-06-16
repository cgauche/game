/**
 * Projection isométrique (2.5D « à la Baldur's Gate »).
 * Une tuile occupe TW de large et TH de haut en losange.
 * Conventions partagées par le rendu ET le picking (clic → tuile).
 */
export const TW = 64; // largeur d'un losange (pleine)
export const TH = 32; // hauteur d'un losange (pleine)
export const SPRITE_HEADROOM = 160; // place au-dessus des tuiles pour les sprites hauts
export const CELL = 56; // côté d'une case carrée (vue du dessus)
// Vue « de face » (edge-on, crans IMPAIRS de la rotation) : l'iso TOURNÉ DE 45° → cases axis-alignées
// (rangées horizontales), même foreshortening 2:1 et même 3D que l'iso (l'extrusion des murs reste).
// EDGE_W/EDGE_H = TW/TH·√½ → même aire de tuile que le losange iso.
export const EDGE_W = TW * Math.SQRT1_2; // ≈ 45.25
export const EDGE_H = TH * Math.SQRT1_2; // ≈ 22.63
export const LEVEL_H = 96; // hauteur écran (px) d'un étage : un niveau z>0 est dessiné soulevé d'autant
/** Poids de profondeur d'un étage : un niveau z+1 se dessine TOUJOURS après (au-dessus de) tout
 *  le niveau z (les scènes font au plus quelques dizaines de cases → base ≪ LEVEL_DEPTH). */
const LEVEL_DEPTH = 1_000_000;

/** Marge à gauche pour que la tuile la plus à gauche reste visible (dimensions effectives). */
export function originX(dims: Dims) {
  const st = axisStep(dims);
  if (st) return st.sx; // marge gauche = 1 tuile
  const ed = effDims(dims);
  return (ed.h - 1) * (TW / 2) + TW / 2;
}
export function originY() {
  return SPRITE_HEADROOM;
}

export type Rot = 0 | 1 | 2 | 3;

/** Projection de la carte : 'iso' losange 2.5D (défaut) · 'top' grille carrée + pastilles (vue du dessus). */
export type ViewMode = 'iso' | 'top';

/** Grille carrée PLATE (vue du dessus 'top', acteurs en pastilles) : distincte du losange iso ET de
 *  l'edge-on (qui garde la 3D). Sert UNIQUEMENT à router le rendu plat (murs/bâtiments sans extrusion). */
export const isSquareView = (view?: ViewMode): boolean => view === 'top';

export interface Dims {
  w: number;
  h: number;
  rot?: Rot; // orientation caméra (cran de 90° horaire) ; absent ⇒ 0
  view?: ViewMode; // projection ; absent ⇒ 'iso' (losange). Cf. ViewMode.
  edge?: boolean; // vue « de face » (edge-on) : grille axis-alignée MAIS 3D conservée (crans impairs). ⊥ view.
}

/** Pas écran (sx, sy) d'une tuile en projection AXIS-ALIGNÉE — carré 'top' (CELL) ou « de face » edge-on
 *  (rectangle EDGE_W×EDGE_H = l'iso tourné de 45°) — ou null en iso losange (projection diagonale).
 *  SOURCE UNIQUE : top et edge partagent toute la géométrie axis-alignée, seul le pas diffère. */
function axisStep(dims: Dims): { sx: number; sy: number } | null {
  if (dims.view === 'top') return { sx: CELL, sy: CELL };
  if (dims.edge) return { sx: EDGE_W, sy: EDGE_H };
  return null;
}

/** Facteur d'échelle d'un BILLBOARD (token/prop ancré aux pieds) selon la projection : la tuile « de
 *  face » (edge-on) est plus ÉTROITE (EDGE_W) que le losange iso (TW) → on réduit le sprite d'autant
 *  pour qu'il remplisse SA tuile dans les deux vues (sinon il déborde et chevauche ses voisins en vue
 *  de face → « décor placé aléatoirement »). 1 en iso ; la vue du dessus 'top' garde sa propre échelle. */
export function billboardScale(dims: Dims): number {
  return dims.edge && dims.view !== 'top' ? EDGE_W / TW : 1;
}

/** Largeur ÉCRAN d'une empreinte w×h, exprimée en « largeurs de tuile » de la projection courante
 *  (donc 1 pour 1×1, quelles que soient vue/rotation/edge). Sert à dimensionner un billboard MULTI-CASES
 *  pour qu'il couvre exactement SON empreinte projetée — et la SUIVE quand la caméra tourne, au lieu d'une
 *  échelle figée `max(w,h)` qui déborde aux crans obliques (le décor « se déplace » à la rotation). Couplée
 *  à `billboardScale` (le multiplicateur reste relatif à UNE tuile, la projection est gérée à part). */
export function footprintSpan(w: number, h: number, dims: Dims): number {
  if (w <= 1 && h <= 1) return 1;
  // x-extent ÉCRAN des 4 coins EXTÉRIEURS du bloc (coins de grille = tileCenter à ±0.5).
  const corner = (gx: number, gy: number) => tileCenter(gx - 0.5, gy - 0.5, dims).cx;
  const xs = [corner(0, 0), corner(w, 0), corner(0, h), corner(w, h)];
  const width = Math.max(...xs) - Math.min(...xs);
  const st = axisStep(dims);
  const oneTile = st ? st.sx : TW; // largeur d'UNE tuile dans la même projection
  return width / oneTile;
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
  const st = axisStep(dims);
  if (st) {
    return { cx: originX(dims) + r.x * st.sx, cy: originY() + r.y * st.sy - lift };
  }
  return {
    cx: originX(dims) + (r.x - r.y) * (TW / 2),
    cy: originY() + (r.x + r.y) * (TH / 2) - lift,
  };
}

/** Taille totale du canvas SVG pour une carte donnée (dimensions effectives). */
export function stageSize(dims: Dims): { w: number; h: number } {
  const ed = effDims(dims);
  const st = axisStep(dims);
  if (st) {
    return { w: ed.w * st.sx + 2 * st.sx, h: ed.h * st.sy + SPRITE_HEADROOM + st.sy };
  }
  return {
    w: (ed.w + ed.h) * (TW / 2) + TW,
    h: (ed.w + ed.h) * (TH / 2) + SPRITE_HEADROOM + TH,
  };
}

/** Inverse : point écran (relatif au SVG) → coordonnées de tuile entières (dé-tourne). */
export function screenToTile(px: number, py: number, dims: Dims): { x: number; y: number } {
  const st = axisStep(dims);
  if (st) {
    const rx = Math.round((px - originX(dims)) / st.sx);
    const ry = Math.round((py - originY()) / st.sy);
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

/** Inverse de `tileCenter` SANS arrondi : coordonnées de tuile FRACTIONNAIRES (l'offset au centre d'une
 *  case ∈ [-0.5,0.5] sert au picking d'ARÊTE de l'éditeur de murs). Dé-tourne en continu (unrotTile est
 *  une transformée linéaire, valable sur des flottants). z = étage visé. */
export function screenToTileF(px: number, py: number, dims: Dims, z = 0): { x: number; y: number } {
  const qy = py + z * LEVEL_H;
  const st = axisStep(dims);
  if (st) {
    return unrotTile((px - originX(dims)) / st.sx, (qy - originY()) / st.sy, dims);
  }
  const a = (px - originX(dims)) / (TW / 2);
  const b = (qy - originY()) / (TH / 2);
  return unrotTile((a + b) / 2, (b - a) / 2, dims);
}

/** Les 4 sommets (et le centre) d'une tuile — source unique de la géométrie, partagée par
 *  diamondPath et le raccord d'arêtes (ground.ts). Losange (TW/TH) en iso ; carré (CELL) en
 *  vue du dessus, où top=NO, right=NE, bot=SE, left=SO (l'ordre compose avec groundTile/diamondPath). */
export function diamondCorners(x: number, y: number, dims: Dims, z = 0) {
  const { cx, cy } = tileCenter(x, y, dims, z);
  const st = axisStep(dims);
  if (st) {
    const hx = st.sx / 2, hy = st.sy / 2;
    return {
      cx,
      cy,
      top: [cx - hx, cy - hy] as [number, number],
      right: [cx + hx, cy - hy] as [number, number],
      bot: [cx + hx, cy + hy] as [number, number],
      left: [cx - hx, cy + hy] as [number, number],
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

export type EdgeSide = 'N' | 'E' | 'S' | 'O';

/** Les 2 extrémités-ÉCRAN de l'ARÊTE cardinale `side` de la case (x,y) au LIFT donné (z + élévation).
 *  Calculé sur les COINS DE GRILLE projetés AVEC la rotation (un coin (gx,gy) = `tileCenter(gx-0.5,gy-0.5)`).
 *  SOURCE UNIQUE de la géométrie d'arête : MURS, JUPES d'élévation et ESCALIERS s'en servent → ils tournent
 *  TOUS de la même façon avec la caméra (zéro duplication ; corriger ici corrige partout). */
export function tileEdge(x: number, y: number, side: EdgeSide, dims: Dims, lift = 0): [{ cx: number; cy: number }, { cx: number; cy: number }] {
  const gc = (gx: number, gy: number) => tileCenter(gx - 0.5, gy - 0.5, dims, lift);
  switch (side) {
    case 'N': return [gc(x, y), gc(x + 1, y)];
    case 'E': return [gc(x + 1, y), gc(x + 1, y + 1)];
    case 'S': return [gc(x + 1, y + 1), gc(x, y + 1)];
    default: return [gc(x, y + 1), gc(x, y)]; // O
  }
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
  const st = dims ? axisStep(dims) : null;
  const base = st ? r.y * (dims!.w + dims!.h) + r.x : r.x + r.y;
  return base + z * LEVEL_DEPTH;
}

/** Profondeur de tri du PLANCHER d'un étage z : une seule valeur pour tout le sol du niveau, juste
 *  SOUS le plus bas de ses objets (base 0) et bien AU-DESSUS de tout le niveau inférieur (≤ base+0.5,
 *  ≪ LEVEL_DEPTH). Le sol z dessine ainsi par-dessus les tokens de z−1 (surplomb) sans jamais occulter
 *  les tokens de son propre niveau (tri global unique ; les tuiles d'un même sol gardent l'ordre
 *  arrière→avant par tri stable). z·LEVEL_DEPTH obtenu sans exposer LEVEL_DEPTH (la base se simplifie). */
export function floorDepth(dims: Dims, z: number) {
  return depth(0, 0, dims, z) - depth(0, 0, dims, 0) - 0.5;
}
