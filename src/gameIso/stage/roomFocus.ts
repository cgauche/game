import { isDescriptiveZone, type Scene } from '../../state/scene';
import type { Pt } from '../../state/path';
import { sceneZoneTiles } from '../../state/zones';

export interface RoomFocus {
  id: string;
  z: number;
  tiles: ReadonlySet<string>;
}

const tileKey = (x: number, y: number, z: number) => `${x},${y},${z}`;

export function occupiedInteriorZoneIds(scene: Scene, heroPositions: readonly Pt[]): Set<string> {
  const occupied = new Set<string>();
  for (const hero of heroPositions) {
    const x = Math.round(hero.x);
    const y = Math.round(hero.y);
    const z = hero.z ?? 0;
    for (const zone of scene.effectZones ?? []) {
      if (!isDescriptiveZone(zone) || zone.presentation !== 'interior' || (zone.z ?? 0) !== z) continue;
      if (sceneZoneTiles(zone).some((tile) => tile.x === x && tile.y === y && (tile.z ?? zone.z ?? 0) === z)) occupied.add(zone.id);
    }
  }
  return occupied;
}

export function interiorZoneTilesById(scene: Scene): Map<string, ReadonlySet<string>> {
  const zones = new Map<string, ReadonlySet<string>>();
  for (const zone of scene.effectZones ?? []) {
    if (!isDescriptiveZone(zone) || zone.presentation !== 'interior') continue;
    zones.set(zone.id, new Set(sceneZoneTiles(zone).map((tile) => tileKey(tile.x, tile.y, tile.z ?? zone.z ?? 0))));
  }
  return zones;
}

export function roomCutawayAllies<T>(focus: RoomFocus | null | undefined, allies: T[]): T[] | undefined {
  return focus ? allies : undefined;
}

export function roomFocusAt(scene: Scene, partyPos: Pt): RoomFocus | null {
  const z = partyPos.z ?? 0;
  for (const zone of scene.effectZones ?? []) {
    if (!isDescriptiveZone(zone) || zone.presentation !== 'interior' || (zone.z ?? 0) !== z) continue;
    const tiles = sceneZoneTiles(zone);
    if (!tiles.some((tile) => tile.x === partyPos.x && tile.y === partyPos.y && (tile.z ?? zone.z ?? 0) === z)) continue;
    return {
      id: zone.id,
      z,
      tiles: new Set(tiles.map((tile) => tileKey(tile.x, tile.y, tile.z ?? zone.z ?? 0))),
    };
  }
  return null;
}
