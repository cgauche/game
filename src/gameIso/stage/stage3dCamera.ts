/**
 * CÂBLAGE de la caméra volumique sur l'INTENTION du stage (#1176, lot P2-2) : le store (cran de
 * rotation, edge-on, projection, zoom, décalage manuel) décide, `GameStage3D` consomme. Module PUR,
 * sans `three` ni DOM — il ne fait que traduire la transformation d'écran du stage SVG en couple
 * `{ cible monde, viewport métrique }`, la forme d'entrée d'`affineCamera` (`backends/webgl/cameras.ts`).
 *
 * La chaîne de l'iso, pour un point de grille `p` projeté par `worldToScreen` (`stage/projection.ts`) :
 *   viewBox : q = (p + cam − C)·k + C           (`IsoStage` : translate/scale/translate + translate(cam))
 *   élément : px = (q − C)·s + centre           (`viewBox 0 0 VW VH`, `preserveAspectRatio="xMidYMid slice"`)
 * soit px = (p + cam − C)·k·s + centre : le pixel du centre de l'élément est celui du point d'écran
 * `C − cam`, et l'échelle vaut `k·s` fois celle de la projection nue. D'où les deux seules grandeurs
 * que la caméra volumique a besoin de recevoir :
 *  - la CIBLE : le point monde que la projection SVG pose au centre — `affineCamera` y met le sien ;
 *  - le VIEWPORT MÉTRIQUE : le cadre en pixels DIVISÉ par `k·s`, seul levier d'échelle d'une ortho dont
 *    la cadence px/m (`pxPerM`) est celle de la production.
 */
import type { Dims } from '../../geometry/iso';
import { poseFromDims, screenToWorldAtLift, type StageKind } from './projection';
import { VH, VW } from './useStageCamera';
import { viewBoxScale, type StageCanvas } from './stageCam';

export type { StageCanvas };

/** Ce qu'`affineCamera` attend, dérivé de l'intention du stage. */
export interface Stage3dFraming {
  kind: StageKind;
  /** Lacet en degrés — `camRot·90`. */
  yawDeg: number;
  /** Point MONDE (mètres, repère three : X est, Y haut, Z sud) au centre du cadre — la CIBLE que
   *  l’appelant passe à `affineCamera`. */
  centre: { x: number; y: number; z: number };
  /** Viewport MÉTRIQUE d'`affineCamera` : le cadre en pixels ÷ l'échelle effective. */
  viewport: StageCanvas;
  /** Échelle effective (pixels CSS par unité de viewBox) : zoom du stage × recouvrement du viewBox. */
  scale: number;
}

/** Traduction de l'intention du stage en cadrage de caméra volumique. `cam` est la translation caméra
 *  d'`IsoStage` (unités de viewBox), `zoom` son facteur d'échelle APPLIQUÉ (transition de cran comprise). */
export function stage3dFraming(args: {
  dims: Dims;
  /** Mètres par tuile de la scène (`sceneMetresPerTile`). */
  mpt: number;
  cam: { x: number; y: number };
  zoom: number;
  canvas: StageCanvas;
}): Stage3dFraming {
  const pose = poseFromDims(args.dims);
  const scale = args.zoom * viewBoxScale(args.canvas);
  const tuile = screenToWorldAtLift(pose, { x: VW / 2 - args.cam.x, y: VH / 2 - args.cam.y }, 0);
  return {
    kind: pose.kind,
    yawDeg: pose.yawDeg,
    centre: { x: tuile.x * args.mpt, y: 0, z: tuile.y * args.mpt },
    viewport: { w: args.canvas.w / scale, h: args.canvas.h / scale },
    scale,
  };
}
