import {
  doorIsOpen,
  edgeOf,
  isDescriptiveZone,
  isWalkable,
  structureIsDown,
  wallIsOpen,
  type Scene,
  type WallSeg,
} from './scene';
import { pathTo, tileKey, walkNeighbors, type Pt } from './path';
import { sceneZoneTiles } from './zones';

export type RoomPortalKind = 'passage' | 'door-open' | 'door-closed';

export interface RoomPortal {
  id: string;
  z: number;
  edge: { x: number; y: number; side: 'N' | 'E' };
  fromZoneId: string | null;
  toZoneId: string | null;
  kind: RoomPortalKind;
  exterior: boolean;
  from: Pt;
  to: Pt;
}

interface IndexedTile {
  point: Pt;
  zoneIds: string[];
}

const pointAt = (x: number, y: number, z: number): Pt => (z ? { x, y, z } : { x, y });
const edgeKey = (x: number, y: number, side: 'N' | 'E', z: number) => `${z}:${x},${y}:${side}`;

function interiorTiles(scene: Scene): Map<string, IndexedTile> {
  const indexed = new Map<string, IndexedTile>();
  for (const zone of scene.effectZones ?? []) {
    if (!isDescriptiveZone(zone) || zone.presentation !== 'interior') continue;
    for (const tile of sceneZoneTiles(zone)) {
      const z = tile.z ?? zone.z ?? 0;
      const key = tileKey(tile.x, tile.y, z);
      const current = indexed.get(key);
      if (current) current.zoneIds.push(zone.id);
      else indexed.set(key, { point: pointAt(tile.x, tile.y, z), zoneIds: [zone.id] });
    }
  }
  return indexed;
}

function wallAt(scene: Scene, edge: RoomPortal['edge'], z: number): WallSeg | undefined {
  return (scene.walls ?? []).find((wall) =>
    wall.x === edge.x
    && wall.y === edge.y
    && wall.side === edge.side
    && (wall.z ?? 0) === z);
}

function portalKind(scene: Scene, wall: WallSeg | undefined): RoomPortalKind | null {
  if (!wall) return 'passage';
  if (wall.structure) return structureIsDown(scene, wall) ? 'passage' : null;
  if (wall.door) return doorIsOpen(scene, wall) ? 'door-open' : 'door-closed';
  return wallIsOpen(scene, wall) ? 'passage' : null;
}

function connected(scene: Scene, from: Pt, to: Pt): boolean {
  return walkNeighbors(scene, from).some((neighbor) =>
    neighbor.x === to.x
    && neighbor.y === to.y
    && (neighbor.z ?? 0) === (to.z ?? 0));
}

export function roomPortals(scene: Scene): RoomPortal[] {
  const indexed = interiorTiles(scene);
  const portals = new Map<string, RoomPortal>();
  const directions = [[1, 0], [0, 1], [-1, 0], [0, -1]] as const;

  for (const { point: from, zoneIds: fromZoneIds } of indexed.values()) {
    const z = from.z ?? 0;
    for (const [dx, dy] of directions) {
      const to = pointAt(from.x + dx, from.y + dy, z);
      const edge = edgeOf(from.x, from.y, to.x, to.y);
      if (!edge) continue;
      const kind = portalKind(scene, wallAt(scene, edge, z));
      if (!kind) continue;
      const toZoneIds = indexed.get(tileKey(to.x, to.y, z))?.zoneIds ?? [];
      if (
        !connected(scene, from, to)
        && (kind !== 'door-closed' || (!toZoneIds.length && !isWalkable(scene, to.x, to.y, z)))
      ) continue;

      for (const fromZoneId of fromZoneIds) {
        const destinations = toZoneIds.filter((zoneId) => zoneId !== fromZoneId);
        if (!destinations.length && toZoneIds.includes(fromZoneId)) continue;
        for (const toZoneId of destinations.length ? destinations : [null]) {
          const id = `${edgeKey(edge.x, edge.y, edge.side, z)}:${fromZoneId}:${toZoneId ?? 'exterior'}`;
          portals.set(id, {
            id,
            z,
            edge,
            fromZoneId,
            toZoneId,
            kind,
            exterior: toZoneId === null,
            from,
            to,
          });
        }
      }
    }
  }

  return [...portals.values()].sort((a, b) => a.id.localeCompare(b.id));
}

export function portalsFromRooms(
  scene: Scene,
  occupiedZoneIds: ReadonlySet<string>,
): RoomPortal[] {
  return roomPortals(scene).filter((portal) =>
    portal.fromZoneId !== null && occupiedZoneIds.has(portal.fromZoneId));
}

export function portalsForParty(
  scene: Scene,
  partyPos: Pt,
  occupiedZoneIds: ReadonlySet<string>,
): RoomPortal[] {
  if (occupiedZoneIds.size) return portalsFromRooms(scene, occupiedZoneIds);
  return roomPortals(scene)
    .filter((portal) =>
      portal.exterior
      && portal.toZoneId === null
      && pathTo(scene, partyPos, portal.to, { blocked: new Set() }) !== null)
    .map((portal) => ({
      ...portal,
      id: `${edgeKey(portal.edge.x, portal.edge.y, portal.edge.side, portal.z)}:exterior:${portal.fromZoneId}`,
      fromZoneId: null,
      toZoneId: portal.fromZoneId,
      from: portal.to,
      to: portal.from,
    }));
}
