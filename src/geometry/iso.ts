/**
 * Projection isométrique (2.5D « à la Baldur's Gate ») — géométrie PURE (#161 : ex-`gameIso/iso.ts`,
 * hors du foyer `gameIso` car `state` (curseur de combat `combatCursor`, pas clavier d'exploration
 * `exploreNav`) en a besoin pour sa PROPRE logique — projection de tuile, pas du rendu SVG. Les dérivés
 * qui ont vraiment besoin du monde (métrique `WALL_H_M`/`isoPxToM`, via `state/relief`) restent dans
 * `gameIso/iso.ts`, qui importe cette géométrie plutôt que la redéfinir.
 *
 * Une tuile occupe TW de large et TH de haut en losange. Conventions partagées par le rendu ET le
 * picking (clic → tuile).
 */
export const TW = 64; // largeur d'un losange (pleine)
export const TH = 32; // hauteur d'un losange (pleine)
const SPRITE_HEADROOM = 160; // place au-dessus des tuiles pour les sprites hauts (usage interne seul)
export const CELL = 56; // côté d'une case carrée (vue du dessus)
// Vue « de face » (edge-on, crans IMPAIRS de la rotation) : l'iso TOURNÉ DE 45° → cases axis-alignées
// (rangées horizontales), même foreshortening 2:1 et même 3D que l'iso (l'extrusion des murs reste).
// EDGE_W/EDGE_H = TW/TH·√½ → même aire de tuile que le losange iso.
export const EDGE_W = TW * Math.SQRT1_2; // ≈ 45.25
export const EDGE_H = TH * Math.SQRT1_2; // ≈ 22.63
export const LEVEL_H = 96; // hauteur écran (px) d'un étage : un niveau z>0 est dessiné soulevé d'autant
/** Hauteur écran (px) d'une cloison dressée sur une arête (mur `WallSeg`). UNIFIÉ : un mur = un ÉTAGE
 *  (`WALL_H = LEVEL_H` ⇒ `WALL_H_M = METRES_PER_LEVEL` dans `gameIso/iso.ts`, une seule échelle de
 *  hauteur dans tout le monde — un mur atteint le plafond, une herse remplit son ouverture, pas de
 *  « délire » mur 2,25 m / niveau 4 m). Le relief reste porté par le SOL, pas par les murs (un mur =
 *  cloison d'arête, pas une plateforme). */
export const WALL_H = LEVEL_H;
/** Profondeur de tri : la base (anti-diagonale ÉCRAN) PRIME (× BASE_SCALE) ; l'étage `z` n'est qu'un
 *  cran SECONDAIRE (Z_STEP) de départage, lui-même au-dessus des offsets de COUCHE ajoutés par les
 *  appelants (sol −0.5, prop 0, overlay +0.25, jeton +0.5, mur +0.45, escalier +0.42 / haut d'escalier
 *  +0.7, halos +0.55/+0.6). Hiérarchie STRICTE : base ≫ z ≫ couche → murs/escaliers verticaux
 *  s'interclassent par leur vraie position écran (plus de « bande z » dominante qui enterrait un mur
 *  sous le sol du dessus). Invariants tenus par ces valeurs :
 *    BASE_SCALE > maxLevels*Z_STEP + 1   (un cran d'anti-diagonale domine toute la pile d'étages)
 *    Z_STEP     > max|layerOffset| (≈ 0.7)  (le cran d'étage domine tout offset de couche) */
export const Z_STEP = 2;
export const BASE_SCALE = 64;

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
 *  iso : diagonale écran (r.x+r.y) ; top/edge : par rangée écran (r.y prime, r.x départage). La base
 *  (anti-diagonale écran) est mise à l'échelle BASE_SCALE et l'étage `z` n'ajoute qu'un cran SECONDAIRE
 *  (Z_STEP) : à position écran ÉGALE, l'étage haut passe devant, mais un élément plus AVANT (base plus
 *  grande) à un étage bas reste devant un élément plus arrière d'un étage haut → murs/escaliers
 *  verticaux s'interclassent par leur vraie position écran. z=0 (défaut) = base × BASE_SCALE
 *  (plan-sol historique, à l'échelle près — le tri relatif est inchangé). */
export function depth(x: number, y: number, dims: Dims, z = 0) {
  const r = rotTile(x, y, dims);
  const st = axisStep(dims); // null en iso losange — la branche r.x+r.y est VIVANTE
  const base = st ? r.y * (dims.w + dims.h) + r.x : r.x + r.y;
  return base * BASE_SCALE + z * Z_STEP;
}

/** Profondeur de tri d'un élément à EMPREINTE (w×h, ancre NO) à l'étage z : MAX de `depth` sur les 4 coins
 *  → la case « proche caméra » est correcte aux 4 rotations (généralise le MAX-2-cases de wallDepth). */
export function footprintDepth(x: number, y: number, w: number, h: number, dims: Dims, z = 0): number {
  const xs = [x, x + Math.max(1, w) - 1], ys = [y, y + Math.max(1, h) - 1];
  let d = -Infinity;
  for (const cx of xs) for (const cy of ys) d = Math.max(d, depth(cx, cy, dims, z));
  return d;
}

/** Base ÉCRAN (colonne, profondeur) d'une case dans la projection COURANTE — même repère que `depth`/
 *  `tileCenter` : losange = anti-diagonale (col) / diagonale (dep) ; edge-on ou dessus = colonne x / rangée y. */
function screenBasis(x: number, y: number, dims: Dims): { col: number; dep: number } {
  const r = rotTile(x, y, dims);
  return dims.view === 'top' || dims.edge ? { col: r.x, dep: r.y } : { col: r.x - r.y, dep: r.x + r.y };
}

/** Prédicat d'OCCLUSION écran : une case (tx,ty) occulte un `actorTiles` si elle est DEVANT lui (camera-near),
 *  sur la MÊME colonne écran (± 1) et à ≤ `reach` cases de profondeur. Base = `screenBasis` → suit la caméra
 *  aux 4 crans et dans les deux projections. PUR (testable) : partagé par l'estompe des murs/décor et le
 *  cutaway des toits (un décor HAUT devant un acteur s'efface pour ne pas le cacher). */
export function makeOccludes(dims: Dims, actorTiles: { x: number; y: number }[], reach = 7): (tx: number, ty: number) => boolean {
  const actors = actorTiles.map((a) => screenBasis(a.x, a.y, dims));
  return (tx, ty) => {
    const t = screenBasis(tx, ty, dims);
    return actors.some((a) => a.dep < t.dep && Math.abs(a.col - t.col) <= 1 && t.dep - a.dep <= reach);
  };
}
