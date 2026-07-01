/**
 * POV — noyau MATHÉMATIQUE PUR d'une caméra première personne (dungeon-crawler pas-à-pas, yaw = Dir8).
 * Zéro React/store/effet : ne connaît que des mètres (monde), des cases (grille) et des pixels (viewport
 * SVG). Le rendu (polygones) et l'assemblage de scène vivent ailleurs (geometry.ts + couche React).
 *
 * Convention MONDE (partagée avec la grille) : +x = est, +y = sud, +z = HAUT (mètres). Une tuile (x,y)
 * a son CENTRE au point métrique (x·mpt, y·mpt) ; sa surface est à `heightAt(scene,x,y,z)` mètres.
 * Repère CAMÉRA : `fwd` (avant, vers l'écran) et `right` (tribord) sont des vecteurs SOL unitaires en
 * unités de GRILLE ; l'axe vertical monde `z` sert d'axe « haut » écran.
 */
import { WALL_H, LEVEL_H } from '../iso';
import { METRES_PER_LEVEL } from '../../state/relief';
import { heightAt, sceneMetresPerTile, type Scene, type WallSeg } from '../../state/scene';
import { DIR8_DELTA, type Dir8 } from '../rig/facing';

// — Constantes de caméra/projection —
/** Hauteur de l'œil au-dessus de la surface où se tient le groupe (mètres). */
export const EYE_H = 1.7;
/** Hauteur métrique d'une cloison d'arête : `WALL_H` px ÷ `LEVEL_H` px × `METRES_PER_LEVEL` m ≈ 2.25 m. */
export const WALL_H_M = (WALL_H / LEVEL_H) * METRES_PER_LEVEL;
/** Champ de vision horizontal (radians ≈ 75°). */
export const FOV_X = (75 * Math.PI) / 180;
/** Plan proche (mètres) — tout ce qui est plus près/derrière est clippé. > 0. */
export const NEAR = 0.1;
/** Portée maximale de rendu (cases). */
export const FAR_TILES = 14;
/** Viewport SVG (px). */
export const VW = 1000;
export const VH = 700;
/** Distance focale px : demi-largeur ÷ tan(demi-FOV) → `fx = fy` (pixels carrés). */
export const fx = VW / 2 / Math.tan(FOV_X / 2);
export const fy = fx;
/** Brouillard : plein clair jusqu'à `FOG_START_T` cases, opaque à `FOG_END_T`. */
export const FOG_START_T = 6;
export const FOG_END_T = FAR_TILES;
export const FOG_COLOR = '#0a0a10';
/** Luminosité plancher (une surface éclairée à 0 n'est jamais totalement noire). */
export const AMBIENT_FLOOR = 0.12;

// — Types —
/** Point métrique monde. */
export type Vec3 = { x: number; y: number; z: number };
/** Pose de caméra : œil (mètres), `fwd`/`right` unitaires SOL (unités grille), `mpt` m/case, `z` = couche. */
export type CamPose = {
  eye: Vec3;
  fwd: { x: number; y: number };
  right: { x: number; y: number };
  mpt: number;
  z: number;
};

/** Construit la pose de caméra depuis la scène, la position du groupe et son cap Dir8. PUR.
 *  eye.z = surface sous le groupe + `EYE_H` ; fwd = delta grille du cap (diagonale /√2) ; right = (−fwd.y, fwd.x)
 *  (cap N (0,−1) → right (1,0) = est). `mpt` = échelle métrique de la case. */
export function makeCamera(scene: Scene, partyPos: { x: number; y: number; z?: number }, facing: Dir8): CamPose {
  const mpt = sceneMetresPerTile(scene);
  const z = partyPos.z ?? 0;
  const d = DIR8_DELTA[facing];
  const len = Math.hypot(d.gx, d.gy) || 1; // diagonale → √2 ; cardinale → 1
  const fwd = { x: d.gx / len, y: d.gy / len };
  const right = { x: -fwd.y, y: fwd.x };
  const eye: Vec3 = {
    x: partyPos.x * mpt,
    y: partyPos.y * mpt,
    z: heightAt(scene, partyPos.x, partyPos.y, z) + EYE_H,
  };
  return { eye, fwd, right, mpt, z };
}

