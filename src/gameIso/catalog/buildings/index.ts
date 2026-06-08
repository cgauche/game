/**
 * Catalogue des bâtiments — DÉRIVÉ du registre `defs/` (gen-registry.mjs).
 * Ajouter un bâtiment = déposer `defs/<id>.ts` (`export const building: BuildingDef = { …, render }`,
 * render composant les primitives de `render-helpers.ts`) puis `npm run gen` (auto en dev via le
 * plugin Vite). `BUILDINGS` (présentation) et `BUILDINGS_META` (méta sémantique, pour l'éditeur)
 * dérivent du même `BuildingDef` — fini les 2 fichiers monolithiques à tenir synchrones.
 */
import type { BuildingViz, BuildingLayers, RenderCtx, Rect } from '../types';
import type { BuildingMeta } from '../../../state/buildings';
import type { BuildingParams } from '../../../state/scene';
import { BUILDING_DEFS } from './_registry.generated';
import { colombage, footCorners, rotateFacing } from './render-helpers';

export { footCorners, rotateFacing } from './render-helpers';

export const BUILDINGS: Record<string, BuildingViz> = Object.fromEntries(
  BUILDING_DEFS.map((b) => [b.id, { id: b.id, paramsSchema: b.paramsSchema, render: b.render }]),
);

export const BUILDINGS_META: Record<string, BuildingMeta> = Object.fromEntries(
  BUILDING_DEFS.map((b) => [b.id, { id: b.id, label: b.label, category: b.category, defaultFoot: b.defaultFoot, defaultReveal: b.defaultReveal }]),
);

export function buildingLayers(type: string, foot: Rect, params: BuildingParams, ctx: RenderCtx): BuildingLayers {
  // La porte est posée selon une façade-monde ; on la tourne dans le repère écran courant.
  const rctx: RenderCtx = { ...ctx, facing: rotateFacing(ctx.facing, ctx.dims.rot ?? 0) };
  const viz = BUILDINGS[type];
  if (!viz) return colombage(foot, params, rctx); // fallback = maison générique
  return viz.render(foot, params, rctx);
}
export type BuildingId = keyof typeof BUILDINGS;
