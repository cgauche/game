/**
 * Ambiance du stage : faune (mouches sur les cadavres — DANS le groupe caméra) et voiles fixes
 * PAR-DESSUS la scène (lueur chaude, corbeau, vignette, rideau de nuit — hors groupe caméra).
 */
import { Scene } from '../../state/scene';
import { sceneIsDark } from '../../state/sceneRules';
import { Dims, tileCenter } from '../iso';
import { AMBIANCE } from '../catalog/ambiance';
import { VW, VH } from './useStageCamera';

/** Mouches qui tournoient au-dessus de chaque cadavre (faune d'ambiance) — dans le groupe caméra. */
export function Flies({ scene, dims }: { scene: Scene; dims: Dims }) {
  return (
    <>
      {scene.entities
        .filter((e) => e.kind === 'prop' && e.ref === 'cadavre')
        .map((e) => {
          const { cx, cy } = tileCenter(e.pos.x, e.pos.y, dims);
          return (
            <g key={`flies-${e.id}`} transform={`translate(${cx},${cy - 14})`} pointerEvents="none">
              {['f1', 'f2', 'f3'].map((f) => (
                <circle key={f} className={`fly ${f}`} r={1.5} fill="var(--iso-fauna)" />
              ))}
            </g>
          );
        })}
    </>
  );
}

/** Voiles fixes par-dessus la scène (ne suivent pas la caméra) : lueur chaude, corbeau qui traverse le
 *  ciel (extérieurs), vignette, puis l'assombrissement de mise en scène (Lot L) piloté par `lightLevel`,
 *  sinon l'obscurité d'horloge/ambiance. 1 = plein jour (aucun voile) → 0 = noir. Transition douce. */
export function AmbianceVeils({ scene, gameTime, lightLevel }: { scene: Scene; gameTime: number; lightLevel: number | null | undefined }) {
  const light = lightLevel ?? (scene && sceneIsDark(scene, gameTime) ? 0.4 : 1);
  const veil = (1 - Math.max(0, Math.min(1, light))) * 0.82;
  return (
    <>
      <rect x={0} y={0} width={VW} height={VH} fill="url(#g_warm)" pointerEvents="none" />
      {scene.ambiance !== 'interieur' && (
        <g className="crow" style={{ transform: 'translate(-140px,90px)' }} pointerEvents="none">
          <ellipse cx={0} cy={0} rx={7} ry={3} fill="var(--iso-fauna)" />
          <path className="wing" d="M-2 0 q-14 -8 -22 -2 q12 4 22 2" fill="var(--iso-fauna)" />
          <path className="wing" d="M2 0 q14 -8 22 -2 q-12 4 -22 2" fill="var(--iso-fauna)" />
          <circle cx={6} cy={-1} r={2.4} fill="var(--iso-fauna)" />
        </g>
      )}
      <rect x={0} y={0} width={VW} height={VH} fill="url(#g_vig)" pointerEvents="none" />
      {veil > 0.001 && (
        <rect x={0} y={0} width={VW} height={VH} fill={AMBIANCE.iso.nightVeil} opacity={veil} pointerEvents="none" style={{ transition: 'opacity 1.1s ease' }} />
      )}
    </>
  );
}
