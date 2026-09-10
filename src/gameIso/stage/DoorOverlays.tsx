/**
 * SEUILS DE PIÈCE — PEINTRE des accès (passage, porte, sortie) et rien d'autre.
 *
 * Ce composant ne PREND plus le pointeur : l'arête est un étage de la chaîne de picking
 * (`stage/pickResolve.ts:areteSousLePixel`, consulté avant le rayon), et le survol comme le clic lui
 * arrivent déjà tranchés par le verdict (`hoveredPortalId`, `activerArete`). Ce qu'il garde, parce que
 * la chaîne ne le rend pas : le TRACÉ, et le CLAVIER — `role="button"`, `tabIndex`, `aria-label`,
 * Entrée/Espace qui appellent la MÊME fonction que le verdict de pixel, et le FOCUS, qui pose le survol
 * par la MÊME source que le pointeur (l'accent du seuil focalisé EST son rendu de focus : le contour du
 * navigateur ne suit pas un trait SVG transparent).
 *
 * Sa population EST celle du dériveur (`state/aretes.ts:aretesUtilisables`, capacité `porte`) : il ne
 * refiltre ni la couche active ni le brouillard, sinon peintre et chaîne offriraient deux seuils
 * différents.
 */
import type { AreteUtilisable } from '../../state/aretes';
import type { AreteProjetee } from './aretesProjetees';
import { GOLD_TINT } from '../highlightTints';

interface DoorOverlaysProps {
  /** Arêtes de capacité `porte` que l'hôte a dérivées PUIS projetées — chacune porte son accès, son
   *  libellé et le segment d'écran que le picking résout. Le peintre ne projette rien lui-même : une
   *  seconde projection ici, et le trait dirait un seuil que le clic ne trouve pas. */
  aretes: readonly AreteProjetee[];
  hoveredPortalId: string | null;
  activerArete: (arete: AreteUtilisable) => void;
  /** FOCUS clavier sur un seuil : il pose le survol par le MÊME canal que le pixel
   *  (`useStagePointer.survolerArete`), donc le seuil focalisé porte l'accent et le geste est armé —
   *  une Entrée suffit, y compris sur un appareil qui ne survole pas. */
  onFocusArete: (arete: AreteUtilisable) => void;
  onBlurArete: () => void;
}

export function DoorOverlays({ aretes, hoveredPortalId, activerArete, onFocusArete, onBlurArete }: DoorOverlaysProps) {
  return (
    <>
      {aretes.map(({ arete, a, b }) => {
        const portal = arete.portail;
        if (!portal) return null;
        const mx = (a.cx + b.cx) / 2;
        const my = (a.cy + b.cy) / 2;
        const edgeLength = Math.hypot(b.cx - a.cx, b.cy - a.cy);
        const ux = (b.cx - a.cx) / edgeLength;
        const uy = (b.cy - a.cy) / edgeLength;
        const nx = -uy;
        const ny = ux;
        const highlighted = portal.id === hoveredPortalId;
        const classes = [
          'room-portal',
          `portal-${portal.kind}`,
          portal.exterior ? 'portal-exterior' : '',
          highlighted ? 'portal-highlight' : '',
        ].filter(Boolean).join(' ');
        const stroke = portal.exterior
          ? GOLD_TINT
          : portal.kind === 'door-closed'
            ? 'var(--iso-door-closed)'
            : 'var(--iso-door-open)';
        return (
          <g key={portal.id} className={classes}>
            <line
              data-portal-visual="passive"
              x1={mx - ux * 5.9}
              y1={my - uy * 5.9}
              x2={mx + ux * 5.9}
              y2={my + uy * 5.9}
              stroke={stroke}
              strokeWidth={2}
              strokeLinecap="round"
              opacity={0.38}
              pointerEvents="none"
            />
            {highlighted && (
              <line
                data-portal-visual="accent"
                x1={mx - ux * 8.9}
                y1={my - uy * 8.9}
                x2={mx + ux * 8.9}
                y2={my + uy * 8.9}
                stroke={stroke}
                strokeWidth={3.5}
                strokeLinecap="round"
                opacity={0.95}
                pointerEvents="none"
              />
            )}
            {portal.kind === 'door-closed' && (
              <line
                data-portal-visual="passive"
                data-portal-symbol="closed"
                x1={mx - nx * 3.5}
                y1={my - ny * 3.5}
                x2={mx + nx * 3.5}
                y2={my + ny * 3.5}
                stroke={stroke}
                strokeWidth={2}
                strokeLinecap="round"
                opacity={0.38}
                pointerEvents="none"
              />
            )}
            {portal.exterior && (
              <path
                data-portal-symbol="exterior"
                d={`M${mx - nx * 2 - ux * 4},${my - ny * 2 - uy * 4} L${mx + nx * 4},${my + ny * 4} L${mx - nx * 2 + ux * 4},${my - ny * 2 + uy * 4}`}
                fill="none"
                stroke={stroke}
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity={0.38}
                pointerEvents="none"
              />
            )}
            {/* L'ARÊTE elle-même : plus une cible de pointeur (`pointerEvents="none"` — la chaîne
                répond pour elle, à la MÊME largeur de prise), mais un bouton ATTEIGNABLE au clavier. */}
            <line
              data-portal-arete=""
              x1={a.cx}
              y1={a.cy}
              x2={b.cx}
              y2={b.cy}
              stroke="transparent"
              strokeWidth={arete.largeurPrise}
              strokeLinecap="round"
              pointerEvents="none"
              tabIndex={0}
              role="button"
              aria-label={arete.libelle}
              style={{ outline: 'none' }}
              onFocus={() => onFocusArete(arete)}
              onBlur={() => onBlurArete()}
              onKeyDown={(event) => {
                if (event.key !== 'Enter' && event.key !== ' ') return;
                event.preventDefault();
                activerArete(arete);
              }}
            >
              <title>{arete.libelle}</title>
            </line>
          </g>
        );
      })}
    </>
  );
}
