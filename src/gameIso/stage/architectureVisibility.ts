import { depth, type Dims } from '../../geometry/iso';
import type { WallSide } from '../../state/scene';

export type Cutaway = 'hidden' | 'visible';

interface RoomRelated {
  roomZoneIds?: readonly string[];
}

export function cutawayForSection(section: RoomRelated, occupied: ReadonlySet<string>): Cutaway {
  return section.roomZoneIds?.some((id) => occupied.has(id)) ? 'hidden' : 'visible';
}

interface FacadePanel extends RoomRelated {
  x: number;
  y: number;
  z?: number;
  side: WallSide;
}

const adjacent: Record<'N' | 'E', [{ x: number; y: number }, { x: number; y: number }]> = {
  N: [{ x: 0, y: 0 }, { x: 0, y: -1 }],
  E: [{ x: 0, y: 0 }, { x: 1, y: 0 }],
};

const tileKey = (x: number, y: number, z: number) => `${x},${y},${z}`;

export function frontFacadeCutaway(
  panel: FacadePanel,
  occupied: ReadonlySet<string>,
  zoneTiles: ReadonlyMap<string, ReadonlySet<string>>,
  dims: Dims,
): boolean {
  if (cutawayForSection(panel, occupied) !== 'hidden') return false;
  if (panel.side !== 'N' && panel.side !== 'E') return false;
  const z = panel.z ?? 0;
  const [a, b] = adjacent[panel.side].map((offset) => ({ x: panel.x + offset.x, y: panel.y + offset.y }));
  const isInterior = (cell: { x: number; y: number }) => panel.roomZoneIds?.some((id) =>
    occupied.has(id) && zoneTiles.get(id)?.has(tileKey(cell.x, cell.y, z))) ?? false;
  const aInterior = isInterior(a);
  const bInterior = isInterior(b);
  if (aInterior === bInterior) return false;
  const interior = aInterior ? a : b;
  const exterior = aInterior ? b : a;
  return depth(exterior.x, exterior.y, dims, z) > depth(interior.x, interior.y, dims, z);
}
