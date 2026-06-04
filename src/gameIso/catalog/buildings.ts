import { tileCenter, TW, TH } from '../iso';
import type { BuildingViz, BuildingLayers, RenderCtx, Rect, ParamField } from './types';
import type { BuildingParams } from '../../state/scene';

/** Coins écran (sol) de l'empreinte : grand losange N-E-S-O. */
function footCorners(foot: Rect, ctx: RenderCtx) {
  const n = tileCenter(foot.x, foot.y, ctx.dims);
  const e = tileCenter(foot.x + foot.w - 1, foot.y, ctx.dims);
  const s = tileCenter(foot.x + foot.w - 1, foot.y + foot.h - 1, ctx.dims);
  const o = tileCenter(foot.x, foot.y + foot.h - 1, ctx.dims);
  return {
    N: [n.cx, n.cy - TH / 2],
    E: [e.cx + TW / 2, e.cy],
    S: [s.cx, s.cy + TH / 2],
    O: [o.cx - TW / 2, o.cy],
  };
}
const up = (p: number[], h: number) => `${p[0]},${p[1] - h}`;
const pt = (p: number[]) => `${p[0]},${p[1]}`;

const ROOF_COLOR: Record<string, [string, string, string, string]> = {
  tuile: ['#8a3326', '#6a271e', '#7a2d22', '#511d16'],
  chaume: ['#9a7b3a', '#7a5f29', '#8a6c30', '#65501f'],
  ardoise: ['#4a5560', '#363f48', '#414c56', '#2c343b'],
};

/** Générateur paramétrique « maison à colombages ». */
const colombage: BuildingViz['render'] = (foot, params, ctx) => {
  const c = footCorners(foot, ctx);
  const floors = params.floors ?? 2;
  const H = 40 * floors; // hauteur de mur
  const timber = params.timberColor ?? '#4a3220';
  const wallC = params.wallColor ?? '#d8c9a8';
  const roof = ROOF_COLOR[params.roofMaterial ?? 'tuile'] ?? ROOF_COLOR.tuile;

  // murs avant : O→S (gauche) et S→E (droit), en élévation
  const walls =
    `<path d="M${pt(c.O)} L${pt(c.S)} L${up(c.S, H)} L${up(c.O, H)} Z" fill="${wallC}" stroke="${timber}" stroke-width="2"/>` +
    `<path d="M${pt(c.S)} L${pt(c.E)} L${up(c.E, H)} L${up(c.S, H)} Z" fill="${wallC}" stroke="${timber}" stroke-width="2" opacity="0.92"/>` +
    // colombage : poutres horizontales mi-hauteur + montants
    `<path d="M${up(c.O, H * 0.5)} L${up(c.S, H * 0.5)} L${up(c.E, H * 0.5)}" stroke="${timber}" stroke-width="3" fill="none" opacity="0.75"/>` +
    `<path d="M${up(c.S, 0)} L${up(c.S, H)}" stroke="${timber}" stroke-width="3" opacity="0.6"/>`;

  // intérieur (plancher) visible au cutaway
  const interior = `<path d="M${pt(c.N)} L${pt(c.E)} L${pt(c.S)} L${pt(c.O)} Z" fill="#3a2c1e" opacity="0.9"/>`;

  // toit : pyramide hippée au-dessus de H, apex au centre
  const apex = [(c.N[0] + c.S[0]) / 2, (c.N[1] + c.S[1]) / 2 - (H + 34)];
  const roofSvg =
    `<path d="M${up(c.O, H)} L${up(c.N, H)} L${pt(apex)} Z" fill="${roof[0]}"/>` +
    `<path d="M${up(c.N, H)} L${up(c.E, H)} L${pt(apex)} Z" fill="${roof[1]}"/>` +
    `<path d="M${up(c.O, H)} L${up(c.S, H)} L${pt(apex)} Z" fill="${roof[2]}"/>` +
    `<path d="M${up(c.S, H)} L${up(c.E, H)} L${pt(apex)} Z" fill="${roof[3]}"/>`;

  return { walls, interior, roof: roofSvg };
};

const HOUSE_SCHEMA: ParamField[] = [
  { key: 'floors', label: 'Étages', type: 'number', min: 1, max: 3, step: 1 },
  {
    key: 'roofMaterial',
    label: 'Toit',
    type: 'select',
    options: [
      { value: 'tuile', label: 'Tuiles' },
      { value: 'chaume', label: 'Chaume' },
      { value: 'ardoise', label: 'Ardoise' },
    ],
  },
  { key: 'timberColor', label: 'Colombage', type: 'color' },
  { key: 'wallColor', label: 'Torchis', type: 'color' },
];

export const BUILDINGS: Record<string, BuildingViz> = {
  maison: { id: 'maison', paramsSchema: HOUSE_SCHEMA, render: colombage },
};

export function buildingLayers(type: string, foot: Rect, params: BuildingParams, ctx: RenderCtx): BuildingLayers {
  const viz = BUILDINGS[type];
  if (!viz) return colombage(foot, params, ctx); // fallback = maison générique
  return viz.render(foot, params, ctx);
}
export type BuildingId = keyof typeof BUILDINGS;
