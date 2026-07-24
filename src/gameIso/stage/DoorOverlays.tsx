import type { Dims } from '../../geometry/iso';
import { tileEdge } from '../../geometry/iso';
import type { RoomPortal } from '../../state/roomPortals';
import type { Pt } from '../../state/path';

interface DoorOverlaysProps {
  portals: RoomPortal[];
  dims: Dims;
  activeZ: number;
  visible: ReadonlySet<string>;
  hoveredPortalId: string | null;
  lift: (point: Pt) => number;
  onPortalHover: (portal: RoomPortal | null) => void;
  onPortalClick: (portal: RoomPortal) => void;
}

const visibleKey = (point: Pt, z: number) => `${point.x},${point.y},${point.z ?? z}`;

const portalTitle = (portal: RoomPortal): string =>
  portal.kind === 'door-closed'
    ? portal.exterior ? 'Porte extérieure fermée' : 'Porte fermée'
    : portal.exterior
      ? portal.fromZoneId === null ? 'Entrée intérieure' : 'Sortie extérieure'
      : portal.kind === 'door-open'
        ? 'Porte ouverte'
        : 'Passage vers une autre pièce';

export function DoorOverlays({
  portals,
  dims,
  activeZ,
  visible,
  hoveredPortalId,
  lift,
  onPortalHover,
  onPortalClick,
}: DoorOverlaysProps) {
  return (
    <>
      {portals
        .filter((portal) =>
          portal.z === activeZ
          && (visible.has(visibleKey(portal.from, portal.z)) || visible.has(visibleKey(portal.to, portal.z))))
        .map((portal) => {
          const [a, b] = tileEdge(
            portal.edge.x,
            portal.edge.y,
            portal.edge.side,
            dims,
            lift(portal.from),
          );
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
            ? 'var(--combat-gold)'
            : portal.kind === 'door-closed'
              ? 'var(--iso-door-closed)'
              : 'var(--iso-door-open)';
          const activate = () => onPortalClick(portal);
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
              <line
                data-portal-target=""
                x1={a.cx}
                y1={a.cy}
                x2={b.cx}
                y2={b.cy}
                stroke="transparent"
                strokeWidth={28}
                strokeLinecap="round"
                tabIndex={0}
                role="button"
                aria-label={portalTitle(portal)}
                style={{ cursor: 'pointer', outline: 'none' }}
                onPointerEnter={() => onPortalHover(portal)}
                onPointerLeave={() => onPortalHover(null)}
                onFocus={() => onPortalHover(portal)}
                onBlur={() => onPortalHover(null)}
                onPointerDown={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  activate();
                }}
                onKeyDown={(event) => {
                  if (event.key !== 'Enter' && event.key !== ' ') return;
                  event.preventDefault();
                  activate();
                }}
              >
                <title>{portalTitle(portal)}</title>
              </line>
            </g>
          );
        })}
    </>
  );
}
