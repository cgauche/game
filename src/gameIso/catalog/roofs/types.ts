/** Apparence de RENDU des toits (matériau de couverture iso : teintes par orientation de PENTE +
 *  liseré/rangs de tuiles ; et « plan » vu du dessus en vue carrée). Donnée pure
 *  (`src/data/roofMaterials.json`) : le renderer ne porte aucun littéral de couleur — l'identité du
 *  matériau vient d'ici. */
import type { DetailRecipe } from '../../detail/types';

export interface RoofMaterialDef {
  id: string;
  /** Recette de détail de COUVERTURE (matériaux v2) : `courses` = les rangs (le pas `hM` fixe leur
   *  espacement — source unique builder/backend — `joint` leur couleur ; `blockWM`+`stagger`+
   *  `paletteVar` = bardeaux décalés nuancés ; `edgeWobble` seul = rangs organiques type chaume) ;
   *  `tufts` = balayage de brins le long de la pente (paille). */
  detail?: DetailRecipe;
  /** Teintes de pente iso par orientation d'AVANT-TOIT (N/E/S/O) + liseré de STRUCTURE (`line` :
   *  faîte/arêtiers/égouts). Présents pour les matériaux de couverture. */
  N?: string;
  E?: string;
  S?: string;
  O?: string;
  line?: string;
  /** Plan du toit vu du dessus (vue carrée) : corps, liseré, cadre intérieur, texte du nom. */
  planBody?: string;
  planEdge?: string;
  planInner?: string;
  planText?: string;
}
