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
 */

/** Répondeur de la voie volumique : coordonnées CLIENT (celles d'un `PointerEvent`) → id de combattant. */
export type SpritePicker = (clientX: number, clientY: number) => string | null;

let _picker: SpritePicker | null = null;

export function setSpritePicker(picker: SpritePicker | null): void {
  _picker = picker;
}

/** Une voie volumique répond-elle au hit-test ? (Le montage de `GameStage3D` en est la seule cause.) */
export function hasSpritePicker(): boolean {
  return _picker !== null;
}

/** Id du combattant dessiné sous le pixel, ou `null` (sol visible, décor devant, hors monde). */
export function cidUnderPointer(clientX: number, clientY: number): string | null {
  if (_picker) return _picker(clientX, clientY);
  const el = document.elementFromPoint(clientX, clientY) as Element | null;
  return el?.closest('[data-cid]')?.getAttribute('data-cid') ?? null;
}