/** Projette un point monde `P` (mètres) en pixels viewport. PUR.
 *  Coord caméra : Xc = d·right (tribord), Zc = d·fwd (profondeur avant), Yc = Δz (haut).
 *  behind = point plus proche que le plan NEAR. sx = centre + fx·Xc/Zc ; sy = centre − fy·Yc/Zc (y écran vers le bas). */
export function project(cam: CamPose, P: Vec3): { sx: number; sy: number; depth: number; behind: boolean } {
  const dx = P.x - cam.eye.x;
  const dy = P.y - cam.eye.y;
  const dz = P.z - cam.eye.z;
  const Xc = dx * cam.right.x + dy * cam.right.y;
  const Zc = dx * cam.fwd.x + dy * cam.fwd.y;
  const Yc = dz;
  const behind = Zc < NEAR;
  return {
    sx: VW / 2 + fx * (Xc / Zc),
    sy: VH / 2 - fy * (Yc / Zc),
    depth: Zc,
    behind,
  };
}

/** Profondeur caméra (Zc = (P−eye)·fwd) d'un point monde. Interne au clip. */
function zc(cam: CamPose, P: Vec3): number {
  return (P.x - cam.eye.x) * cam.fwd.x + (P.y - cam.eye.y) * cam.fwd.y;
}

/** Interpolation monde entre deux points au facteur `t`. */
function lerp3(a: Vec3, b: Vec3, t: number): Vec3 {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: a.z + (b.z - a.z) * t };
}

/** Clip Sutherland-Hodgman d'un polygone CONVEXE (sommets monde en ordre) contre le plan Zc = NEAR.
 *  Les points de traversée sont interpolés EN MONDE (t = (NEAR − Zc_in)/(Zc_out − Zc_in)). Renvoie []
 *  si entièrement derrière. Garantit que tout sommet renvoyé a Zc ≥ NEAR (plus d'inversion de sx). PUR. */
export function clipNear(cornersWorld: Vec3[], cam: CamPose): Vec3[] {
  const n = cornersWorld.length;
  if (n === 0) return [];
  const out: Vec3[] = [];
  for (let i = 0; i < n; i++) {
    const cur = cornersWorld[i];
    const prev = cornersWorld[(i + n - 1) % n];
    const zCur = zc(cam, cur);
    const zPrev = zc(cam, prev);
    const inCur = zCur >= NEAR;
    const inPrev = zPrev >= NEAR;
    if (inCur !== inPrev) {
      // arête traverse le plan → ajoute le point d'intersection
      const t = (NEAR - zPrev) / (zCur - zPrev);
      out.push(lerp3(prev, cur, t));
    }
    if (inCur) out.push(cur);
  }
  return out;
}

/** 4 coins MONDE (mètres) de la tuile (x,y) sur la couche `z`, CCW. `atCeiling` ajoute `WALL_H_M` (plafond). */
export function tileCornersWorld(scene: Scene, x: number, y: number, z: number, atCeiling = false): Vec3[] {
  const mpt = sceneMetresPerTile(scene);
  const h = heightAt(scene, x, y, z) + (atCeiling ? WALL_H_M : 0);
  const x0 = (x - 0.5) * mpt;
  const x1 = (x + 0.5) * mpt;
  const y0 = (y - 0.5) * mpt;
  const y1 = (y + 0.5) * mpt;
  // CCW dans le plan sol (NO, SO, SE, NE) — orientation cohérente pour le clip convexe.
  return [
    { x: x0, y: y0, z: h },
    { x: x0, y: y1, z: h },
    { x: x1, y: y1, z: h },
    { x: x1, y: y0, z: h },
  ];
}

/** 4 coins MONDE (mètres) d'une cloison d'arête (`WallSeg`). Extrémités A,B en coords de tuile selon le
 *  `side` ; h0 = surface porteuse, h1 = h0 + `WALL_H_M`. Ordre : [A@h0, B@h0, B@h1, A@h1] (quad vertical). */
