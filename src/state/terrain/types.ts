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
  /** Bloque la Ligne de Vue (mur de pierre, porte) — lu par `lineOfSightCover` (couvert total,
   *  brouillard). Absent = transparent. */
  opaque?: boolean;
}

export interface TerrainDef extends TerrainMeta {
  /** id du <linearGradient> dans DEFS (présentation). */
  gradient: string;
  /** couleur d'aperçu (palette éditeur). */
  swatch: string;
  /** Arrêts du dégradé (présentation) — source unique avec `swatch`. */
  stops: { off: string; color: string }[];
}
