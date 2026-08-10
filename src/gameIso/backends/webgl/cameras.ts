/**
 * SPIKE WebGL — CAMÉRAS : les vues de PRODUCTION (iso losange, edge-on, vue du dessus, POV première
 * personne) reproduites en caméras three, la géométrie restant MÉTRIQUE (aucun étirement des sommets :
 * les normales du mode éclairé doivent rester justes). Le lacet des vues ortho est un RÉEL en degrés :
 * les crans de production (0/90/180/270°, cf. `rotYaw`) en sont les cas particuliers EXACTS.
 *
 * La projection affine de `geometry/iso.ts` n'est PAS une orthographique uniforme : elle mesure la
 * PROFONDEUR SOL à `TH/TW` de l'échelle horizontale (losange 2:1) et la HAUTEUR à `ISO_PX_PER_M`
 * (`worldTris.ts`) px/m — deux cadences indépendantes. Une ortho ne peut les tenir toutes deux qu'avec
 * un pitch DÉRIVÉ de leur rapport et un étirement vertical de la MATRICE DE PROJECTION :
 *   pitch   = atan2(sx·TH/TW, ISO_PX_PER_M)
 *   sy      = hypot(sx·TH/TW, ISO_PX_PER_M)     (px/m le long de l'axe écran vertical)
 *   stretch = sy / sx                            (prémultiplié : scale(1, stretch, 1))
 * avec sx = `pxPerM(mpt)`. Le pitch iso « uniforme » asin(TH/TW) = 30° n'est le bon que si sy = sx, ce
 * qui n'arrive qu'à une échelle métrique précise — cf. `cameras.test.ts` (mesure à 1e-6 px près).
 *
 * Node-safe : `three` est du JS pur (aucun DOM à l'import), aucun renderer n'est créé ici.
 */
import { Box3, Matrix4, OrthographicCamera, PerspectiveCamera, Vector3 } from 'three';
import { CELL, TH, TW, type Rot } from '../../../geometry/iso';
import type { Scene } from '../../../state/scene';
import type { Dir8 } from '../../../state/dir8';
import { FOV_X, NEAR, makeCamera } from '../../pov/camera';
import { pxPerM } from './worldTris';
import { ISO_PX_PER_M } from '../../iso';

/** Viewport en pixels — le cadre dans lequel la projection est comparable à l'affine. */
export interface Viewport {
  w: number;
  h: number;
}

/** Vues affines de production : losange, « de face » (edge-on), dessus. */
export type AffineKind = 'iso' | 'edge' | 'top';

/** Ortho de l'affine : l'ANISOTROPIE fait partie de la CAMÉRA, pas d'un post-traitement. three
 *  reconstruit `projectionMatrix` à chaque `updateProjectionMatrix()` (redimensionnement, zoom,
 *  helpers…) : une prémultiplication faite une seule fois à la construction est effacée au premier
 *  appel — mesuré sur la grille de `cameras.test.ts` : l'écart passait de 4,5e-13 à 174,28 px après un
 *  seul appel. La ré-application vit donc
 *  DANS la caméra. */
export class StretchedOrthographicCamera extends OrthographicCamera {
  /** Anisotropie `sy / sx` (cf. `affineScales`). */
  stretch = 1;

  override updateProjectionMatrix(): void {
    super.updateProjectionMatrix();
    // Le constructeur de three appelle CE code avant l'initialisation du champ : repli à 1.
    const k = this.stretch || 1;
    this.projectionMatrix.premultiply(new Matrix4().makeScale(1, k, 1));
    this.projectionMatrixInverse.copy(this.projectionMatrix).invert();
  }
}

/** Caméra affine prête à projeter + les grandeurs dont elle est dérivée. */
export interface AffineCam {
  camera: StretchedOrthographicCamera;
  /** px/m horizontal (axe écran X). */
  sx: number;
  /** px/m vertical (axe écran Y). */
  sy: number;
  /** Inclinaison sous l'horizon (radians). */
  pitch: number;
  /** Anisotropie de la matrice de projection : `sy / sx`. */
  stretch: number;
}

/** Échelles ÉCRAN d'une vue affine, dérivées de `TW`/`TH`/`ISO_PX_PER_M` et de l'échelle métrique de la
 *  scène. La vue du DESSUS regarde à la verticale : cadence unique `CELL` px/tuile. */
