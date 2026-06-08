import type { ReactNode } from 'react';
import { tileCenter, type Dims } from './iso';
import { hpColor } from './teamColors';

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));

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
  hp,
  icons,
  iconsMore = 0,
  veil,
  active = false,
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
  /** Barre de PV au-dessus de la tête (Lot 1). */
  hp?: { current: number; max: number };
  /** Icônes d'états/buffs au-dessus de la barre (déjà tronquées, cf. summarizeEffects). */
  icons?: string[];
  /** Surplus d'icônes non affichées (« +N »). */
  iconsMore?: number;
  /** Voile léger d'équipe sur le modèle (allié vert / ennemi rouge). */
  veil?: string;
  /** Unité active → halo doré au sol. */
  active?: boolean;
}) {
  const { cx, cy } = tileCenter(x, y, dims); // feetY = cy : pieds au centre de la tuile
  const hpRatio = hp && hp.max > 0 ? clamp01(hp.current / hp.max) : null;
  const iconList = icons ?? [];
  const nIcons = iconList.length + (iconsMore > 0 ? 1 : 0);
  const iconStart = -(nIcons * 11) / 2 + 5.5;
  return (
    <g style={{ transform: `translate(${cx}px,${cy}px)`, transition: walking ? 'none' : 'transform 0.14s linear', opacity: dim ? 0.82 : 1 }}>
      <ellipse cx={0} cy={0} rx={16 * scale + 5} ry={(16 * scale + 5) / 2} fill="#000" opacity={0.33} />
      {active && <ellipse cx={0} cy={0} rx={20 * scale} ry={10 * scale} fill="#ffe066" opacity={0.2} />}
      {ring && <ellipse cx={0} cy={0} rx={18 * scale} ry={9 * scale} fill="none" stroke={ring} strokeWidth={2.5} />}
      <g className={dim ? undefined : fx} transform={dim && !bakedDeath ? 'rotate(78)' : undefined}>
        <g transform={`translate(${-60 * scale},${-150 * scale}) scale(${scale})`}>{children}</g>
      </g>
      {veil && <ellipse cx={0} cy={-44 * scale} rx={17 * scale} ry={34 * scale} fill={veil} opacity={0.11} pointerEvents="none" />}
      {(hpRatio != null || nIcons > 0) && (
        <g transform={`translate(0,${-150 * scale - 8})`} pointerEvents="none">
          {nIcons > 0 && (
            <g>
              {iconList.map((ic, i) => (
                <text key={i} x={iconStart + i * 11} y={-3} fontSize={11} textAnchor="middle">{ic}</text>
              ))}
              {iconsMore > 0 && (
                <text x={iconStart + iconList.length * 11} y={-3} fontSize={8} fill="#cdb8d8" textAnchor="middle">+{iconsMore}</text>
              )}
            </g>
          )}
          {hpRatio != null && (
            <>
              <rect x={-13} y={0} width={26} height={4} rx={2} fill="#000" opacity={0.65} />
              <rect x={-13} y={0} width={26 * hpRatio} height={4} rx={2} fill={hpColor(hpRatio)} />
            </>
          )}
        </g>
      )}
    </g>
  );
}
