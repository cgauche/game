import type { BoneId } from './bones';

/** Override d'angles d'os (degrés). Cible des animations (C) et postures (D). */
export type Pose = Partial<Record<BoneId, number>>;

/** Pose de repos : aucun override (les angles au repos du squelette s'appliquent). */
export const POSE_REPOS: Pose = {};
