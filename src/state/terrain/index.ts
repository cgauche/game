/**
 * Terrains — DÉRIVÉ du registre `defs/` (gen-registry.mjs). Ajouter un terrain = déposer
 * `defs/<id>.ts` (`export const terrain: TerrainDef = { …, gradient, swatch }`) puis `npm run gen`
 * (auto en dev). `TERRAINS` (méta sémantique PURE, pour la walkability/raccord) ET `TERRAIN_VIZ`
 * (gradient/swatch, côté `gameIso/catalog/terrain`) dérivent du MÊME `TerrainDef`.
 */
import type { TerrainMeta, TerrainDef } from './types';
import { TERRAIN_DEFS } from './_registry.generated';

export type { TerrainMeta, TerrainDef } from './types';
export { TERRAIN_DEFS } from './_registry.generated';

export const TERRAINS: Record<string, TerrainMeta> = Object.fromEntries(
  TERRAIN_DEFS.map((t) => [t.id, { id: t.id, label: t.label, walkable: t.walkable, priority: t.priority, opaque: t.opaque, built: t.built }]),
);

export function terrainWalkable(id: string): boolean {
  return TERRAINS[id]?.walkable ?? false;
}
export function terrainPriority(id: string): number {
  return TERRAINS[id]?.priority ?? 0;
}

/** Présentation (lue par les BUILDERS de rendu, jamais par la walkability/le combat). */
const DEF_BY_ID: Record<string, TerrainDef> = Object.fromEntries(TERRAIN_DEFS.map((t) => [t.id, t]));

/** Décor billboard posé sur chaque tuile du terrain (ref de `props.json`), ou undefined. Ex. `bois → 'arbre'`. */
export function terrainOverlayProp(id: string): string | undefined {
  return DEF_BY_ID[id]?.overlayProp;
}
/** Hauteur (m) du BLOC PLEIN d'un terrain (rendu seulement — s'ajoute à `heightAt` pour l'AFFICHAGE), 0 sinon. */
export function terrainSolidHeightM(id: string): number {
  return DEF_BY_ID[id]?.solidHeightM ?? 0;
}
