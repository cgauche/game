/**
 * Lecture géométrique PURE d'une Scène compilée (`buildScene`) — aucune dépendance à l'ASCII source.
 * Utilisé par `audit.ts` comme vérité de terrain/murs/zones ; la position dans le FICHIER source est
 * résolue séparément par `locate.ts`.
 */
import { isDescriptiveZone, type Scene, type SceneEffectZone } from '../../src/state/scene';
import { sceneZoneTiles } from '../../src/state/zones';
import type { Edge4 } from '../../src/state/sceneEdit';

export type { Edge4 };

/** Terrain d'une case, hors bornes / étage absent = `'vide'` (comme la base des couches z>0). */
export function terrainAt(scene: Scene, x: number, y: number, z: number): string {
  if (x < 0 || y < 0 || x >= scene.dimensions.w || y >= scene.dimensions.h) return 'vide';
  const layer = scene.layers.find((l) => l.z === z);
  if (!layer) return 'vide';
  return layer.tiles[y * scene.dimensions.w + x] ?? 'vide';
}

/** Étages présents dans la Scène, triés (z croissant). */
export function scenesZ(scene: Scene): number[] {
  return [...new Set(scene.layers.map((l) => l.z))].sort((a, b) => a - b);
}

/** Convertit une arête `Edge4` (N/E/S/O d'une case) vers sa forme CANONIQUE de stockage `WallSeg`
 *  (`N`/`E` seulement — S de (x,y) = N de (x,y+1) ; O de (x,y) = E de (x-1,y), cf. `scene.ts` l.680). */
function canonical(x: number, y: number, side: Edge4): { x: number; y: number; side: 'N' | 'E' } {
  if (side === 'S') return { x, y: y + 1, side: 'N' };
  if (side === 'O') return { x: x - 1, y, side: 'E' };
  return { x, y, side };
}

/** Un mur (plein, porte ou structure) existe-t-il sur cette arête, à cet étage ? */
export function edgeExists(scene: Scene, x: number, y: number, side: Edge4, z: number): boolean {
  const c = canonical(x, y, side);
  return (scene.walls ?? []).some((w) => (w.z ?? 0) === z && w.side === c.side && w.x === c.x && w.y === c.y);
}

/** Index `x,y,z → zone DESCRIPTIVE` (nom de pièce, `isDescriptiveZone`) pour tout étage — lookup O(1). */
export function descriptiveZoneIndex(scene: Scene): Map<string, SceneEffectZone> {
  const index = new Map<string, SceneEffectZone>();
  for (const zone of scene.effectZones ?? []) {
    if (!isDescriptiveZone(zone)) continue;
    for (const tile of sceneZoneTiles(zone)) index.set(`${tile.x},${tile.y},${tile.z ?? zone.z ?? 0}`, zone);
  }
  return index;
}
