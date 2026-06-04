import type { Dims } from '../iso';
import type { BuildingParams } from '../../state/scene';

export type ParamField =
  | { key: string; label: string; type: 'number'; min?: number; max?: number; step?: number }
  | { key: string; label: string; type: 'select'; options: { value: string; label: string }[] }
  | { key: string; label: string; type: 'color' };

export interface RenderCtx {
  dims: Dims;
}
export type Rect = { x: number; y: number; w: number; h: number };

/** 3 calques distincts → permet de masquer le toit seul (cutaway). */
export interface BuildingLayers {
  walls: string;
  interior: string;
  roof: string;
}

export interface BuildingViz {
  id: string;
  paramsSchema?: ParamField[];
  render(foot: Rect, params: BuildingParams, ctx: RenderCtx): BuildingLayers;
}

export interface PropViz {
  id: string;
  label: string;
  paramsSchema?: ParamField[];
  render(params: Record<string, unknown>, ctx: RenderCtx): string;
}
