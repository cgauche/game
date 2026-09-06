/**
 * TERRAINS DU MONDE (#1690) — vue TS de `terrains.json`, dataset UNIQUE des sols de la grille.
 *
 * UNE entrée porte la RÈGLE (franchissabilité, précédence de raccord, opacité, surface bâtie) ET le
 * RENDU (teinte d'aperçu, rampe de dégradé, recette de détail de surface, décor billboard, bloc
 * plein) dans la MÊME entrée : le terrain reste hors du dataset des matières (#1686) et porte le
 * sien.
 *
 * Le fichier porte UNE forme d'entrée (schéma `schemas/defs/terrains.ts`) : le handle de la fabrique
 * scelle ses nœuds (`z.infer` vaut `unknown`), aucun type n'est dérivé du schéma — la vue TS est
 * déclarée ici, comme `materials.types.ts`.
 */
import type { DetailRecipe } from '../gameIso/detail/types';

/** Un ARRÊT de la rampe de dégradé : offset en pourcentage (`0%`, `45%`, `100%`) → couleur `#rrggbb`.
 *  Record et non liste de paires : un offset ne se répète pas sur une rampe, et l'atelier édite un
 *  Record de texte là où une liste d'objets retombait sur l'éditeur JSON brut. */
export type TerrainStops = Record<string, string>;

/** MÉTA sémantique d'un terrain — ce que la walkability, le raccord d'arêtes et la Ligne de Vue
 *  lisent. Sous-ensemble PUR de l'entrée : aucune valeur de présentation. */
export interface TerrainMeta {
  id: string;
  label: string;
  /** Le terrain se traverse à pied (`terrainWalkable`). */
  walkable: boolean;
  /** Précédence de raccord d'arêtes : un terrain de priorité plus haute « déborde » sur ses voisins
   *  de priorité plus basse (façon crossers NWN). */
  priority: number;
  /** Bloque la Ligne de Vue (mur de pierre, porte) — lu par `lineOfSightCover` (couvert total,
   *  brouillard). Absent = transparent. */
  opaque?: boolean;
  /** Surface BÂTIE : construction qui PORTE l'étage posé dessus (plancher, dallage, pavage, bloc de
   *  maçonnerie). Absent = sol NU (naturel comme `herbe`/`terre`, ou `vide`) : un terrain déposé
   *  demain dans le dataset est donc du sol nu par défaut, et un étage posé dessus se signale
   *  (`map:check`, audit « étage sans appui ») au lieu de passer en silence. */
  built?: boolean;
}

/** L'ENTRÉE de `terrains.json` : la méta ci-dessus, l'enveloppe du document, et la présentation. */
export interface TerrainDef extends TerrainMeta {
  type: 'terrains';
  /** Provenance MAISON en clair — aucun folio n'imprime de catalogue de sols (`grammaire/document.ts`). */
  maison: string;
  /** Couleur d'aperçu (palette de l'éditeur, faces du monde volumique). */
  swatch: string;
  /** Arrêts du dégradé peint par le chemin AFFINE (SVG) — le volumique, lui, ne lit que `swatch`. */
  stops: TerrainStops;
  /** Recette de détail de surface (dallage/mouchetis/touffes), consommée par les deux backends. */
  detail?: DetailRecipe;
  /** DÉCOR posé en BILLBOARD sur chaque tuile du terrain (id de `props.json`) — rendu par le chemin
   *  billboard PARTAGÉ (`propSvg`) dans les DEUX backends : iso/éditeur ET POV. Ex. `bois → 'arbre'`.
   *  PRÉSENTATION pure : la physique combat du terrain (walkable/opaque/cover) ne change pas. */
  overlayProp?: string;
  /** Le terrain est un BLOC PLEIN de cette hauteur (mètres). Sa hauteur d'AFFICHAGE (`buildFloors`)
   *  vaut `heightAt + solidHeightM` → faces verticales + dessus dérivés du relief EXISTANT, dans les
   *  2 backends. N'entre QUE dans le rendu — `heightAt` (vérité combat) reste inchangé. Le bloc
   *  s'AJOUTE à la hauteur propre de la tuile (opéra : mur à un étage). */
  solidHeightM?: number;
}
