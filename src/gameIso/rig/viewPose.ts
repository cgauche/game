import type { Pose } from './poses';
import type { View } from './facing';

/** Pose de base par vue (deltas d'angles, composés additivement avec la pose d'anim).
 *  Valeurs profil initiales — réglées à la recette navigateur. */
export const VIEW_POSE: Record<View, Pose> = {
  front: {},
  back: {},
  // Profil : membres ramenés vers l'axe (un bras/jambe devant l'autre), léger pivot du torse.
  profile: { epauleG: 14, epauleD: -14, avantBrasG: 8, avantBrasD: -8, cuisseG: 10, cuisseD: -10, torse: 4 },
};
