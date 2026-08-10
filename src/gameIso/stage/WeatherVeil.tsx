/**
 * #239 — voile de MÉTÉO AUTHORÉE de scène (`scene.weather`) : teinte plein écran + champ de
 * particules (pluie/neige), PAR-DESSUS la scène et l'ambiance, SOUS l'UI. Hors groupe caméra
 * (fixe à l'écran), `pointer-events: none` (n'altère ni l'ordre du peintre ni le picking).
 * Config 100 % DONNÉE (`AMBIANCE.iso.weather`, `src/data/ambiance.json`) : la teinte se VOIT,
 * ce n'est pas un shader. Les particules sont des positions SEEDÉES stables (idempotentes au
 * re-render, mémoïsées par type) et l'animation est du CSS PUR (aucun re-calcul React par frame).
 *
 * C'est l'expression de la météo par la voie AFFINE — la voie volumique la fait tomber DANS le monde
 * (`backends/webgl/weatherParticles.ts`) et ne monte pas ce voile. Les deux passent par la MÊME porte
 * (`sceneWeatherFx`), d'où le paramètre : la scène, pas son seul champ `weather` — un intérieur ne
 * reçoit ni voile ni particule (`stage/Ambiance.tsx` gardait déjà sa faune de la même façon).
 */
import { useMemo, type ReactNode } from 'react';
import { sceneWeatherFx, type WeatherFxDef } from '../catalog/ambiance';
import { makeRNG, hashSeed } from '../../engine/dice';
import { VW, VH } from './useStageCamera';
import type { Scene } from '../../state/scene';

const DUR: Record<NonNullable<WeatherFxDef['particles']>, [number, number]> = {
  pluie: [19, 28],
  averse: [9, 14],
  neige: [60, 100],
};

function particleField(fx: WeatherFxDef): ReactNode {
  const kind = fx.particles;
  if (!kind) return null;
  const n = Math.max(0, fx.density ?? 60);
  const rng = makeRNG(hashSeed(`weather-${kind}`));
  const [dlo, dhi] = DUR[kind];
  const snow = kind === 'neige';
  const cls = `wx-p wx-${kind}`;
  const nodes: ReactNode[] = [];
  for (let i = 0; i < n; i++) {
    const x = rng.int(0, VW);
    const durMs = rng.int(dlo, dhi) * 100;
    const style = {
      stroke: snow ? undefined : fx.pcolor,
      fill: snow ? fx.pcolor : undefined,
      strokeWidth: kind === 'averse' ? 1.4 : 1,
      strokeLinecap: 'round' as const,
      opacity: snow ? 0.85 : kind === 'averse' ? 0.55 : 0.4,
      animationDuration: `${durMs}ms`,
      animationDelay: `-${rng.int(0, durMs)}ms`,
    };
    nodes.push(
      snow ? (
        <circle key={i} className={cls} cx={x} cy={0} r={1.3} style={style} />
      ) : (
        <line key={i} className={cls} x1={x} y1={0} x2={x - 1} y2={kind === 'averse' ? 16 : 12} style={style} />
      ),
    );
  }
  return nodes;
}

/** Rend le voile + les particules de la météo authorée. `clair`/absent, ou intérieur = rien. */
export function WeatherVeil({ scene }: { scene: Pick<Scene, 'weather' | 'ambiance'> }) {
  const fx = sceneWeatherFx(scene);
  const particles = useMemo(() => (fx ? particleField(fx) : null), [fx]);
  if (!fx) return null;
  return (
    <g pointerEvents="none">
      <rect x={0} y={0} width={VW} height={VH} fill={fx.tint} opacity={fx.alpha} style={{ transition: 'opacity 1.1s ease' }} />
      {particles}
    </g>
  );
}
