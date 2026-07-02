import type { DetailRecipe } from '../../gameIso/detail/types';

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
  /** Recette de détail de surface (dallage/mouchetis — Lot 0, consommée au Lot 4). Import TYPE-only :
   *  la walkability (côté state) n'en lit rien, seul le rendu la consommera. */
  detail?: DetailRecipe;
  /** id du <linearGradient> dans DEFS (présentation). */
  gradient: string;
  /** couleur d'aperçu (palette éditeur). */
  swatch: string;
  /** Arrêts du dégradé (présentation) — source unique avec `swatch`. */
  stops: { off: string; color: string }[];
  /** DÉCOR posé en BILLBOARD sur chaque tuile du terrain (ref de `props.json`) — rendu par le chemin
   *  billboard PARTAGÉ (`propSvg`) dans les DEUX backends : iso/éditeur ET POV. Ex. `bois → 'arbre'`.
   *  PRÉSENTATION pure : la physique combat du terrain (walkable/opaque/cover) ne change pas. */
  overlayProp?: string;
  /** Le terrain est un BLOC PLEIN de cette hauteur (mètres). Sa hauteur d'AFFICHAGE (`buildFloors`) vaut
   *  `heightAt + solidHeightM` → faces verticales + dessus dérivés du relief EXISTANT, dans les 2 backends.
   *  N'entre QUE dans le rendu — `heightAt` (vérité combat) reste inchangé. Le bloc s'AJOUTE à la hauteur
   *  propre de la tuile (opéra : mur à un étage). Ex. `mur → ~WALL_H_M`. */
  solidHeightM?: number;
}
