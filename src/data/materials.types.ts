/**
 * MATIÈRES DU MONDE (#1686 lot 2) — vue TS de `materials.json`, dataset UNIQUE des matières de rendu.
 *
 * L'identité d'une matière est le couple (`domain`, `id`) ; l'id reste unique sur tout le périmètre
 * (`src/data/materials-identite.test.ts`), si bien qu'un homonyme se COMPOSE (`prop-ardoise` /
 * `toit-ardoise`) plutôt que de compter sur son domaine pour être séparable.
 *
 * Le fichier porte UNE forme d'entrée (schéma `schemas/defs/materials.ts` : toutes les clés de charge
 * optionnelles, la disjonction portée par un refine ⟺, patron `defs/oups.ts`). La VUE TS, elle, est
 * l'union DISCRIMINÉE ci-dessous : le handle de la fabrique scelle ses nœuds (`z.infer` vaut
 * `unknown`), aucun type n'est dérivé du schéma. Les trois types nommés que les catalogues de rendu
 * consomment sont les trois membres de cette union, servis par `Extract` sur `domain`.
 */
import type { DetailRecipe } from '../gameIso/detail/types';
import type { MaterialRef } from '../gameIso/builders/types';

/**
 * Domaines de matière que CE dataset porte — SOUS-ENSEMBLE des domaines de `MaterialRef`
 * (`src/gameIso/builders/types.ts`), vérifié PAR CONSTRUCTION : `satisfies` refuse à la compilation
 * un domaine que le pivot du rendu ne déclare pas. Les deux domaines restants sont hors du dataset et
 * le disent nommément dans `materials-identite.test.ts` : `terrain` vit en modules TS (#1690),
 * `structure` porte un dataset d'apparence composite qui RÉFÉRENCE des matières.
 */
export const DOMAINES_MATIERE = ['prop', 'roof', 'relief'] as const satisfies readonly MaterialRef['domain'][];
export type MaterialDomain = (typeof DOMAINES_MATIERE)[number];

/** Enveloppe commune à toute matière — la CHARGE commune est vide : chaque domaine peint autre chose. */
interface MatiereBase {
  id: string;
  type: 'materials';
  /** Nom d'auteur de la matière, affiché tel quel par les sélecteurs de l'éditeur. */
  label: string;
  domain: MaterialDomain;
}

/** Matière de RENDU des recettes volumiques de décor : couleur + réponse à la lumière. Aucune
 *  émission — une source lumineuse est un `light` de prop ou d'instance, jamais une matière. */
export interface PropMaterialData extends MatiereBase {
  domain: 'prop';
  color: string;
  roughness: number;
  metalness: number;
}

/** Apparence de RENDU des toits (matériau de couverture iso : teintes par orientation de PENTE +
 *  liseré/rangs de tuiles ; et « plan » vu du dessus en vue carrée). Le renderer ne porte aucun
 *  littéral de couleur — l'identité du matériau vient d'ici. */
export interface RoofMaterialDef extends MatiereBase {
  domain: 'roof';
  /** Ce matériau COUVRE-t-il un pan ? Seuls ceux-là sont posables sur une masse de toit (sélecteurs de
   *  l'éditeur, `state/validateScene`). Absent = entrée de rendu qui ne couvre rien : le plan vu du
   *  dessus n'a ni pente ni égout. UNE seule graphie : le champ vaut `true` ou il est ABSENT — le
   *  schéma refuse `false` (`src/data/schemas/defs/materials.ts`). */
  couverture?: true;
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

/** Apparence de RENDU du relief d'environnement (falaise/rampe/tablier/pilier iso, plafond POV) :
 *  le renderer ne porte aucun littéral de couleur — l'identité du matériau vient d'ici, la
 *  lumière/l'ombrage vient de `shade.ts`. */
export interface ReliefMaterialDef extends MatiereBase {
  domain: 'relief';
  /** Masse BÂTIE (maçonnerie, ouvrage) par opposition au relief NATUREL (talus, terre remuée) — même axe
   *  que `TerrainDef.built`. Absent = naturel. */
  built?: boolean;
  /** Recette de détail de surface (strates/joints/mouchetis) — consommée par les backends (iso + POV). */
  detail?: DetailRecipe;
  /** Face principale (claire/éclairée). */
  face: string;
  /** FALAISE : ombre de pied. */
  foot?: string;
  /** RAMPE : nez de pente éclairé (le pied est dérivé par ombrage). */
  slopeTop?: string;
  /** Facteur d'ombrage de la face/pied côté ombre (falaise/tablier). */
  shadeDark?: number;
}

/** UNE entrée de `materials.json`, discriminée par `domain`. */
export type MaterialEntry = PropMaterialData | RoofMaterialDef | ReliefMaterialDef;

/** L'entrée d'un domaine donné — `MatiereDe<'roof'>` = `RoofMaterialDef`. */
export type MatiereDe<D extends MaterialDomain> = Extract<MaterialEntry, { domain: D }>;
