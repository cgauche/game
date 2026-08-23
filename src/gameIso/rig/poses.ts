import type { BoneId } from './bones';

/**
 * TRANSFORMATION d'un os — le vocabulaire des moteurs 2D à squelette (cutout) : un os se ROTATE, se
 * TRANSLATE et se met à l'ÉCHELLE, et ces trois canaux sont HÉRITÉS par sa chaîne d'enfants (la
 * composition se fait dans la matrice locale, `kinematics.ts`).
 *
 * - `r` : delta d'angle (degrés) sur l'angle de repos de l'os ;
 * - `tx`/`ty` : décalage du pivot dans le repère du PARENT (unités de la boîte de corps 120×150) ;
 * - `sx`/`sy` : facteurs d'échelle de l'os — `sy` porte le RACCOURCI (foreshortening) d'un membre
 *   qui pointe hors du plan de l'écran, ce qu'une rotation 2D ne sait pas dire.
 *
 * Champ absent = neutre (0 pour `r`/`tx`/`ty`, 1 pour `sx`/`sy`).
 */
export interface BoneXf {
  r?: number;
  tx?: number;
  ty?: number;
  sx?: number;
  sy?: number;
}

/** Override par os. `number` = raccourci de ROTATION seule (équivaut à `{ r: n }`). */
export type Pose = Partial<Record<BoneId, number | BoneXf>>;

/** Pose keyée par les os d'un gabarit QUELCONQUE (quadrupède, ailé, engin, navire…). */
export type BonePose<K extends string = string> = Partial<Record<K, number | BoneXf>>;

/** Transformation NEUTRE — aucun canal ne bouge. */
export const XF_NEUTRE: Required<BoneXf> = { r: 0, tx: 0, ty: 0, sx: 1, sy: 1 };

/** Pose de repos : aucun override (les angles au repos du squelette s'appliquent). */
export const POSE_REPOS: Pose = {};

/** Transformation NORMALISÉE d'un os dans une pose — la lecture UNIQUE d'un os posé. */
export function xfOf<K extends string>(pose: BonePose<K>, id: K): Required<BoneXf> {
  const v = pose[id];
  if (v === undefined) return XF_NEUTRE;
  if (typeof v === 'number') return { r: v, tx: 0, ty: 0, sx: 1, sy: 1 };
  return { r: v.r ?? 0, tx: v.tx ?? 0, ty: v.ty ?? 0, sx: v.sx ?? 1, sy: v.sy ?? 1 };
}

/** ROTATION d'un os dans une pose — la lecture UNIQUE d'un angle, pour les corps qui ne consomment
 *  que ce canal (gabarits à os unique : bascule d'engin, roulis de coque, cahot de chariot). */
export function rotOf<K extends string>(pose: BonePose<K>, id: K): number {
  const v = pose[id];
  return typeof v === 'number' ? v : v?.r ?? 0;
}

/** Forme COMPACTE d'une transformation : une rotation seule redevient un `number`, si bien qu'une
 *  composition de poses d'ANGLES reste une pose d'angles (les littéraux du dépôt gardent leur forme,
 *  et les comparaisons de poses aussi). */
function compact(x: Required<BoneXf>): number | BoneXf {
  return x.tx === 0 && x.ty === 0 && x.sx === 1 && x.sy === 1 ? x.r : x;
}

/** Union des os de deux poses. */
function osDe<K extends string>(a: BonePose<K>, b: BonePose<K>): K[] {
  return [...new Set([...Object.keys(a), ...Object.keys(b)])] as K[];
}

/** Somme de deux poses : rotations et translations s'ADDITIONNENT, les échelles se MULTIPLIENT
 *  (composer deux fois « moitié » donne le quart, pas zéro). Sert à composer pose de vue + carry +
 *  clip. PUR. */
export function addPose<K extends string>(a: BonePose<K>, b: BonePose<K>): BonePose<K>;
export function addPose(a: Pose, b: Pose): Pose;
export function addPose<K extends string>(a: BonePose<K>, b: BonePose<K>): BonePose<K> {
  const out: BonePose<K> = { ...a };
  for (const k of Object.keys(b) as K[]) {
    const x = xfOf(a, k);
    const y = xfOf(b, k);
    out[k] = compact({ r: x.r + y.r, tx: x.tx + y.tx, ty: x.ty + y.ty, sx: x.sx * y.sx, sy: x.sy * y.sy });
  }
  return out;
}

/** Interpolation de deux poses (union des os, os absent = transformation neutre) : SOURCE UNIQUE du
 *  fondu de poses — clips d'animation, effondrement au sol, affaissement d'un gabarit. PUR. */
export function lerpPose<K extends string>(from: BonePose<K>, to: BonePose<K>, t: number): BonePose<K>;
export function lerpPose(from: Pose, to: Pose, t: number): Pose;
export function lerpPose<K extends string>(from: BonePose<K>, to: BonePose<K>, t: number): BonePose<K> {
  const out: BonePose<K> = {};
  for (const k of osDe(from, to)) {
    const a = xfOf(from, k);
    const b = xfOf(to, k);
    out[k] = compact({
      r: a.r + (b.r - a.r) * t,
      tx: a.tx + (b.tx - a.tx) * t,
      ty: a.ty + (b.ty - a.ty) * t,
      sx: a.sx + (b.sx - a.sx) * t,
      sy: a.sy + (b.sy - a.sy) * t,
    });
  }
  return out;
}

/** Pose ATTÉNUÉE au facteur `k` : interpolée depuis le REPOS (`k=0` = repos, `k=1` = la pose telle
 *  quelle) — les échelles y reviennent vers 1, jamais vers 0. PUR. */
export function scalePose<K extends string>(p: BonePose<K>, k: number): BonePose<K>;
export function scalePose(p: Pose, k: number): Pose;
export function scalePose<K extends string>(p: BonePose<K>, k: number): BonePose<K> {
  return lerpPose({} as BonePose<K>, p, k);
}
