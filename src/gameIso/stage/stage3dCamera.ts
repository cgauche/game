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
import { viewBoxMeetScale, viewBoxScale, type StageCanvas } from './stageCam';

export type { StageCanvas };

/** Ce qu'`affineCamera` attend, dérivé de l'intention du stage. */
export interface Stage3dFraming {
  kind: StageKind;
  /** Lacet en degrés : le cran (`camRot·90`) ou, en lacet CONTINU (#1176, P2-7), l'angle réel de `Dims.yawDeg`. */
  yawDeg: number;
  /** Point MONDE (mètres, repère three : X est, Y haut, Z sud) au centre du cadre — la CIBLE que
   *  l’appelant passe à `affineCamera`. */
  centre: { x: number; y: number; z: number };
  /** Viewport MÉTRIQUE d'`affineCamera` : le cadre en pixels ÷ l'échelle effective. */
  viewport: StageCanvas;
  /** Échelle effective (pixels CSS par unité de viewBox) : zoom du stage × recouvrement du viewBox. */
  scale: number;
}

/**
 * CADRE D'ÉCRAN d'un hôte de stage — tout ce que la caméra volumique a besoin de savoir de la
 * transformation d'écran, et rien de plus : le point de PROJECTION (repère de `worldToScreen`) que
 * l'élément pose en son CENTRE, et l'échelle EFFECTIVE (pixels CSS par unité de projection).
 *
 * DEUX conventions dans le dépôt, toutes deux réduites à ce couple — c'est la généralisation du lot
 * P3-3 (#1176), et le jeu en devient le cas particulier :
 *  - JEU (`IsoStage`) : viewBox FIXE `0 0 VW VH` + `slice`, cadré par une caméra de GROUPE (`cam`,
 *    `zoom`) → `stageScreen` ;
 *  - ÉDITEUR (`ui/editor/EditorCanvas.tsx`) : viewBox MOBILE de taille variable, `meet`, élément à
 *    TAILLE DE CONTENU rétréci par la CSS (`.editor-iso { max-width: 100% }`) → `viewBoxScreen`,
 *    dont l'échelle se prend sur le RENDU (le cadre en pixels mesuré), jamais sur le zoom seul.
 */
export interface StageScreen {
  /** Point de PROJECTION au centre de l'élément. */
  centre: { x: number; y: number };
  /** Pixels CSS par unité de projection. */
  scale: number;
}

/** Convention du JEU : caméra de groupe sur viewBox FIXE recouvrant l'élément (`slice`). `cam` est la
 *  translation caméra d'`IsoStage` (unités de viewBox), `zoom` son facteur d'échelle APPLIQUÉ
 *  (transition de cran comprise). */
export function stageScreen(cam: { x: number; y: number }, zoom: number, canvas: StageCanvas): StageScreen {
  return { centre: { x: VW / 2 - cam.x, y: VH / 2 - cam.y }, scale: zoom * viewBoxScale(canvas) };
}

/** Convention du VIEWBOX MOBILE : le rectangle rendu EST le viewBox, centré (`xMidYMid`), à l'échelle
 *  `meet`. `canvas` est le cadre MESURÉ du rendu (`clientWidth`/`clientHeight`) — c'est lui, et non le
 *  zoom, qui porte le rétrécissement CSS de l'élément. */
export function viewBoxScreen(viewBox: { x: number; y: number; w: number; h: number }, canvas: StageCanvas): StageScreen {
  return {
    centre: { x: viewBox.x + viewBox.w / 2, y: viewBox.y + viewBox.h / 2 },
    scale: viewBoxMeetScale(viewBox, canvas),
  };
}

/** Traduction d'un cadre d'écran (l'une ou l'autre convention) en cadrage de caméra volumique. */
export function stage3dFramingFor(args: { dims: Dims; mpt: number; screen: StageScreen; canvas: StageCanvas }): Stage3dFraming {
  const pose = poseFromDims(args.dims);
  const { scale } = args.screen;
  const tuile = screenToWorldAtLift(pose, args.screen.centre, 0);
  return {
    kind: pose.kind,
    yawDeg: pose.yawDeg,
    centre: { x: tuile.x * args.mpt, y: 0, z: tuile.y * args.mpt },
    viewport: { w: args.canvas.w / scale, h: args.canvas.h / scale },
    scale,
  };
}

/** Traduction de l'intention du stage DE JEU en cadrage de caméra volumique — le cas particulier
 *  `stageScreen` du cadre généralisé ci-dessus. */
export function stage3dFraming(args: {
  dims: Dims;
  /** Mètres par tuile de la scène (`sceneMetresPerTile`). */
  mpt: number;
  cam: { x: number; y: number };
  zoom: number;
  canvas: StageCanvas;
}): Stage3dFraming {
  return stage3dFramingFor({
    dims: args.dims,
    mpt: args.mpt,
    screen: stageScreen(args.cam, args.zoom, args.canvas),
    canvas: args.canvas,
  });
}
