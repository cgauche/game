/**
 * HIT-TEST DE SPRITE du stage (#1176, lot P2-3) — la COUTURE UNIQUE entre le pointeur et la voie de
 * rendu : « quel combattant est dessiné sous ce pixel ? ». Le pointeur (`useStagePointer.pickTile`)
 * pose la question ; la voie qui PEINT y répond, de la seule façon dont elle sait trancher son
 * empilement.
 *
 *  - voie AFFINE : hit-test natif du navigateur (`elementFromPoint` + `data-cid`) — l'élément peint
 *    en DERNIER sous le pixel gagne, c'est-à-dire le dernier du tri de profondeur (`stage/objs.ts`) ;
 *  - voie VOLUMIQUE : aucun jeton SVG ne porte plus de `data-cid` (la couche monde a quitté le SVG),
 *    et un canevas n'a pas d'arbre à interroger — `GameStage3D` INSCRIT ici un lanceur de rayon
 *    (`backends/webgl/spriteRaycast.ts`), dont le verdict est la DISTANCE CAMÉRA.
 *
 * Module PUR au sens des dépendances : aucun `three`, aucun store — le pointeur n'a donc pas à
 * connaître la voie de rendu pour lui poser la question. L'inscription d'un lanceur EST la bascule :
 * `GameStage3D` n'est monté qu'en volumique, et se désinscrit à son démontage.
 *
 * Ce module porte la MÊME couture pour le CADRE RENDU (`CadreRendu`) : l'hôte qui rend l'écran
 * (`stage/MondeDeCampagne.tsx`) publie TOUT ce que l'inversion d'un pixel lit — projection, caméra,
 * zoom — et la sonde de recette (`stage/pickProbe.ts`) le lit au lieu de le rebâtir depuis le store.
 * Rebâti, il divergeait sur ses TROIS termes : l'hôte pose `view: pov ? 'iso' : viewMode` et un
 * `yawDeg` LISSÉ (`viewYawDeg(shownRot, shownEdge)`, valeurs de rendu), là où le store nu ne connaît
 * ni la première personne ni le résidu sous-cran d'une rotation en cours ; et la caméra du rendu vit
 * dans une RÉF que la boucle d'images réécrit (focal, approche, panoramique en vol), là où
 * `store.camPan` vaut (0,0) tant que l'écran se contente de suivre le groupe. Deux poses, donc deux
 * cases, pour le même pixel — et sur un écran centré sur le groupe, aucune case du tout.
 */
import type { Dims } from '../../geometry/iso';
import type { PickResult } from '../backends/webgl/spriteRaycast';

/** Répondeur de la voie volumique : coordonnées CLIENT (celles d'un `PointerEvent`) → ce qui est visé. */
export type SpritePicker = (clientX: number, clientY: number) => PickResult;

let _picker: SpritePicker | null = null;

export function setSpritePicker(picker: SpritePicker | null): void {
  _picker = picker;
}

/** Une voie volumique répond-elle au hit-test ? (Le montage de `GameStage3D` en est la seule cause.) */
export function hasSpritePicker(): boolean {
  return _picker !== null;
}

/** Ce qui est dessiné sous le pixel — un COMBATTANT, une ENTITÉ de scène (décor volumique), ou `null`
 *  (sol visible, décor billboardé devant, hors monde). La voie affine ne peint que des jetons : son
 *  hit-test natif ne rend donc jamais d'entité. */
export function targetUnderPointer(clientX: number, clientY: number): PickResult {
  if (_picker) return _picker(clientX, clientY);
  const el = document.elementFromPoint(clientX, clientY) as Element | null;
  const cid = el?.closest('[data-cid]')?.getAttribute('data-cid');
  return cid ? { kind: 'combatant', id: cid } : null;
}

/** Ce que l'écran REND, et donc tout ce qu'il faut pour inverser un pixel jusqu'à sa case
 *  (`pickResolve.ts:pointStageSousPixel`). */
export interface CadreRendu {
  /** Projection COMMISE : celle du dernier rendu de l'hôte. */
  dims: Dims;
  /** Caméra du rendu courant, LUE À L'APPEL — un LECTEUR, jamais une copie : la boucle d'images la
   *  réécrit hors de React (focal, approche, glisser-caméra), et le geste lit lui aussi cette
   *  valeur-là à l'instant de l'événement (`useStagePointer`, `camRef.current`). */
  camRendue: () => { x: number; y: number };
  /** Zoom que le geste inverse (`useStagePointer`, prop `zoom`). */
  zoom: number;
}

let _cadre: CadreRendu | null = null;

/** L'hôte de rendu PUBLIE le cadre qu'il vient de commettre (`null` à son démontage). */
export function setStageFrame(cadre: CadreRendu | null): void {
  _cadre = cadre;
}

/** Le cadre que l'écran REND en ce moment, ou `null` si aucun hôte n'est monté. */
export function getStageFrame(): CadreRendu | null {
  return _cadre;
}
