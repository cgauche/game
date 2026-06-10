import type { ReactNode } from 'react';
import { tileCenter, type Dims } from './iso';
import { hpColor, ACTIVE_RING } from './teamColors';

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
  ringDash,
  dim = false,
  walking = false,
  fx,
  bakedDeath = false,
  hp,
  icons,
  iconsMore = 0,
  veil,
  active = false,
  flat = false,
  portraitBox,
  discR,
}: {
  x: number;
  y: number;
  dims: Dims;
  scale: number;
  children: ReactNode;
  ring?: string;
  /** Pointillé SVG de l'anneau (canal d'appartenance daltonien-safe, R9) ; absent = trait plein. */
  ringDash?: string;
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
  /** Vue du dessus : rendre un disque-portrait centré sur la case (au lieu du corps ancré aux pieds). */
  flat?: boolean;
  /** viewBox cadrant le visage/haut du corps (depuis pickBackend) — requis en flat. */
  portraitBox?: string;
  /** Rayon du disque en px (calculé par l'appelant depuis l'empreinte) — requis en flat. */
  discR?: number;
}) {
  const { cx, cy } = tileCenter(x, y, dims); // feetY = cy : pieds au centre de la tuile
  const hpRatio = hp && hp.max > 0 ? clamp01(hp.current / hp.max) : null;
  const iconList = icons ?? [];
  const nIcons = iconList.length + (iconsMore > 0 ? 1 : 0);
  const iconStart = -(nIcons * 11) / 2 + 5.5;
  // Ancre haute du bloc de badges (PV + icônes) : au-dessus du disque en flat, au-dessus de la tête en iso.
  const R = discR ?? 22;
  const badgeY = flat ? -R : -150 * scale;
  const clipId = `disc-${Math.round(cx)}-${Math.round(cy)}`;
  return (
    <g style={{ transform: `translate(${cx}px,${cy}px)`, transition: walking ? 'none' : 'transform 0.14s linear', opacity: dim ? (flat ? 0.5 : 0.82) : 1 }}>
      {flat ? (
        // Pion-portrait (vue du dessus) : disque clippé centré sur la case, anneau circulaire.
        <>
          <ellipse cx={0} cy={R * 0.92} rx={R} ry={R * 0.32} fill="#000" opacity={0.28} />
          {active && <circle cx={0} cy={0} r={R + 4} fill="none" stroke={ACTIVE_RING} strokeWidth={3} opacity={0.85} />}
          <clipPath id={clipId}>
            <circle cx={0} cy={0} r={R} />
          </clipPath>
          <circle cx={0} cy={0} r={R} fill="#1b2030" />
          <g clipPath={`url(#${clipId})`}>
            <svg x={-R} y={-R} width={2 * R} height={2 * R} viewBox={portraitBox} preserveAspectRatio="xMidYMid slice">
              {children}
            </svg>
          </g>
          {veil && <circle cx={0} cy={0} r={R} fill={veil} opacity={0.16} pointerEvents="none" />}
          {ring && <circle cx={0} cy={0} r={R} fill="none" stroke={ring} strokeWidth={2.5} strokeDasharray={ringDash} />}
        </>
      ) : (
        // Pion iso : corps ancré aux pieds (centre de tuile), ombre + anneau en ellipse, bascule de mort.
        <>
          <ellipse cx={0} cy={0} rx={16 * scale + 5} ry={(16 * scale + 5) / 2} fill="#000" opacity={0.33} />
          {active && <ellipse cx={0} cy={0} rx={20 * scale} ry={10 * scale} fill="#ffe066" opacity={0.2} />}
          {ring && <ellipse cx={0} cy={0} rx={18 * scale} ry={9 * scale} fill="none" stroke={ring} strokeWidth={2.5} strokeDasharray={ringDash} />}
          <g className={dim ? undefined : fx} transform={dim && !bakedDeath ? 'rotate(78)' : undefined}>
            <g transform={`translate(${-60 * scale},${-150 * scale}) scale(${scale})`}>{children}</g>
          </g>
          {veil && <ellipse cx={0} cy={-44 * scale} rx={17 * scale} ry={34 * scale} fill={veil} opacity={0.11} pointerEvents="none" />}
        </>
      )}
      {(hpRatio != null || nIcons > 0) && (
        <g transform={`translate(0,${badgeY - 8})`} pointerEvents="none">
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
