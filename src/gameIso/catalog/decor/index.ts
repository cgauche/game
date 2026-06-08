/**
 * Catalogue de décors (placeables NWN) — DÉRIVÉ du registre `defs/` (gen-registry.mjs).
 * Ajouter un décor = déposer `defs/<id>.ts` (`export const prop: PropViz = { id, label, render, … }`)
 * puis `npm run gen` (auto en dev via le plugin Vite). Plus de `Record` à maintenir à la main.
 * Chaque `render` renvoie un SVG en boîte locale 120×150, pieds en (60,150).
 */
import type { PropViz } from '../types';
import { PROP_DEFS } from './_registry.generated';

export const PROPS: Record<string, PropViz> = Object.fromEntries(PROP_DEFS.map((p) => [p.id, p]));

export function propSvg(ref: string): string {
  return (PROPS[ref] ?? PROPS.tonneau).render({}, { dims: { w: 0, h: 0 } });
}
