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
  /** VOLUME de l'avant-toit (le toit DÉBORDE des murs, il ne pose plus à ras). Géométrie ADDITIVE émise
   *  par le builder (`roofPans`) sur chaque ÉGOUT, colorée ici :
   *  - `eaveOverhangM` : longueur du SOFFITE en CASES (run le long de la pente au-delà de l'égout ; le
   *    bord extérieur descend de `eaveOverhangM × ROOF_SLOPE_M` → soffite COPLANAIRE au pan). Absent ⇒
   *    aucun débord ;
   *  - `soffite` : ton du DESSOUS débordant (uniforme, ombré — un dessous ne capte pas la lumière du ciel) ;
   *  - `fasciaDropM` : hauteur de la planche de rive VERTICALE pendant du bord extérieur du soffite.
   *    Absent ⇒ pas de fascia dure (bord arrondi, ex. chaume) ;
   *  - `fascia` : ton de la fascia (sombre — c'est l'ombre sous l'avant-toit qui « détache » le toit du mur) ;
   *  - `fasciaThickM` : ÉPAISSEUR de cette planche de rive, pour le backend VOLUMIQUE qui en fait une
   *    boîte mince centrée sur son plan (le backend affine l'ignore : il peint un quad d'écran). Absent ⇒
   *    `FASCIA_THICK_M` ;
   *  - `ridgeCap` : liseré CLAIR du couronnement de FAÎTE (rendu par un trait de faîte renforcé au backend). */
  eaveOverhangM?: number;
  soffite?: string;
  fasciaDropM?: number;
  fasciaThickM?: number;
  fascia?: string;
  ridgeCap?: string;
}
