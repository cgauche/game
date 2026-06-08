/** Terrain UNIFIÉ (registre defs/) : méta sémantique (walkable/priority — PUR, lu par la
 *  walkability) + présentation (gradient/swatch — données, lues par le rendu). `TERRAINS`
 *  (côté state) et `TERRAIN_VIZ` (côté catalog gameIso) dérivent du même `TerrainDef`. */
export interface TerrainMeta {
  id: string;
  label: string;
  walkable: boolean;
  /** Précédence de raccord d'arêtes : un terrain de priorité plus haute « déborde »
   *  sur ses voisins de priorité plus basse (façon crossers NWN). */
  priority: number;
}

export interface TerrainDef extends TerrainMeta {
  /** id du <linearGradient> dans DEFS (présentation). */
  gradient: string;
  /** couleur d'aperçu (palette éditeur). */
  swatch: string;
}
