import type { Pose } from './poses';
import type { View } from './facing';

/** Pose de base par vue (deltas d'angles, composés additivement avec la pose d'anim).
 *  Valeurs profil initiales — réglées à la recette navigateur. */
export const VIEW_POSE: Record<View, Pose> = {
  front: {},
  back: {},
  // Profil : LÉGÈRE profondeur (un membre devant l'autre) — les bras PENDENT, ils ne se
  // balancent pas. Un swing trop fort (±14) donnait « bras en arrière » au héros désarmé.
  // Les jambes gardent une amorce de pas (naturel de profil). Léger pivot du torse.
  profile: { epauleG: 6, epauleD: -4, avantBrasG: 4, avantBrasD: -3, cuisseG: 10, cuisseD: -10, torse: 4 },
};
