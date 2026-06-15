/**
 * Catalogue de décors (placeables NWN) — DÉRIVÉ du registre `defs/` (gen-registry.mjs).
 * Ajouter un décor = déposer `defs/<id>.ts` (`export const prop: PropViz = { id, label, render, … }`)
 * puis `npm run gen` (auto en dev via le plugin Vite). Plus de `Record` à maintenir à la main.
 * Chaque `render` renvoie un SVG en boîte locale 120×150, pieds en (60,150).
 */
import type { PropViz } from '../types';
import type { Facing } from '../../../state/scene';
import { PROP_DEFS } from './_registry.generated';

export const PROPS: Record<string, PropViz> = Object.fromEntries(PROP_DEFS.map((p) => [p.id, p]));

/** SVG d'un décor. `facing` (orientation d'auteur) est transmis au `render` — un prop qui a un AVANT/
 *  ARRIÈRE (sièges) s'en sert ; les autres l'ignorent. (Le décor reste un billboard : pas de rotation
 *  caméra, donc l'orientation est BAKÉE au rendu.) */
export function propSvg(ref: string, facing?: Facing): string {
  return (PROPS[ref] ?? PROPS.tonneau).render({}, { dims: { w: 0, h: 0 }, facing });
}
