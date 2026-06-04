/** Présentation des terrains (joint à src/state/terrain.ts par id). */
export interface TerrainViz {
  id: string;
  gradient: string; // id du <linearGradient> dans DEFS
  swatch: string; // couleur d'aperçu (palette éditeur)
}
export const TERRAIN_VIZ: Record<string, TerrainViz> = {
  herbe: { id: 'herbe', gradient: 'g_grass', swatch: '#3d6630' },
  terre: { id: 'terre', gradient: 'g_terre', swatch: '#6b5436' },
  bois: { id: 'bois', gradient: 'g_grass', swatch: '#2f4d20' },
  route: { id: 'route', gradient: 'g_route', swatch: '#8a744c' },
  sol: { id: 'sol', gradient: 'g_sol', swatch: '#5b4d40' },
  dalle: { id: 'dalle', gradient: 'g_dalle', swatch: '#8d8a86' },
  pave: { id: 'pave', gradient: 'g_pave', swatch: '#7c7a82' },
  plancher: { id: 'plancher', gradient: 'g_plancher', swatch: '#7a5a30' },
  eau: { id: 'eau', gradient: 'g_eau', swatch: '#2f5a8a' },
  mur: { id: 'mur', gradient: 'g_sol', swatch: '#9b8e72' },
  porte: { id: 'porte', gradient: 'g_porte', swatch: '#7a5a3a' },
};
export const FALLBACK_GRADIENT = 'g_grass';
export function terrainGradient(id: string): string {
  return TERRAIN_VIZ[id]?.gradient ?? FALLBACK_GRADIENT;
}
