/**
 * Recette de DÉTAIL de surface (Lot 0 refonte rendu) — appareillage de pierre, bardeaux, colombage,
 * plinthes/arases, mouchetis. DONNÉE PURE portée par les defs d'apparence (`StructureAppearanceDef`,
 * `RoofMaterialDef`, `ReliefMaterialDef`, `TerrainDef`) via leur champ optionnel `detail`.
 *
 * `expandRecipe` (expand.ts) déplie la recette en primitives UV en ESPACE DE FACE [0,1]² (+ mètres pour
 * les épaisseurs), consommées par les TROIS backends : `backends/affineDetail.ts` (iso écran),
 * `pov/geometry.ts` (perspective) et `backends/webgl/faceBake.ts` (cuisson par face du rendu
 * volumique) ; le tracé de PÉRIODE (`detail/courses.ts`) a les mêmes trois consommateurs
 * (`affineDetail`, `pov/geometry`, `backends/webgl/periodTexture.ts`). Chaque backend rasterise à sa
 * résolution, les vues retombent sur le MÊME détail parce que le seed est dérivé de l'identité MONDE
 * (`hash32`, jamais stocké).
 *
 * Convention UV : u ∈ [0,1] le long de la face (gauche→droite), v ∈ [0,1] du HAUT (0) vers le BAS (1).
 * Les dimensions physiques (`hM`, `jointW`, `wM`, `rM`…) sont en MÈTRES : l'expansion les convertit en
 * fractions via la taille réelle de la face (`faceWM`/`faceHM`), donc une même recette produit des
 * pierres de même taille sur un mur de 2 m et un rempart de 6 m.
 */
export interface DetailRecipe {
  /** Rangs horizontaux (assises de pierre, bardeaux, planches). */
  courses?: {
    /** Hauteur d'un rang (m). */
    hM: number;
    /** Couleur du joint (lignes de rangs + verticales entre blocs). */
    joint: string;
    /** Épaisseur du joint (m) — rendue par le backend, pas convertie en UV. */
    jointW: number;
    /** Décalage horizontal des blocs d'un rang sur l'autre (appareillage), en fraction de la
     *  largeur moyenne de bloc [0,1]. Sans effet si `blockWM` absent. */
    stagger?: number;
    /** Largeur de pierre min/max (m) ; absent = rang CONTINU (bardeau/planche, pas de blocs). */
    blockWM?: [number, number];
    /** Amplitude (m) du tremblé des lignes de joint (bornes de rangs) — borné, jamais d'inversion. */
    edgeWobble?: number;
    /** Variation de teinte par bloc ∈ [0,1] — le backend module la couleur de face par `shade`. */
    paletteVar?: number;
  };
  /** Bandes horizontales pleines (plinthe, arase, bandeau) : `atV` = CENTRE de la bande ∈ [0,1]
   *  (0 = haut de la face, 1 = bas), `hM` = hauteur (m). */
  bands?: { atV: number; hM: number; color: string }[];
  /** Colombage : poteaux verticaux tous les `postEveryM` mètres + écharpes en X ou en V par travée. */
  timber?: { postEveryM: number; braces?: 'X' | 'V'; wM: number; color: string };
  /** Mouchetis (lichen, salissure, silex) : densité par m², rayon (m) min/max, palette tirée au seed.
   *  `vBias` > 0 tasse les taches vers le BAS de la face (usure/salissure au pied ; 0 = uniforme). */
  speckle?: { perM2: number; rM: [number, number]; colors: string[]; vBias?: number };
  /** Touffes d'herbe / brins (sol) : densité par m², hauteur de brin (m) min/max, palette tirée au seed. */
  tufts?: { perM2: number; hM: [number, number]; colors: string[] };
  /** Variance de TEINTE de la surface entière ∈ [0,1] par unité de seed (tuile/face) — tue l'uniformité
   *  d'un aplat répété : le backend module le fill de base par `shade(base, 1 ± tintVar)`. */
  tintVar?: number;
  /** Portée de l'IDENTITÉ du seed — dit à l'APPELANT quoi hasher (le seed n'est jamais stocké) :
   *  'edge' = par arête de mur (x,y,z,side), 'tile' = par tuile (x,y,z), 'instance' = par instance
   *  (bâtiment/structure entière : même détail sur toutes ses faces). */
  seedScope: 'edge' | 'tile' | 'instance';
}
