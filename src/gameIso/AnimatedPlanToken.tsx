import { bonesToSvg } from './rig/renderBones';
import { usePlanAnim } from './usePlanAnim';
import type { BodyPlanId } from './rig/bodyPlan';
import type { Dir8 } from '../state/dir8';
import type { ColorsSel } from '../engine/authoringAppearance';

/**
 * Token ANIMÉ GÉNÉRIQUE pour TOUT gabarit rigué non-bipède (quadrupède, ailé, serpentin,
 * arachnide, aviaire, céphalopode). Le PLAN et l'ESPÈCE sont RÉSOLUS par l'appelant (pickBackend
 * via `resolveRender`, depuis la donnée explicite) et passés ici — plus aucun match par nom. L'anim
 * (poses du plan, vue 8-dir, marche/attaque bus) est déléguée à `usePlanAnim` (partagé avec
 * MountedToken). Hébergé dans la boîte 120×150 par tokenNode.
 */
export function AnimatedPlanToken({ id, planId, species, colors, eyes, dead, prone, facing, pos }: { id: string; planId: BodyPlanId; species: string; colors?: ColorsSel; eyes?: { G?: string; D?: string }; dead?: boolean; prone?: boolean; facing?: Dir8; pos?: { x: number; y: number } }) {
  const { plan, species: sp, pose, view, mirror, wings } = usePlanAnim(id, planId, species, dead, facing, pos, prone);
  if (!plan) return null;
  const svg = bonesToSvg(plan.resolve(sp, view, pose, { colors, wings, eyes }));
  return <g transform={mirror ? 'translate(120,0) scale(-1,1)' : undefined} dangerouslySetInnerHTML={{ __html: svg }} />;
}
