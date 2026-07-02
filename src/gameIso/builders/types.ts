/**
 * PIVOT du rendu — « une scène, une apparence, N projections ».
 * Les BUILDERS (`builders/`) dérivent la scène en ÉLÉMENTS SÉMANTIQUES en espace MONDE ; les BACKENDS
 * (écran-affine iso/edge-on/top, perspective POV) les projettent et les dessinent. Un builder n'importe
 * NI `Dims` NI caméra : sa sortie mémoïsée survit à toute rotation/projection (contrat de perf du stage),
 * et le POV n'hérite d'aucun concept d'écran.
 */

/** Point MONDE : (x,y) en unités de GRILLE continues (coins de case à ±0.5), `h` en MÈTRES.
 *  Jamais de rotation ni d'écran ici — backend affine : `tileCenter(x, y, dims, metricToLift(h))` ;
 *  backend perspective : `{ x·mpt, y·mpt, h }`. */
export interface GP {
  x: number;
  y: number;
  h: number;
}

/** Plan porteur d'une face. La base UV n'est PAS stockée : chaque backend la dérive de
 *  `poly[0]→poly[1]` + `plane` (une base stockée dériverait). */
export type FacePlane = 'ground' | 'vertical' | 'slope';

/** Référence de MATÉRIAU (donnée JSON) — jamais une couleur. `part` distingue les faces d'un même
 *  matériau qui se dessinent différemment (falaise/rampe/tablier/pilier de relief, wedge de terrain). */
export interface MaterialRef {
  domain: 'terrain' | 'relief' | 'structure' | 'roof';
  id: string;
  part?: string;
}

/** Référence de recette de détail (matériaux v2) — posée dès le pivot pour fixer le contrat. */
export interface DetailRef {
  id: string;
}

/** Arête cardinale d'une case, côté MONDE (N = vers y−1, E = vers x+1…). */
export type CellSide = 'N' | 'E' | 'S' | 'O';

export interface Face {
  poly: GP[];
  plane: FacePlane;
  material: MaterialRef;
  /** Arête de la case qui porte la face (relief/wedge/mur) — les backends en dérivent l'orientation
   *  (arête écran en affine, normale en perspective) sans re-scanner la scène. */
  side?: CellSide;
  detail?: DetailRef;
}

/** VÉRITÉS DE SCÈNE d'un élément (camera-free) — calculées par les builders, consommées par TOUS les
 *  backends. La vérité de VUE (estompe d'occlusion, reveal au-dessus d'un acteur, assombrissement de
 *  l'étage inférieur) reste une DÉCORATION du stage/backend au dessin (opacité/filtre). */
export interface ElStates {
  /** Représente une chose actuellement VISIBLE → dessinée AU-DESSUS du voile de brouillard (fog
   *  sandwich). Sol ordinaire : false (le voile le grise) ; surplomb PLEIN : true (comme un mur). */
  visible: boolean;
  /** SURPLOMB : la case a une surface marchable sur une couche inférieure (tablier de pont / loge). */
  overhang?: boolean;
  /** Émis AU-DESSUS de l'étage actif → silhouette (l'appelant l'affiche translucide, sauf surplomb PLEIN). */
  ghost?: boolean;
  /** Surplomb PLEIN : fantôme dont la surface du dessous n'est PAS visible → rien à protéger, dessiné
   *  opaque comme la structure perçue (rempart en bord de carte) et au-dessus du voile. */
  solidOverhang?: boolean;
  /** Porte ouverte (arête franchissable). */
  open?: boolean;
  /** Structure abattue (brèche de siège). */
  down?: boolean;
  /** Toit dont l'empreinte est occupée par un allié (cutaway). */
  roofOccupied?: boolean;
}

/** Classe de TRI sémantique : chaque backend la mappe sur SA profondeur (affine : `depth(cell)` +
 *  offset de couche, cf. iso.ts ; perspective : peintre par centroïde). */
export type SortClass = 'floor' | 'wall' | 'roof' | 'prop' | 'token';

export interface ElBase {
  /** Clé STABLE d'identité MONDE (`floor:x,y,z`…) — clé React/DOM, survit aux frames et rotations. */
  key: string;
  /** Case d'ancrage. `z` = INDEX DE COUCHE (tri de profondeur), découplé de la hauteur métrique. */
  cell: { x: number; y: number; z: number };
  /** Empreinte (cases) d'un élément multi-cases (toit, prop 2×2) — profondeur au coin caméra-proche. */
  span?: { w: number; h: number };
  sortClass: SortClass;
  states: ElStates;
}

/** Élément à FACES (géométrie monde) : sol (relief/wedges compris), mur d'arête, toit. */
export interface FloorEl extends ElBase {
  kind: 'floor';
  sortClass: 'floor';
  faces: Face[];
}
export interface WallEl extends ElBase {
  kind: 'wall';
  sortClass: 'wall';
  faces: Face[];
}
export interface RoofEl extends ElBase {
  kind: 'roof';
  sortClass: 'roof';
  faces: Face[];
}
/** Élément BILLBOARD (zéro face) : le backend rend le SVG iso ancré aux pieds. */
export interface PropEl extends ElBase {
  kind: 'prop';
  sortClass: 'prop';
  ref: string;
}
export interface TokenEl extends ElBase {
  kind: 'token';
  sortClass: 'token';
  id: string;
}

export type SceneEl = FloorEl | WallEl | RoofEl | PropEl | TokenEl;
