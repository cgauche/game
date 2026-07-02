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
import { WALL_H_M } from '../iso';
import { heightAt, sceneMetresPerTile, type Scene } from '../../state/scene';
import { DIR8_DELTA, type Dir8 } from '../rig/facing';
import { AMBIANCE } from '../catalog/ambiance';

// — Constantes de caméra/projection — (hauteur de cloison : `WALL_H_M`, vérité partagée dans iso.ts)
/** Hauteur de l'œil au-dessus de la surface où se tient le groupe (mètres). */
export const EYE_H = 1.7;
/** Champ de vision horizontal (radians ≈ 75°). */
export const FOV_X = (75 * Math.PI) / 180;
/** Plan proche (mètres) — tout ce qui est plus près/derrière est clippé. > 0. */
export const NEAR = 0.1;
/** Viewport SVG (px). */
export const VW = 1000;
export const VH = 700;
/** Distance focale px : demi-largeur ÷ tan(demi-FOV) → `fx = fy` (pixels carrés). */
export const fx = VW / 2 / Math.tan(FOV_X / 2);
export const fy = fx;

// — Profondeur / brume : tout vient de la DONNÉE (`ambiance.json`, AMBIANCE.pov.depth) —
/** Courbe de brume : claire avant `start` (cases), opaque à `end` (= portée max de rendu),
 *  progression smoothstep^gamma (gamma > 1 = silhouettes lisibles plus loin). */
export interface FogCurve { start: number; end: number; gamma: number }
const DEPTH = AMBIANCE.pov.depth;
/** Courbe de brume du milieu : intérieur = brume sombre COURTE, extérieur = perspective LONGUE. */
export function fogCurveOf(indoor: boolean): FogCurve {
  const d = indoor ? DEPTH.indoor : DEPTH.outdoor;
  return { start: d.fogStartT, end: d.farTiles, gamma: d.fogGamma };
}
/** Portée maximale de rendu (cases) du milieu — la brume atteint 1 exactement là (coupure invisible). */
export function farTilesOf(indoor: boolean): number {
  return (indoor ? DEPTH.indoor : DEPTH.outdoor).farTiles;
}
/** Brume de distance INTÉRIEURE (sombre) — identité en DONNÉE (`ambiance.json`), partagée avec l'iso. */
export const FOG_COLOR = AMBIANCE.pov.fogIndoor;
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

/** Clip d'un SEGMENT monde contre le plan Zc = NEAR (même règle que `clipNear`, pour les POLYLIGNES —
 *  lignes de joints du LOD matériaux). Renvoie null si entièrement derrière. PUR. */
export function clipSegNear(a: Vec3, b: Vec3, cam: CamPose): [Vec3, Vec3] | null {
  const za = zc(cam, a);
  const zb = zc(cam, b);
  if (za < NEAR && zb < NEAR) return null;
  if (za >= NEAR && zb >= NEAR) return [a, b];
  const t = (NEAR - za) / (zb - za);
  const p = lerp3(a, b, t);
  return za >= NEAR ? [a, p] : [p, b];
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

/** Facteur de brume [0..1] à une profondeur (cases) le long d'une `FogCurve` : 0 avant `start`,
 *  1 à `end`, smoothstep élevée à `gamma` entre les deux (perspective ATMOSPHÉRIQUE progressive —
 *  les silhouettes se délavent, pas de mur de brume). PUR. */
export function fogAt(depthTiles: number, curve: FogCurve): number {
  const u = clamp((depthTiles - curve.start) / (curve.end - curve.start), 0, 1);
  const s = u * u * (3 - 2 * u);
  return Math.pow(s, curve.gamma);
}

/** Mélange linéaire de deux couleurs `#rrggbb` (t = part de `b`). PUR — sert aux FONDUS de LOD
 *  (un joint qui s'évanouit se mélange vers la teinte de sa face, pas d'alpha SVG). */
export function mixHex(a: string, b: string, t: number): string {
  const k = clamp(t, 0, 1);
  const ch = (off: number): string => {
    const va = parseInt(a.slice(off, off + 2), 16);
    const vb = parseInt(b.slice(off, off + 2), 16);
    return Math.round(va + (vb - va) * k).toString(16).padStart(2, '0');
  };
  return `#${ch(1)}${ch(3)}${ch(5)}`;
}
