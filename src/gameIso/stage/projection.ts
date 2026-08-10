/**
 * PROJECTION DU STAGE — source UNIQUE des conversions monde↔écran, paramétrée par un lacet RÉEL
 * (degrés) dont les quatre crans de production (`Dims.rot`) sont les cas particuliers EXACTS.
 *
 * Module PUR : aucun import de `three` (garde `projection.test.ts`), aucun DOM, aucun store — il doit
 * rester consommable par le picking (`useStagePointer`) et par les overlays SVG sans tirer le moteur
 * volumique. Il ne dépend que de la géométrie de `geometry/iso.ts`, dont il généralise `tileCenter` /
 * `screenToTileAtZ` : à pose crantée, les deux chemins rendent le même pixel (mesuré à 1e-6 px).
 *
 * Forme affine, dérivée des deux références qu'elle réconcilie (`geometry/iso.ts` : `Dims`/`effDims`/
 * `originX` — `backends/webgl/cameras.ts` : `affineCamera`, dont le JSDoc note que l'ancrage écran
 * `originX`/`originY` face au couple `target`/`zoom` « n'existe que dans le test ») :
 *
 *   écran = origin + Proj( R(yaw) · (monde − pivot) ) − lift·LEVEL_H
 *
 * `R(yaw)` tourne la GRILLE dans le plan écran autour du pivot (un quart de tour y est appliqué en
 * entier, sans résidu de trigonométrie) ; `Proj` est la cadence de la vue — losange `TW/2`×`TH/2`,
 * « de face » `EDGE_W`×`EDGE_H`, dessus `CELL`×`CELL`. L'élévation est un décalage écran vertical pur
 * (la vue du dessus regarde à la verticale : elle n'en décale rien).
 *
 * PORTÉE (#1176, plan de Phase 2 au commentaire du ticket) : ce module EST le livrable du lot P2-0,
 * avec ses preuves d'égalité. Ses consommateurs de production — caméra de stage, picking, overlays —
 * sont le périmètre des lots P2-2 / P2-3 / P2-7, qui portent leur migration.
 */
import {
  CELL,
  EDGE_H,
  EDGE_W,
  LEVEL_H,
  TH,
  TW,
  isSquareView,
  tileCenter,
  type Dims,
} from '../../geometry/iso';

/** Vue projetée : losange 2.5D, « de face » (edge-on, 3D conservée), ou dessus plat. Mêmes trois
 *  familles que `AffineKind` (`backends/webgl/cameras.ts`), exprimées ici sans `three`. */
export type StageKind = 'iso' | 'edge' | 'top';

/** Pose de la caméra de stage : la vue, son lacet RÉEL en degrés, le PIVOT de grille autour duquel ce
 *  lacet tourne, et le point ÉCRAN où ce pivot atterrit (l'ANCRAGE — ce que l'affine tient par
 *  `originX`/`originY` et la caméra volumique par `target`). */
export interface StagePose {
  kind: StageKind;
  /** Lacet en degrés ; `rot·90` reproduit exactement le cran `rot` de `Dims`. */
  yawDeg: number;
  /** Case-pivot de la rotation, en grille CONTINUE. */
  pivot: { x: number; y: number };
  /** Pixel du pivot à l'écran. */
  origin: { x: number; y: number };
}

/** Point de GRILLE CONTINUE : `x`/`y` en tuiles, `lift` en NIVEAUX d'étage — la même unité que le `z`
 *  de `tileCenter`/`screenToTileAtZ`, celle que rend `metricToLift` (`state/relief.ts`). */
export interface StageWorld {
  x: number;
  y: number;
  lift?: number;
}

export interface StageScreen {
  x: number;
  y: number;
}

/** Cadence écran d'une vue AXIS-ALIGNÉE (dessus, « de face ») ; `null` en losange, dont la projection
 *  est diagonale. Même partage que `axisStep` de `geometry/iso.ts`. */
function stageStep(kind: StageKind): { sx: number; sy: number } | null {
  if (kind === 'top') return { sx: CELL, sy: CELL };
  if (kind === 'edge') return { sx: EDGE_W, sy: EDGE_H };
  return null;
}

