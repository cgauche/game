/** Présentation des terrains — DÉRIVÉE du registre unifié `state/terrain/defs/` (gradient/swatch).
 *  La méta sémantique (walkable/priority) vit côté state ; ici on n'expose que le visuel. */
import { TERRAIN_DEFS } from '../../state/terrain';

export interface TerrainViz {
  id: string;
  gradient: string; // id du <linearGradient> dans DEFS
  swatch: string; // couleur d'aperçu (palette éditeur)
}
export const TERRAIN_VIZ: Record<string, TerrainViz> = Object.fromEntries(
  TERRAIN_DEFS.map((t) => [t.id, { id: t.id, gradient: t.gradient, swatch: t.swatch }]),
);
export const FALLBACK_GRADIENT = 'g_grass';
export function terrainGradient(id: string): string {
  return TERRAIN_VIZ[id]?.gradient ?? FALLBACK_GRADIENT;
}