export function affineScales(kind: AffineKind, mpt: number): { sx: number; sy: number; pitch: number; stretch: number } {
  if (kind === 'top') {
    const s = CELL / mpt;
    return { sx: s, sy: s, pitch: Math.PI / 2, stretch: 1 };
  }
  const sx = pxPerM(mpt);
  const ground = sx * (TH / TW); // px/m de PROFONDEUR au sol
  const sy = Math.hypot(ground, ISO_PX_PER_M);
  return { sx, sy, pitch: Math.atan2(ground, ISO_PX_PER_M), stretch: sy / sx };
}

/** Lacet (degrés) d'un cran de rotation de production : un cran = un quart de tour. */
export function rotYaw(rot: Rot): number {
  return rot * 90;
}

/** Direction ÉCRAN-DROITE, en tuiles, de la vue `kind` au lacet `yawDeg`. L'iso pointe la diagonale
 *  (x−y), l'edge-on l'axe x (le losange tourné de 45°). Un multiple de 90° emprunte la rotation ENTIÈRE
 *  (quart de tour exact, aucun résidu de trigonométrie) : les crans restent au pixel de l'affine. */
function rightTiles(kind: AffineKind, yawDeg: number): { x: number; y: number } {
  const base = kind === 'iso' ? { x: Math.SQRT1_2, y: -Math.SQRT1_2 } : { x: 1, y: 0 };
  const quarts = yawDeg / 90;
  if (Number.isInteger(quarts)) {
    let v = base;
    for (let i = 0, n = ((quarts % 4) + 4) % 4; i < n; i++) v = { x: -v.y, y: v.x };
    return v;
  }
  const a = (yawDeg * Math.PI) / 180;
  const cos = Math.cos(a);
  const sin = Math.sin(a);
  return { x: base.x * cos - base.y * sin, y: base.x * sin + base.y * cos };
}

/** Marge (m) ajoutée de part et d'autre de la sphère englobante dans les bornes de profondeur. */
export const DEPTH_MARGIN_M = 1;

/** Bornes near/far d'une ortho placée à `distance` du centre d'une scène de rayon `radius` : le buffer
 *  de profondeur ne couvre QUE la scène. Un far généreux (4001 m pour une scène de ~100 m) quantifie la
 *  profondeur au point que la séparation coplanaire (`COPLANAR_BIAS_M` = 1,5 mm) n'y survit que par
 *  chance. */
export function orthoDepthRange(distance: number, radius: number): { near: number; far: number } {
  return {
    near: Math.max(0.01, distance - radius - DEPTH_MARGIN_M),
    far: distance + radius + DEPTH_MARGIN_M,
  };
}

/** Caméra orthographique d'une vue affine, au lacet `yawDeg` (réel ; `rotYaw(rot)` pour un cran de
 *  production). `target` = point monde au centre du viewport (l'ANCRAGE : l'affine a le sien,
 *  `originX`/`originY` — les deux se comparent à ancrage commun) ; `radius` = rayon englobant de la
 *  scène, qui resserre near/far (défaut : `distance`, soit la portée large d'une scène inconnue). */
export function affineCamera(
  kind: AffineKind,
  yawDeg: number,
  mpt: number,
  viewport: Viewport,
  opts: { target?: Vector3; distance?: number; radius?: number } = {},
): AffineCam {
  const { sx, sy, pitch, stretch } = affineScales(kind, mpt);
  const target = opts.target ?? new Vector3(0, 0, 0);
  const distance = opts.distance ?? 2000;
  const { near, far } = orthoDepthRange(distance, opts.radius ?? distance);

  // Repère écran : `right` horizontal, `fwd` = −rot90(right) (la case la plus « avant » est la plus basse).
  const r = rightTiles(kind, yawDeg);
  const fwd = { x: r.y, y: -r.x };
  const forward = new Vector3(fwd.x * Math.cos(pitch), -Math.sin(pitch), fwd.y * Math.cos(pitch));
  const up = new Vector3(fwd.x * Math.sin(pitch), Math.cos(pitch), fwd.y * Math.sin(pitch));

  const halfW = viewport.w / (2 * sx);
  const halfH = viewport.h / (2 * sx); // cadence HORIZONTALE : l'anisotropie vit dans `stretch`
  const camera = new StretchedOrthographicCamera(-halfW, halfW, halfH, -halfH, near, far);
  camera.stretch = stretch;
  camera.position.copy(target).addScaledVector(forward, -distance);
  camera.up.copy(up);
  camera.lookAt(target);
  camera.updateMatrixWorld(true);
  camera.updateProjectionMatrix();

  return { camera, sx, sy, pitch, stretch };
}

