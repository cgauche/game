/**
 * Catalogue des bâtiments — DÉRIVÉ du registre `defs/` (gen-registry.mjs).
 * Ajouter un bâtiment = déposer `defs/<id>.ts` (`export const building: BuildingDef = { …, render }`,
 * render composant les primitives de `render-helpers.ts`) puis `npm run gen` (auto en dev via le
 * plugin Vite). `BUILDINGS` (présentation) et `BUILDINGS_META` (méta sémantique, pour l'éditeur)
 * dérivent du même `BuildingDef` — fini les 2 fichiers monolithiques à tenir synchrones.
 */
import type { BuildingViz, RoofStyle, RenderCtx, Rect, BuildingDef } from '../types';
import type { RoofParams } from '../../../state/scene';
import { BUILDING_DEFS } from './_registry.generated';
import { colombage, footCorners, rotateFacing } from './render-helpers';

export { footCorners, rotateFacing, roofFromCells, STYLE_MATERIAL } from './render-helpers';

export const BUILDINGS: Record<string, BuildingViz> = Object.fromEntries(
  BUILDING_DEFS.map((b) => [b.id, { id: b.id, paramsSchema: b.paramsSchema, render: b.render }]),
);

/** Méta sémantique d'un bâtiment pour l'éditeur (libellé d'outil, empreinte par défaut à la pose) :
 *  la part non-rendu du `BuildingDef`. */
export type BuildingMeta = Pick<BuildingDef, 'id' | 'label' | 'defaultFoot'>;

export const BUILDINGS_META: Record<string, BuildingMeta> = Object.fromEntries(
  BUILDING_DEFS.map((b) => [b.id, { id: b.id, label: b.label, defaultFoot: b.defaultFoot }]),
);

export function buildingLayers(type: string, foot: Rect, params: RoofParams, ctx: RenderCtx): RoofStyle {
  // La porte est posée selon une façade-monde ; on la tourne dans le repère écran courant.
  const rctx: RenderCtx = { ...ctx, facing: rotateFacing(ctx.facing, ctx.dims.rot ?? 0) };
  const viz = BUILDINGS[type];
  if (!viz) return colombage(foot, params, rctx); // fallback = maison générique
  return viz.render(foot, params, rctx);
}
export type BuildingId = keyof typeof BUILDINGS;
