import type { ReactNode } from 'react';
import { tileCenter, billboardScale, type Dims } from '../geometry/iso';
import { hpColor, ACTIVE_RING } from './teamColors';
import { IconG } from '../ui/Icon';
import type { IconId } from '../ui/icons';
import type { EndState } from '../engine/conditions';
import { END_STATE_VISUAL } from '../ui/endStateVisual';

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
  z = 0,
  dims,
  scale,
  children,
  ring,
  ringDash,
  dim = false,
  ghost = false,
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
  cid,
  highlight,
  endState,
}: {
  x: number;
  y: number;
  /** Étage (niveau de scène) : un z>0 soulève le token de z·LEVEL_H px. 0 = sol (défaut). */
  z?: number;
  dims: Dims;
  scale: number;
  children: ReactNode;
  ring?: string;
  /** Pointillé SVG de l'anneau (canal d'appartenance daltonien-safe, R9) ; absent = trait plein. */
  ringDash?: string;
  dim?: boolean;
  /** Hors Ligne de Vue du héros actif (tir impossible) → pion fantomatique (désaturé, translucide). */
  ghost?: boolean;
  walking?: boolean;
  fx?: string;
  bakedDeath?: boolean;
  /** Barre de PV au-dessus de la tête (Lot 1). */
  hp?: { current: number; max: number };
  /** Icônes d'états/buffs au-dessus de la barre (ids du registre src/ui/icons — déjà tronquées, cf. summarizeEffects). */
  icons?: IconId[];
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
  /** Id du combattant exposé en `data-cid` (ciblage DOM des recettes Playwright). */
  cid?: string;
  /** Cible courante du joueur (survol/visée) → halo de cette COULEUR qui suit la SILHOUETTE (couleur
   *  de relation : rouge adversaire / vert allié / or neutre). Désambiguë deux tokens empilés en iso
   *  (celui de devant, mis en évidence, ressort). Absent = pas de halo. */
  highlight?: string;
  /** État de FIN (#237) — pastille distincte par-dessus la tête (mort/inconscient/rendu/hors-combat),
   *  langage visuel UNIQUE (endStateVisual). Absent = combattant en état. */
  endState?: EndState | null;
}) {
  const { cx, cy } = tileCenter(x, y, dims, z); // feetY = cy : pieds au centre de la tuile (étage z)
  const endMark = endState ? END_STATE_VISUAL[endState] : null;
  const s = scale * billboardScale(dims); // échelle effective du billboard : réduite en vue « de face »
  const hpRatio = hp && hp.max > 0 ? clamp01(hp.current / hp.max) : null;
  const iconList = icons ?? [];
  const nIcons = iconList.length + (iconsMore > 0 ? 1 : 0);
  const iconStart = -(nIcons * 11) / 2 + 5.5;
  // Ancre haute du bloc de badges (PV + icônes) : au-dessus du disque en flat, au-dessus de la tête en iso.
  const R = discR ?? 22;
  const badgeY = flat ? -R : -150 * s;
  const clipId = `disc-${Math.round(cx)}-${Math.round(cy)}`;
  return (
    <g data-cid={cid} style={{ transform: `translate(${cx}px,${cy}px)`, transition: walking ? 'none' : 'transform 0.14s linear', opacity: dim ? (flat ? 0.5 : 0.82) : ghost ? 0.45 : 1, filter: [ghost && !dim ? 'grayscale(0.85)' : '', highlight ? `drop-shadow(0 0 3px ${highlight}) drop-shadow(0 0 7px ${highlight})` : ''].filter(Boolean).join(' ') || undefined }}>
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
          <ellipse cx={0} cy={0} rx={16 * s + 5} ry={(16 * s + 5) / 2} fill="#000" opacity={0.33} />
          {active && <ellipse cx={0} cy={0} rx={20 * s} ry={10 * s} fill={ACTIVE_RING} opacity={0.2} />}
          {ring && <ellipse cx={0} cy={0} rx={18 * s} ry={9 * s} fill="none" stroke={ring} strokeWidth={2.5} strokeDasharray={ringDash} />}
          <g className={dim ? undefined : fx} transform={dim && !bakedDeath ? 'rotate(78)' : undefined}>
            <g transform={`translate(${-60 * s},${-150 * s}) scale(${s})`}>{children}</g>
          </g>
          {veil && <ellipse cx={0} cy={-44 * s} rx={17 * s} ry={34 * s} fill={veil} opacity={0.11} pointerEvents="none" />}
        </>
      )}
      {(hpRatio != null || nIcons > 0) && (
        <g transform={`translate(0,${badgeY - 8})`} pointerEvents="none">
          {nIcons > 0 && (
            <g style={{ color: '#f2eef8' }}>
              {iconList.map((ic, i) => (
                <IconG key={i} id={ic} x={iconStart + i * 11 - 5} y={-13} size={10} />
              ))}
              {iconsMore > 0 && (
                <text x={iconStart + iconList.length * 11} y={-4} fontSize={8} fill="#cdb8d8" textAnchor="middle">+{iconsMore}</text>
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
      {endMark && (
        // Pastille d'état de FIN (#237) : disque teinté par état (classe es-*) + icône du registre,
        // au-dessus de la tête (iso) ou du disque-portrait (flat). Distincte de la barre d'icônes d'États.
        <g className={`token-endmark ${endMark.className}`} transform={`translate(0,${badgeY - 22})`} pointerEvents="none">
          <title>{endMark.label}</title>
          <circle cx={0} cy={0} r={8.5} />
          <IconG id={endMark.icon} x={-6} y={-6} size={12} />
        </g>
      )}
    </g>
  );
}