/** Part du cadre que la boîte de contenu occupe une fois cadrée : le reste est la marge. */
export const FIT_FILL = 0.86;

/** CADRAGE d'une vue affine sur une boîte de contenu : le couple `{ target, zoom }` qui met cette boîte
 *  au centre du cadre et lui fait occuper `fill` de sa dimension la plus contrainte. C'est un choix
 *  d'ÉCRAN, jamais une propriété de la caméra : `affineCamera` garde son échelle de production
 *  (`CELL/mpt` en vue du dessus), et le `zoom` rendu n'agit que par le viewport que l'appelant lui
 *  passe — la coïncidence pixel avec la projection SVG en sort intacte (`cameras.test.ts`).
 *
 *  La projection affine étant LINÉAIRE, l'étendue écran de la boîte est proportionnelle au zoom : la
 *  mesurer une fois à zoom 1 suffit. Le recentrage se fait en MÈTRES sur les axes écran de la caméra
 *  (px/m horizontal `sx`, vertical `sy`) — le centre de la boîte PROJETÉE n'est pas la projection du
 *  centre de la boîte dès que la vue n'est pas alignée sur ses arêtes. */
export function fitAffineView(
  kind: AffineKind,
  yawDeg: number,
  mpt: number,
  box: Box3,
  viewport: Viewport,
  fill: number = FIT_FILL,
): { target: Vector3; zoom: number } {
  const centre = box.getCenter(new Vector3());
  const { camera, sx, sy } = affineCamera(kind, yawDeg, mpt, viewport, { target: centre });
  let loX = Infinity, hiX = -Infinity, loY = Infinity, hiY = -Infinity;
  for (const x of [box.min.x, box.max.x])
    for (const y of [box.min.y, box.max.y])
      for (const z of [box.min.z, box.max.z]) {
        const p = projectToScreen(camera, new Vector3(x, y, z), viewport);
        loX = Math.min(loX, p.sx); hiX = Math.max(hiX, p.sx);
        loY = Math.min(loY, p.sy); hiY = Math.max(hiY, p.sy);
      }
  const largeur = Math.max(hiX - loX, 1e-6);
  const hauteur = Math.max(hiY - loY, 1e-6);
  const zoom = fill * Math.min(viewport.w / largeur, viewport.h / hauteur);
  const dx = (loX + hiX) / 2 - viewport.w / 2;
  const dy = (loY + hiY) / 2 - viewport.h / 2;
  const droite = new Vector3().setFromMatrixColumn(camera.matrixWorld, 0);
  const haut = new Vector3().setFromMatrixColumn(camera.matrixWorld, 1);
  return { target: centre.clone().addScaledVector(droite, dx / sx).addScaledVector(haut, -dy / sy), zoom };
}

/** Caméra PERSPECTIVE du POV : œil et cap depuis la SEULE source de pose première personne
 *  (`pov/camera.ts` — `makeCamera`, œil à `heightAt(...) + EYE_H`). Le FOV vertical est dérivé du FOV
 *  HORIZONTAL `FOV_X` et du viewport, pour des pixels carrés (mêmes `fx`/`fy` que `pov/camera.ts`). */
export function povCamera(
  scene: Scene,
  partyPos: { x: number; y: number; z?: number },
  facing: Dir8,
  viewport: Viewport,
  far = 4000,
): PerspectiveCamera {
  const pose = makeCamera(scene, partyPos, facing);
  const fovY = 2 * Math.atan((viewport.h / viewport.w) * Math.tan(FOV_X / 2));
  const camera = new PerspectiveCamera((fovY * 180) / Math.PI, viewport.w / viewport.h, NEAR, far);
  // Monde POV : (x, y) métriques au sol + z vertical → repère three Y-haut.
  camera.position.set(pose.eye.x, pose.eye.z, pose.eye.y);
  camera.up.set(0, 1, 0);
  camera.lookAt(pose.eye.x + pose.fwd.x, pose.eye.z, pose.eye.y + pose.fwd.y);
  camera.updateMatrixWorld(true);
  camera.updateProjectionMatrix();
  return camera;
}

/** Point monde → pixel du viewport (origine coin haut-gauche, y vers le BAS comme le SVG). */
export function projectToScreen(
  camera: OrthographicCamera | PerspectiveCamera,
  worldPt: Vector3,
  viewport: Viewport,
): { sx: number; sy: number } {
  const ndc = worldPt.clone().project(camera);
  return { sx: ((ndc.x + 1) / 2) * viewport.w, sy: ((1 - ndc.y) / 2) * viewport.h };
}
