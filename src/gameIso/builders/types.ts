/**
 * PIVOT du rendu — « une scène, une apparence, N projections ».
 * Les BUILDERS (`builders/`) dérivent la scène en ÉLÉMENTS SÉMANTIQUES en espace MONDE ; les BACKENDS
 * (écran-affine iso/edge-on/top, perspective POV) les projettent et les dessinent. Un builder n'importe
 * NI `Dims` NI caméra : sa sortie mémoïsée survit à toute rotation/projection (contrat de perf du stage),
 * et le POV n'hérite d'aucun concept d'écran.
 */

import type { SceneEntity, WallSide } from '../../state/scene';
import type { Combatant } from '../../engine/types';
import type { Dir8 } from '../../state/dir8';

/** Point MONDE : (x,y) en unités de GRILLE continues (coins de case à ±0.5), `h` en MÈTRES.
 *  Jamais de rotation ni d'écran ici — backend affine : `tileCenter(x, y, dims, metricToLift(h))` ;
 *  backend perspective : `{ x·mpt, y·mpt, h }`. */
export interface GP {
  x: number;
  y: number;
  h: number;
}

/** Référence de MATÉRIAU (donnée JSON) — jamais une couleur. `part` distingue les faces d'un même
 *  matériau qui se dessinent différemment (falaise/rampe/tablier/pilier de relief, wedge de terrain).
 *  L'orientation d'une face (sol/paroi/pente) est dérivée par chaque backend depuis `domain`+`part`
 *  (et `side`), pas stockée. */
export interface MaterialRef {
  domain: 'terrain' | 'relief' | 'structure' | 'roof';
  id: string;
  part?: string;
}

/** Arête cardinale d'une case, côté MONDE (N = vers y−1, E = vers x+1…). */
export type CellSide = 'N' | 'E' | 'S' | 'O';

export interface Face {
  poly: GP[];
  material: MaterialRef;
  /** Arête de la case qui porte la face (relief/wedge/mur) — les backends en dérivent l'orientation
   *  (arête écran en affine, normale en perspective) sans re-scanner la scène. */
  side?: CellSide;
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

export interface ElBase {
  /** Clé STABLE d'identité MONDE (`floor:x,y,z`…) — clé React/DOM, survit aux frames et rotations. */
  key: string;
  /** Case d'ancrage. `z` = INDEX DE COUCHE (tri de profondeur), découplé de la hauteur métrique. */
  cell: { x: number; y: number; z: number };
  /** Empreinte (cases) d'un élément multi-cases (toit, prop 2×2) — profondeur au coin caméra-proche. */
  span?: { w: number; h: number };
  states: ElStates;
}

/** Élément à FACES (géométrie monde) : sol (relief/wedges compris), mur d'arête, toit. */
export interface FloorEl extends ElBase {
  kind: 'floor';
  faces: Face[];
}
export interface WallEl extends ElBase {
  kind: 'wall';
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
/** Élément BILLBOARD (zéro face) : les DEUX backends rendent son SVG catalogue (`propSvg`) ancré aux pieds.
 *  `source` = ORIGINE (le rendu est identique) : 'entity' = prop de scène (fouillable, empreinte, facing,
 *  anim) ; 'terrain' = décor dérivé d'un terrain (`overlayProp`, ex. bois → arbre — 1×1, jamais fouillable). */
export interface PropEl extends ElBase {
  kind: 'prop';
  source: 'entity' | 'terrain';
  /** Id de dessin : ref de prop NORMALISÉE (défaut 'tonneau', la même partout — décor d'entité OU de terrain). */
  ref: string;
  /** Orientation MONDE d'auteur (props directionnels) — chaque backend la projette avec SA caméra. */
  facing?: Dir8;
  /** Géométrie d'empreinte du décor (décalage fractionnaire vers le centre + échelle au côté max). */
  foot: { offX: number; offY: number; scale: number };
  /** Anim CSS d'ambiance (calque fx du token). */
  fx?: string;
  /** Prop fouillable : l'affordance (halo/étincelle) est décidée côté stage (flags de jeu). */
  interact: boolean;
  /** Id de l'entité source (flags `__fouille_<id>`, clés d'affordance). Absent pour un overlay terrain. */
  entId?: string;
}
/** Le SUJET d'un token — la donnée d'identité que le stage transforme en corps React (pickBackend/
 *  BodyToken). La position INTERPOLÉE de marche est PAR-FRAME : elle reste au stage ; l'élément ne
 *  porte que la position LOGIQUE (`cell`) et les décisions de scène (filtres, ordre d'anneau héros). */
export type TokenSubjectEl =
  /** PNJ/créature d'AMBIANCE (ex-entityObjs) — `inBattle` : rendu estompé + non interactif. */
  | { kind: 'figurant'; ent: SceneEntity; enrolled: boolean; inBattle: boolean }
  /** Combattant (branche combat). `heroIndex` = ordinal d'anneau héros ; `overhang` = jeton de
   *  muraille rendu AU-DESSUS de la zone active (chemin de ronde vu d'en bas). */
  | { kind: 'combatant'; c: Combatant; heroIndex?: number; overhang: boolean }
  /** Couple monté (iso) : UN corps composite à la tuile/empreinte de la monture. */
  | { kind: 'mounted'; mount: Combatant; rider: Combatant };
export interface TokenEl extends ElBase {
  kind: 'token';
  id: string;
  subject: TokenSubjectEl;
}

export type SceneEl = FloorEl | WallEl | RoofEl | PropEl | TokenEl;
