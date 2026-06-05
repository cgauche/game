import type { BoneId, Skeleton } from './bones';
import type { Pose } from './poses';

/** Matrice affine SVG : [a,b,c,d,e,f] → x'=ax+cy+e, y'=bx+dy+f. */
export type Matrix = [number, number, number, number, number, number];

export const identity = (): Matrix => [1, 0, 0, 1, 0, 0];
export const translate = (x: number, y: number): Matrix => [1, 0, 0, 1, x, y];
export function rotate(deg: number): Matrix {
  const r = (deg * Math.PI) / 180, c = Math.cos(r), s = Math.sin(r);
  return [c, s, -s, c, 0, 0];
}
/** Compose A∘B (applique B puis A). */
export function mul(A: Matrix, B: Matrix): Matrix {
  return [
    A[0] * B[0] + A[2] * B[1],
    A[1] * B[0] + A[3] * B[1],
    A[0] * B[2] + A[2] * B[3],
    A[1] * B[2] + A[3] * B[3],
    A[0] * B[4] + A[2] * B[5] + A[4],
    A[1] * B[4] + A[3] * B[5] + A[5],
  ];
}
export function apply(m: Matrix, p: { x: number; y: number }) {
  return { x: m[0] * p.x + m[2] * p.y + m[4], y: m[1] * p.x + m[3] * p.y + m[5] };
}
export const toSvg = (m: Matrix): string => `matrix(${m.map((n) => +n.toFixed(4)).join(' ')})`;

/**
 * Os minimal pour la FK — INDÉPENDANT du gabarit (bipède/quadrupède/ailé). La cinématique
 * n'a besoin que de la hiérarchie + pivot + angle ; la liste d'os concrète appartient au
 * gabarit. C'est cette généricité qui permet « une seule machinerie, plusieurs squelettes ».
 */
export interface FKBone {
  parent: string | null;
  pivot: { x: number; y: number };
  angle: number;
}

/**
 * Transform monde de chaque os (FK, racine = os sans parent), pour TOUT squelette keyé par
 * chaîne. `pose` = deltas d'angle additifs. Générique sur la liste d'os du gabarit.
 */
export function worldTransformsG<K extends string>(
  sk: Record<K, FKBone>,
  pose: Partial<Record<K, number>>,
): Record<K, Matrix> {
  const out = {} as Record<K, Matrix>;
  const world = (id: K): Matrix => {
    if (out[id]) return out[id];
    const b = sk[id];
    const ang = b.angle + (pose[id] ?? 0); // pose = DELTA additif sur l'angle de repos
    const local = mul(translate(b.pivot.x, b.pivot.y), rotate(ang));
    out[id] = b.parent ? mul(world(b.parent as K), local) : local;
    return out[id];
  };
  for (const id of Object.keys(sk) as K[]) world(id);
  return out;
}

/** Transform monde de chaque os du squelette HUMANOÏDE (délègue à la FK générique). */
export function worldTransforms(sk: Skeleton, pose: Pose): Record<BoneId, Matrix> {
  return worldTransformsG(sk as Record<BoneId, FKBone>, pose) as Record<BoneId, Matrix>;
}
