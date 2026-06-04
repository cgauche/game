import type { BoneId } from './bones';

/** Override d'angles d'os (degrés). Cible des animations (C) et postures (D). */
export type Pose = Partial<Record<BoneId, number>>;

/** Pose de repos : aucun override (les angles au repos du squelette s'appliquent). */
export const POSE_REPOS: Pose = {};

/** Somme de deux poses (deltas d'angles). Sert à composer pose de vue + carry + clip. PUR. */
export function addPose(a: Pose, b: Pose): Pose {
  const out: Pose = { ...a };
  for (const k of Object.keys(b) as BoneId[]) out[k] = (out[k] ?? 0) + (b[k] ?? 0);
  return out;
}
