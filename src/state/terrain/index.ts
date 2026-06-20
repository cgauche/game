/**
 * Terrains — DÉRIVÉ du registre `defs/` (gen-registry.mjs). Ajouter un terrain = déposer
 * `defs/<id>.ts` (`export const terrain: TerrainDef = { …, gradient, swatch }`) puis `npm run gen`
 * (auto en dev). `TERRAINS` (méta sémantique PURE, pour la walkability/raccord) ET `TERRAIN_VIZ`
 * (gradient/swatch, côté `gameIso/catalog/terrain`) dérivent du MÊME `TerrainDef`.
 */
import type { TerrainMeta } from './types';
import { TERRAIN_DEFS } from './_registry.generated';

export type { TerrainMeta, TerrainDef } from './types';
export { TERRAIN_DEFS } from './_registry.generated';

export const TERRAINS: Record<string, TerrainMeta> = Object.fromEntries(
  TERRAIN_DEFS.map((t) => [t.id, { id: t.id, label: t.label, walkable: t.walkable, priority: t.priority, opaque: t.opaque }]),
);

export function terrainWalkable(id: string): boolean {
  return TERRAINS[id]?.walkable ?? false;
}
export function terrainPriority(id: string): number {
  return TERRAINS[id]?.priority ?? 0;
}
