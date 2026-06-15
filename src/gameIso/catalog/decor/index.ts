/**
 * Catalogue de décors (placeables NWN) — DÉRIVÉ du registre `defs/` (gen-registry.mjs).
 * Ajouter un décor = déposer `defs/<id>.ts` (`export const prop: PropViz = { id, label, render, … }`)
 * puis `npm run gen` (auto en dev via le plugin Vite). Plus de `Record` à maintenir à la main.
 * Chaque `render` renvoie un SVG en boîte locale 120×150, pieds en (60,150).
 */
import type { PropViz } from '../types';
import type { Dir8 } from '../../../state/dir8';
import type { Rot } from '../../iso';
import { PROP_DEFS } from './_registry.generated';

export const PROPS: Record<string, PropViz> = Object.fromEntries(PROP_DEFS.map((p) => [p.id, p]));

/** SVG d'un décor. `dir` (orientation MONDE d'auteur, Dir8) + `camRot` (cran caméra) sont transmis au
 *  render via `ctx.dir`/`ctx.dims.rot` — un prop directionnel (sièges) projette son orientation avec la
 *  caméra (helper `project`), donc il PIVOTE quand on tourne la vue ; les props symétriques l'ignorent. */
export function propSvg(ref: string, dir?: Dir8, camRot: Rot = 0): string {
  return (PROPS[ref] ?? PROPS.tonneau).render({}, { dims: { w: 0, h: 0, rot: camRot }, dir });
}
