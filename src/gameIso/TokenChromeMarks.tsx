/**
 * PEINTRE UNIQUE du chrome d'écran d'un jeton (#1176, P3-0f) : la barre de PV, la rangée d'icônes
 * d'états/buffs avec son report « +N », et la pastille d'état de FIN (#237). Les DEUX voies de rendu
 * le montent — la voie affine DANS son jeton (`BodyToken`), la voie volumique dans l'overlay projeté
 * au-dessus de la tête du billboard (`stage/TokenChromeOverlay`) — et c'est structurel : deux
 * peintres divergeraient d'un pixel, d'une couleur de seuil ou d'un `<title>` d'accessibilité.
 *
 * Le repère est celui du JETON : origine aux pieds (centre de tuile), `badgeY` = l'ordonnée de la
 * TÊTE. Chaque voie mesure cette hauteur chez elle — la boîte du rig affine, le quad volumique — et
 * c'est le seul nombre qui les sépare.
 */
import { hpColor } from './teamColors';
import { IconG } from '../ui/Icon';
import type { IconId } from '../ui/icons';
import type { EndState } from '../engine/conditions';
import { END_STATE_VISUAL } from '../ui/endStateVisual';

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));

export interface TokenChromeMarksProps {
  /** Barre de PV au-dessus de la tête ; absente = aucune jauge (engin inerte, décor). */
  hp?: { current: number; max: number } | null;
  /** Icônes d'états/buffs (ids du registre `src/ui/icons`, déjà tronquées). */
  icons?: readonly IconId[];
  /** Surplus d'icônes non affichées (« +N »). */
  iconsMore?: number;
  /** État de FIN — pastille distincte au-dessus de la barre ; absent = combattant en état. */
  endState?: EndState | null;
  /** Ordonnée de la TÊTE dans le repère du jeton (négative : au-dessus des pieds). */
  badgeY: number;
}

export function TokenChromeMarks({ hp, icons, iconsMore = 0, endState, badgeY }: TokenChromeMarksProps): JSX.Element | null {
  const hpRatio = hp && hp.max > 0 ? clamp01(hp.current / hp.max) : null;
  const iconList = icons ?? [];
  const nIcons = iconList.length + (iconsMore > 0 ? 1 : 0);
  const iconStart = -(nIcons * 11) / 2 + 5.5;
  const endMark = endState ? END_STATE_VISUAL[endState] : null;
  if (hpRatio == null && nIcons === 0 && !endMark) return null;
  return (
    <>
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
        <g className={`token-endmark ${endMark.className}`} transform={`translate(0,${badgeY - 22})`} pointerEvents="none">
          <title>{endMark.label}</title>
          <circle cx={0} cy={0} r={8.5} />
          <IconG id={endMark.icon} x={-6} y={-6} size={12} />
        </g>
      )}
    </>
  );
}
