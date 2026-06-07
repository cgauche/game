import type { ReactNode } from 'react';
import { tileCenter, type Dims } from './iso';

/**
 * Coquille de positionnement PARTAGÉE de tout token de scène (combat + exploration + éditeur).
 * Source UNIQUE remplaçant les wrappers dupliqués token()/tokenNode() (IsoStage) et EntityToken :
 *  - ancrage des pieds au CENTRE de la tuile (lisibilité iso),
 *  - ombre portée + anneau de sélection optionnel,
 *  - `dim` (hors de combat) → opacité réduite,
 *  - calque `fx` (anim CSS du token entier) appliqué hors mort,
 *  - bascule de mort ~78° autour des pieds, SAUF `bakedDeath` (pose de mort déjà dans le modèle :
 *    rig à CORPSE_POSE, quadrupède effondré),
 *  - boîte d'échelle.
 * Le CORPS (rig React, plan animé, ou sprite SVG) est fourni en `children`.
 */
export function BodyToken({
  x,
  y,
  dims,
  scale,
  children,
  ring,
  dim = false,
  walking = false,
  fx,
  bakedDeath = false,
}: {
  x: number;
  y: number;
  dims: Dims;
  scale: number;
  children: ReactNode;
  ring?: string;
  dim?: boolean;
  walking?: boolean;
  fx?: string;
  bakedDeath?: boolean;
}) {
  const { cx, cy } = tileCenter(x, y, dims); // feetY = cy : pieds au centre de la tuile
  return (
    <g style={{ transform: `translate(${cx}px,${cy}px)`, transition: walking ? 'none' : 'transform 0.14s linear', opacity: dim ? 0.82 : 1 }}>
      <ellipse cx={0} cy={0} rx={16 * scale + 5} ry={(16 * scale + 5) / 2} fill="#000" opacity={0.33} />
      {ring && <ellipse cx={0} cy={0} rx={18 * scale} ry={9 * scale} fill="none" stroke={ring} strokeWidth={2.5} />}
      <g className={dim ? undefined : fx} transform={dim && !bakedDeath ? 'rotate(78)' : undefined}>
        <g transform={`translate(${-60 * scale},${-150 * scale}) scale(${scale})`}>{children}</g>
      </g>
    </g>
  );
}
