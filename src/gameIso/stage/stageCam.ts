/**
 * TRANSFORMATION D'ÉCRAN du stage — source UNIQUE de la chaîne « point de viewBox → pixel de
 * l'élément » que le stage SVG applique, et dont la caméra volumique (`stage3dCamera.ts`) est la
 * traduction. Module PUR : aucun `three`, aucun DOM, aucun store.
 *
 * Deux étages, jamais recopiés ailleurs :
 *  1. CAMÉRA du groupe (pan/zoom, unités de viewBox) — `IsoStage` la pose en `transform` CSS ;
 *  2. RECOUVREMENT du viewBox (`preserveAspectRatio="xMidYMid slice"` de `.iso-stage`) : le viewBox
 *     `0 0 VW VH` RECOUVRE l'élément, donc son échelle est le MAX des deux rapports (un `meet` en
 *     prendrait le min) et son centre coïncide avec le centre de l'élément (`xMidYMid`).
 *
 * `stageCamTransform` (la CSS que le stage rend) et `stageScreenPixel` (le pixel que les gardes
 * mesurent) DÉRIVENT toutes deux de `stageCamAffine` : une retouche de l'une ne peut pas laisser
 * l'autre en arrière. Le PICKING remonte la même chaîne à l'envers (`viewBoxPointAt` puis
 * `stagePointAt`) — pixel de l'élément → point de projection — sans jamais interroger un CTM de SVG,
 * que la voie volumique n'a pas.
 */
import { VH, VW } from './useStageCamera';

/** Cadre en pixels CSS de la surface de rendu. */
export interface StageCanvas {
  w: number;
  h: number;
}

/** Affine viewBox→viewBox du groupe caméra : `q = k·p + t`. */
export interface StageCamAffine {
  k: number;
  tx: number;
  ty: number;
}

/** Caméra du groupe : zoom APPLIQUÉ (creux de transition de cran compris) autour du CENTRE du viewBox,
 *  puis translation `cam` (unités de viewBox). Soit `q = k·(p − C + cam) + C`. */
export function stageCamAffine(cam: { x: number; y: number }, zoom: number): StageCamAffine {
  return {
    k: zoom,
    tx: zoom * cam.x + (1 - zoom) * (VW / 2),
    ty: zoom * cam.y + (1 - zoom) * (VH / 2),
  };
}

/** La `transform` CSS du groupe caméra du stage — l'affine ci-dessus, écrite en `matrix()` (ses deux
 *  derniers termes sont des px, comme les `translate` qu'elle remplace). */
export function stageCamTransform(cam: { x: number; y: number }, zoom: number): string {
  const { k, tx, ty } = stageCamAffine(cam, zoom);
  return `matrix(${k}, 0, 0, ${k}, ${tx}, ${ty})`;
}

/** Facteur du `preserveAspectRatio="xMidYMid slice"` de `.iso-stage` : le viewBox RECOUVRE l'élément,
 *  donc MAX des deux rapports (`meet` en prendrait le min, et laisserait des bandes). */
export function viewBoxScale(canvas: StageCanvas): number {
  return Math.max(canvas.w / VW, canvas.h / VH);
}

/** Pixel de l'ÉLÉMENT où tombe un point de viewBox `p` (typiquement la sortie de `tileCenter`) :
 *  caméra du groupe, puis recouvrement du viewBox centré (`xMidYMid`). */
export function stageScreenPixel(
  p: { cx: number; cy: number },
  cam: { x: number; y: number },
  zoom: number,
  canvas: StageCanvas,
): { sx: number; sy: number } {
  const { k, tx, ty } = stageCamAffine(cam, zoom);
  const s = viewBoxScale(canvas);
  return {
    sx: (k * p.cx + tx - VW / 2) * s + canvas.w / 2,
    sy: (k * p.cy + ty - VH / 2) * s + canvas.h / 2,
  };
}

/** Point de VIEWBOX sous un pixel de l'ÉLÉMENT — premier étage de l'inverse de `stageScreenPixel`
 *  (recouvrement `slice` centré, seul). C'est le repère qu'un `getScreenCTM()` de SVG rendait ; il ne
 *  se lit plus d'un CTM, parce qu'un CANEVAS n'en a pas et que les deux voies doivent inverser la MÊME
 *  chaîne. `px` est relatif au coin haut-gauche de l'élément. */
export function viewBoxPointAt(px: { sx: number; sy: number }, canvas: StageCanvas): { x: number; y: number } {
  const s = viewBoxScale(canvas);
  return {
    x: (px.sx - canvas.w / 2) / s + VW / 2,
    y: (px.sy - canvas.h / 2) / s + VH / 2,
  };
}

/** Point de PROJECTION (le repère de `tileCenter`/`worldToScreen`) sous un point de viewBox — second
 *  étage de l'inverse : la caméra du groupe défaite, `p = (q − t)/k`. */
export function stagePointAt(
  q: { x: number; y: number },
  cam: { x: number; y: number },
  zoom: number,
): { x: number; y: number } {
  const { k, tx, ty } = stageCamAffine(cam, zoom);
  return { x: (q.x - tx) / k, y: (q.y - ty) / k };
}