export function wallCornersWorld(scene: Scene, seg: WallSeg): Vec3[] {
  const mpt = sceneMetresPerTile(scene);
  const { x, y } = seg;
  let A: { x: number; y: number };
  let B: { x: number; y: number };
  switch (seg.side) {
    case 'N':
      A = { x: x - 0.5, y: y - 0.5 };
      B = { x: x + 0.5, y: y - 0.5 };
      break;
    case 'E':
      A = { x: x + 0.5, y: y - 0.5 };
      B = { x: x + 0.5, y: y + 0.5 };
      break;
    case '\\':
      A = { x: x - 0.5, y: y - 0.5 };
      B = { x: x + 0.5, y: y + 0.5 };
      break;
    default: // '/'
      A = { x: x + 0.5, y: y - 0.5 };
      B = { x: x - 0.5, y: y + 0.5 };
      break;
  }
  const h0 = heightAt(scene, seg.x, seg.y, seg.z ?? 0);
  const h1 = h0 + WALL_H_M;
  return [
    { x: A.x * mpt, y: A.y * mpt, z: h0 },
    { x: B.x * mpt, y: B.y * mpt, z: h0 },
    { x: B.x * mpt, y: B.y * mpt, z: h1 },
    { x: A.x * mpt, y: A.y * mpt, z: h1 },
  ];
}

/** Vue à présenter d'une entité (sprite paper-doll) selon son cap MONDE vu par la caméra. PUR.
 *  f = e·fwd (aligné avec l'avant caméra), s = e·right (composante latérale) : latéral net → profil,
 *  sinon f<0 (l'entité regarde vers nous) → face, f≥0 (elle nous tourne le dos) → dos. mirror = elle
 *  regarde vers bâbord écran. */
export function povView(
  fwd: { x: number; y: number },
  right: { x: number; y: number },
  entFacing: Dir8,
): { view: 'front' | 'back' | 'profile'; mirror: boolean } {
  const e = DIR8_DELTA[entFacing];
  const f = e.gx * fwd.x + e.gy * fwd.y;
  const s = e.gx * right.x + e.gy * right.y;
  const view = Math.abs(s) > Math.abs(f) * 1.2 ? 'profile' : f < 0 ? 'front' : 'back';
  return { view, mirror: s < 0 };
}

/** clamp scalaire. */
const clamp = (v: number, lo: number, hi: number): number => (v < lo ? lo : v > hi ? hi : v);

/** Teinte une couleur `#rrggbb` par la lumière (min `AMBIENT_FLOOR`) puis fond vers `fogColor` par `fogT`
 *  (défaut `FOG_COLOR` sombre ; le rendu passe une brume claire en extérieur). Renvoie `rgb(r,g,b)`. PUR. */
export function tint(baseHex: string, light: number, fogT: number, fogColor: string = FOG_COLOR): string {
  const l = clamp(light, AMBIENT_FLOOR, 1);
  const t = clamp(fogT, 0, 1);
  const hex = baseHex.replace('#', '');
  const br = parseInt(hex.slice(0, 2), 16);
  const bg = parseInt(hex.slice(2, 4), 16);
  const bb = parseInt(hex.slice(4, 6), 16);
  const fr = parseInt(fogColor.slice(1, 3), 16);
  const fg = parseInt(fogColor.slice(3, 5), 16);
  const fb = parseInt(fogColor.slice(5, 7), 16);
  const mix = (base: number, fog: number): number => {
    const lit = base * l;
    return Math.round(lit + (fog - lit) * t);
  };
  return `rgb(${mix(br, fr)},${mix(bg, fg)},${mix(bb, fb)})`;
}

/** Facteur de brouillard [0..1] à une profondeur (cases) : 0 avant `FOG_START_T`, 1 à `FOG_END_T`. PUR. */
export function fogAt(depthTiles: number): number {
  return clamp((depthTiles - FOG_START_T) / (FOG_END_T - FOG_START_T), 0, 1);
}
