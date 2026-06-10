import { bonesToSvg } from './rig/renderBones';
import { usePlanAnim } from './usePlanAnim';
import type { Dir8 } from '../state/dir8';
import type { ColorsSel } from '../state/scene';

/**
 * Token ANIMÉ GÉNÉRIQUE pour TOUT gabarit rigué non-bipède (quadrupède, ailé, serpentin,
 * arachnide, aviaire, céphalopode). L'animation (poses du plan, vue 8-dir, marche/attaque
 * bus) est déléguée à `usePlanAnim` (partagé avec MountedToken) ; ici on ne fait que rendre.
 * Hébergé dans la boîte 120×150 par tokenNode.
 */
export function AnimatedPlanToken({ id, name, colors, dead, facing, pos }: { id: string; name: string; colors?: ColorsSel; dead?: boolean; facing?: Dir8; pos?: { x: number; y: number } }) {
  const { plan, species, pose, view, mirror } = usePlanAnim(id, name, dead, facing, pos);
  if (!plan) return null;
  const svg = bonesToSvg(plan.resolve(species, view, pose, { colors }));
  return <g transform={mirror ? 'translate(120,0) scale(-1,1)' : undefined} dangerouslySetInnerHTML={{ __html: svg }} />;
}
