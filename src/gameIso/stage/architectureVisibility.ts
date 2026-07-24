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

const outward: Record<WallSide, { x: number; y: number }> = {
  N: { x: 0, y: -1 },
  E: { x: 1, y: 0 },
  '\\': { x: 1, y: 1 },
  '/': { x: 1, y: -1 },
};

export function frontFacadeCutaway(panel: FacadePanel, occupied: ReadonlySet<string>, dims: Dims): boolean {
  if (cutawayForSection(panel, occupied) !== 'hidden') return false;
  const normal = outward[panel.side];
  return depth(panel.x + normal.x, panel.y + normal.y, dims, panel.z ?? 0) > depth(panel.x, panel.y, dims, panel.z ?? 0);
}
