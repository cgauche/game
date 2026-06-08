import { useRigAnim } from './useRigAnim';
import { usePlanAnim } from './usePlanAnim';
import { resolveRig } from './rig/composeRig';
import { bonesToSvg } from './rig/renderBones';
import { seatRiderOnMount, mountedRest } from './rig/mountedRig';
import { addPose } from './rig/poses';
import { enemyRigProfile } from './rig/enemyProfile';
import { defaultAppearance } from './rig/appearance';
import { equipFromCombatant, isShield } from './rig/parts/equipment';
import { bipedSpeciesScale } from './rig/creatures';
import { isOutOfAction } from '../engine/conditions';
import type { Combatant } from '../engine/types';

/** Échelle du cavalier RELATIVE à la boîte de la monture (assis). Tuning visuel (QC d'assise). */
const RIDE_SCALE = 0.78;

/**
 * Couple CAVALIER+MONTURE rendu comme UN SEUL corps composite, trié au niveau de l'os
 * (cf. composite.ts / mountedRig.ts) → vraie profondeur : jambe lointaine derrière le
 * barillet, buste derrière la tête. La monture donne la vue/mirror du couple ; le cavalier
 * garde son animation (clips bus via useRigAnim) par-dessus la pose d'équitation.
 * Rendu dans la boîte 120×150 de la monture : à insérer dans un BodyToken à l'échelle monture.
 */
export function MountedToken({ mount, rider }: { mount: Combatant; rider: Combatant }) {
  // Monture : gabarit animé. Sa vue/mirror sont autoritaires pour le couple.
  const mountA = usePlanAnim(mount.id, mount.name, isOutOfAction(mount), undefined);
  // Cavalier : apparence/équipement dérivés (héros = du Combatant ; ennemi/PNJ = profil rig).
  const prof = rider.kind === 'hero' ? null : enemyRigProfile(rider);
  const appearance = prof?.appearance ?? rider.appearance ?? defaultAppearance(rider);
  const equip = prof?.equip ?? equipFromCombatant(rider);
  const career = prof?.career ?? rider.career;
  const overlays = prof?.overlays;
  // Animation vivante du cavalier (attaque/parade/touché via le bus, ciblées par rider.id).
  const riderA = useRigAnim({ id: rider.id, equip, facing: undefined });

  if (!mountA.plan) return null; // monture sans gabarit (improbable) — rien à composer

  const view = mountA.view; // le couple partage la vue de la monture
  const mountBones = mountA.plan.resolve(mountA.species, view, mountA.pose, { colors: mount.appearance?.colors });
  // Pose MONTÉE dédiée (corps assis + tenue d'arme selon l'arme tenue) + delta du clip vivant
  // (idle/attaque) par-dessus. On n'utilise PAS la prise d'arme à pied (riderA.holdPose).
  const mainWeapon = equip.weapons?.find((w) => !isShield(w)) ?? equip.weapons?.[0];
  const riderPose = addPose(mountedRest(view, mainWeapon), riderA.pose);
  const riderBones = resolveRig(appearance, equip, riderPose, career, view, overlays);
  // k (échelle relative dans la boîte monture) : RIDE_SCALE × échelle d'espèce du cavalier.
  const k = RIDE_SCALE * bipedSpeciesScale(rider.name);
  const merged = seatRiderOnMount(mountBones, riderBones, { view, mountScale: 1, riderScale: k });
  return <g transform={mountA.mirror ? 'translate(120,0) scale(-1,1)' : undefined} dangerouslySetInnerHTML={{ __html: bonesToSvg(merged) }} />;
}
