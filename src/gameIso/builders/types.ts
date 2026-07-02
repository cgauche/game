/**
 * PIVOT du rendu — « une scène, une apparence, N projections ».
 * Les BUILDERS (`builders/`) dérivent la scène en ÉLÉMENTS SÉMANTIQUES en espace MONDE ; les BACKENDS
 * (écran-affine iso/edge-on/top, perspective POV) les projettent et les dessinent. Un builder n'importe
 * NI `Dims` NI caméra : sa sortie mémoïsée survit à toute rotation/projection (contrat de perf du stage),
 * et le POV n'hérite d'aucun concept d'écran.
 */

import type { WallSide } from '../../state/scene';

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
  /** Côté d'arête du segment (cardinal N/E ou diagonal `\`/`/`) — ombrage d'orientation MONDE (arête N
   *  dans l'ombre) et cases de profondeur du backend affine. */
  side: WallSide;
  /** Extrémités A,B de l'arête à la hauteur de BASE (mètres) — la vue du dessus SYMBOLIQUE (traits/
   *  glyphe de porte) se trace dessus sans re-scanner la scène. */
  ends: [GP, GP];
  /** Id d'apparence de structure (`wallApp`) : chaque backend résout les couleurs par `part` depuis la def. */
  appearance: string;
  /** Le segment porte une PORTE (vantail bois / corps de garde) — route la représentation 'top'. */
  door: boolean;
  faces: Face[];
}
/** Ligne SÉMANTIQUE d'un toit, en MONDE : faîte (crête horizontale), arêtier (crête/noue diagonale),
 *  égout (bord bas de la nappe), rang (rangée de tuiles le long de la pente). Les backends la stylent
 *  depuis la def du matériau (`line`/`course`) — le builder ne connaît que la géométrie. */
export type RoofLineKind = 'faite' | 'aretier' | 'egout' | 'rang';
export interface RoofLine {
  a: GP;
  b: GP;
  kind: RoofLineKind;
}
export interface RoofEl extends ElBase {
  kind: 'roof';
  sortClass: 'roof';
  /** Empreinte du toit (cases) — profondeur de tri au coin caméra-proche (`footprintDepth`). */
  span: { w: number; h: number };
  /** Matériau de couverture (id `RoofMaterialDef`) : chaque backend résout les teintes par `part`. */
  material: string;
  /** Étiquette du mode plan (vue du dessus / éditeur). */
  label: string;
  /** PANS CONTINUS : UNE face par pan (plane 'slope', part = orientation N/E/S/O de la pente
   *  DESCENDANTE) — plus aucune nappe par-cellule. */
  faces: Face[];
  lines: RoofLine[];
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