/** Rotation d'un offset de grille par le lacet. Un multiple de 90° emprunte le quart de tour ENTIER
 *  (aucun résidu de trigonométrie : les crans restent au pixel de `tileCenter`) — même politique que
 *  `rightTiles` (`backends/webgl/cameras.ts`). */
function rotOffset(yawDeg: number, d: { x: number; y: number }): { x: number; y: number } {
  const quarts = yawDeg / 90;
  if (Number.isInteger(quarts)) {
    let v = d;
    for (let i = 0, n = ((quarts % 4) + 4) % 4; i < n; i++) v = { x: v.y, y: -v.x };
    return v;
  }
  const a = (yawDeg * Math.PI) / 180;
  const cos = Math.cos(a);
  const sin = Math.sin(a);
  return { x: d.x * cos + d.y * sin, y: -d.x * sin + d.y * cos };
}

/** Vue de la pose correspondant à des dimensions de carte. */
export function stageKindOf(dims: Dims): StageKind {
  if (isSquareView(dims.view)) return 'top';
  return dims.edge ? 'edge' : 'iso';
}

/** Pose CRANTÉE d'une carte : le cas particulier de `Dims`. Le pivot est le centre de la grille, dont
 *  `rotTile` est le point fixe aux quatre crans — son ancrage écran se lit donc directement dans
 *  `tileCenter`, ce qui fait de cette pose l'exact équivalent de `dims` (cf. `projection.test.ts`). */
export function poseFromDims(dims: Dims): StagePose {
  const pivot = { x: (dims.w - 1) / 2, y: (dims.h - 1) / 2 };
  const { cx, cy } = tileCenter(pivot.x, pivot.y, dims, 0);
  return {
    kind: stageKindOf(dims),
    yawDeg: (dims.rot ?? 0) * 90,
    pivot,
    origin: { x: cx, y: cy },
  };
}

/** Grille continue → pixel écran. Généralise `tileCenter` à un lacet réel. */
export function worldToScreen(pose: StagePose, world: StageWorld): StageScreen {
  const p = rotOffset(pose.yawDeg, { x: world.x - pose.pivot.x, y: world.y - pose.pivot.y });
  const step = stageStep(pose.kind);
  const dx = step ? p.x * step.sx : (p.x - p.y) * (TW / 2);
  const dy = step ? p.y * step.sy : (p.x + p.y) * (TH / 2);
  return { x: pose.origin.x + dx, y: pose.origin.y + dy - liftPx(pose, world.lift ?? 0) };
}

/** Pixel écran → grille continue AU NIVEAU `lift` donné (niveaux d'étage, cf. `StageWorld`). Inverse
 *  exact de `worldToScreen` ; généralise `screenToTileF`/`screenToTileAtZ`, dont le picking
 *  multi-hypothèses itère les lifts.
 *  DÉGÉNÉRESCENCE EN VUE DU DESSUS : `liftPx` y est nul (l'élévation ne décale rien à l'écran, la
 *  projection est verticale) → tous les lifts rendent la MÊME case. Itérer les hypothèses d'étage n'y
 *  départage donc rien : en `top`, l'étage se résout AUTREMENT (couche active, occupation de la case),
 *  pas par la projection. */
export function screenToWorldAtLift(pose: StagePose, screen: StageScreen, lift = 0): { x: number; y: number } {
  const dx = screen.x - pose.origin.x;
  const dy = screen.y - pose.origin.y + liftPx(pose, lift);
  const step = stageStep(pose.kind);
  const p = step
    ? { x: dx / step.sx, y: dy / step.sy }
    : (() => {
      const a = dx / (TW / 2);
      const b = dy / (TH / 2);
      return { x: (a + b) / 2, y: (b - a) / 2 };
    })();
  const d = rotOffset(-pose.yawDeg, p);
  return { x: d.x + pose.pivot.x, y: d.y + pose.pivot.y };
}

/** Décalage écran vertical d'une élévation : `LEVEL_H` px par niveau, nul en vue du dessus (une caméra
 *  à la verticale ne sépare pas les étages à l'écran — cf. `screenToWorldAtLift`). */
function liftPx(pose: StagePose, lift: number): number {
  return pose.kind === 'top' ? 0 : lift * LEVEL_H;
}
