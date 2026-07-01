/** Apparence de RENDU des toits (matériau de couverture iso : teintes par orientation de PENTE +
 *  liseré/rangs de tuiles ; et « plan » vu du dessus en vue carrée). Donnée pure
 *  (`src/data/roofMaterials.json`) : le renderer ne porte aucun littéral de couleur — l'identité du
 *  matériau vient d'ici. */
import type { DetailRecipe } from '../../detail/types';

export interface RoofMaterialDef {
  id: string;
  /** Recette de détail de surface (rangs de tuiles/bardeaux, mouchetis — Lot 0, consommée au Lot 4). */
  detail?: DetailRecipe;
  /** Teintes de pente iso par orientation d'AVANT-TOIT (N/E/S/O) + liseré de rang (`line`) et couleur/
   *  nombre de rangs de tuiles (`course`/`courses`). Présents pour les matériaux de couverture. */
  N?: string;
  E?: string;
  S?: string;
  O?: string;
  line?: string;
  course?: string;
  courses?: number;
  /** Plan du toit vu du dessus (vue carrée) : corps, liseré, cadre intérieur, texte du nom. */
  planBody?: string;
  planEdge?: string;
  planInner?: string;
  planText?: string;
}
