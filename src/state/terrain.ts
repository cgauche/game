/** Registre PUR des terrains (sémantique : walkability + précédence de raccord).
 *  Présentation (gradient/swatch) → src/gameIso/catalog/terrain.ts, joint par id. */
export interface TerrainMeta {
  id: string;
  label: string;
  walkable: boolean;
  /** Précédence de raccord d'arêtes : un terrain de priorité plus haute « déborde »
   *  sur ses voisins de priorité plus basse (façon crossers NWN). */
  priority: number;
}

export const TERRAINS: Record<string, TerrainMeta> = {
  herbe: { id: 'herbe', label: 'Herbe', walkable: true, priority: 1 },
  terre: { id: 'terre', label: 'Terre battue', walkable: true, priority: 2 },
  bois: { id: 'bois', label: 'Sous-bois', walkable: false, priority: 1 },
  route: { id: 'route', label: 'Chemin', walkable: true, priority: 3 },
  sol: { id: 'sol', label: 'Sol nu', walkable: true, priority: 2 },
  dalle: { id: 'dalle', label: 'Dallage', walkable: true, priority: 4 },
  pave: { id: 'pave', label: 'Pavés', walkable: true, priority: 5 },
  plancher: { id: 'plancher', label: 'Plancher', walkable: true, priority: 4 },
  eau: { id: 'eau', label: 'Eau', walkable: false, priority: 0 },
  mur: { id: 'mur', label: 'Mur', walkable: false, priority: 9 },
  porte: { id: 'porte', label: 'Porte', walkable: true, priority: 9 },
};

export function terrainWalkable(id: string): boolean {
  return TERRAINS[id]?.walkable ?? false;
}
export function terrainPriority(id: string): number {
  return TERRAINS[id]?.priority ?? 0;
}
