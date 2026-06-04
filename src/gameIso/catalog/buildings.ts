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
    N: [n.cx, n.cy - TH / 2] as number[],
    E: [e.cx + TW / 2, e.cy] as number[],
    S: [s.cx, s.cy + TH / 2] as number[],
    O: [o.cx - TW / 2, o.cy] as number[],
  };
}
type Corners = ReturnType<typeof footCorners>;
const up = (p: number[], h: number) => `${p[0]},${p[1] - h}`;
const pt = (p: number[]) => `${p[0]},${p[1]}`;
/** Point décalé vers le haut, gardé en nombres (pas de round-trip via string). */
const upXY = (p: number[], h: number): [number, number] => [p[0], p[1] - h];
const mid = (a: number[], b: number[]) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];

// --- Helpers de calques partagés ------------------------------------------
function wallFaces(c: Corners, H: number, wallC: string, edge: string): string {
  return (
    `<path d="M${pt(c.O)} L${pt(c.S)} L${up(c.S, H)} L${up(c.O, H)} Z" fill="${wallC}" stroke="${edge}" stroke-width="2"/>` +
    `<path d="M${pt(c.S)} L${pt(c.E)} L${up(c.E, H)} L${up(c.S, H)} Z" fill="${wallC}" stroke="${edge}" stroke-width="2" opacity="0.9"/>`
  );
}
function floorInterior(c: Corners): string {
  return `<path d="M${pt(c.N)} L${pt(c.E)} L${pt(c.S)} L${pt(c.O)} Z" fill="#3a2c1e" opacity="0.9"/>`;
}
function hipRoof(c: Corners, H: number, roofH: number, col: [string, string, string, string]): string {
  const apex = [(c.N[0] + c.S[0]) / 2, (c.N[1] + c.S[1]) / 2 - (H + roofH)];
  return (
    `<path d="M${up(c.O, H)} L${up(c.N, H)} L${pt(apex)} Z" fill="${col[0]}"/>` +
    `<path d="M${up(c.N, H)} L${up(c.E, H)} L${pt(apex)} Z" fill="${col[1]}"/>` +
    `<path d="M${up(c.O, H)} L${up(c.S, H)} L${pt(apex)} Z" fill="${col[2]}"/>` +
    `<path d="M${up(c.S, H)} L${up(c.E, H)} L${pt(apex)} Z" fill="${col[3]}"/>`
  );
}

const ROOF: Record<string, [string, string, string, string]> = {
  tuile: ['#8a3326', '#6a271e', '#7a2d22', '#511d16'],
  chaume: ['#9a7b3a', '#7a5f29', '#8a6c30', '#65501f'],
  ardoise: ['#4a5560', '#363f48', '#414c56', '#2c343b'],
};
const roofOf = (p: BuildingParams) => ROOF[p.roofMaterial ?? 'tuile'] ?? ROOF.tuile;

// --- Générateurs ----------------------------------------------------------
const colombage: BuildingViz['render'] = (foot, params, ctx) => {
  const c = footCorners(foot, ctx);
  const H = 40 * (params.floors ?? 2);
  const timber = params.timberColor ?? '#4a3220';
  const wallC = params.wallColor ?? '#d8c9a8';
  const walls =
    wallFaces(c, H, wallC, timber) +
    `<path d="M${up(c.O, H * 0.5)} L${up(c.S, H * 0.5)} L${up(c.E, H * 0.5)}" stroke="${timber}" stroke-width="3" fill="none" opacity="0.75"/>` +
    `<path d="M${pt(c.S)} L${up(c.S, H)}" stroke="${timber}" stroke-width="3" opacity="0.55"/>`;
  return { walls, interior: floorInterior(c), roof: hipRoof(c, H, 34, roofOf(params)) };
};

const taverne: BuildingViz['render'] = (foot, params, ctx) => {
  const c = footCorners(foot, ctx);
  const H = 40 * (params.floors ?? 2);
  const base = colombage(foot, params, ctx); // colombage applique déjà floors ?? 2
  // enseigne suspendue qui se balance (à mi-hauteur du mur droit)
  const m = mid(c.S, c.E);
  const sign =
    `<g class="sway" style="transform-box:fill-box;transform-origin:${m[0]}px ${m[1] - H * 0.6}px">` +
    `<line x1="${m[0]}" y1="${m[1] - H * 0.62}" x2="${m[0]}" y2="${m[1] - H * 0.42}" stroke="#2a1c10" stroke-width="2"/>` +
    `<rect x="${m[0] - 11}" y="${m[1] - H * 0.42}" width="22" height="16" rx="2" fill="#6e3b1e" stroke="#d8a93b" stroke-width="1.5"/>` +
    `</g>`;
  return { ...base, walls: base.walls + sign };
};

const forge: BuildingViz['render'] = (foot, params, ctx) => {
  const c = footCorners(foot, ctx);
  const H = 38 * (params.floors ?? 1);
  const walls = wallFaces(c, H, params.wallColor ?? '#8a8378', '#4d4a44');
  // cheminée + fumée animée (coin E)
  const e = upXY(c.E, H);
  const ch = [e[0] - 10, e[1] - 6];
  const chimney =
    `<rect x="${ch[0] - 6}" y="${ch[1] - 26}" width="14" height="30" fill="#5a5048" stroke="#2e2a25"/>` +
    `<g class="smoke" style="transform-box:fill-box;transform-origin:${ch[0]}px ${ch[1] - 26}px">` +
    `<circle cx="${ch[0]}" cy="${ch[1] - 30}" r="7" fill="#cfc8bf" opacity="0.5"/>` +
    `<circle cx="${ch[0] + 4}" cy="${ch[1] - 40}" r="9" fill="#bcb4a9" opacity="0.4"/></g>`;
  return { walls: walls + chimney, interior: floorInterior(c), roof: hipRoof(c, H, 22, ROOF.ardoise) };
};

const echoppe: BuildingViz['render'] = (foot, params, ctx) => {
  const c = footCorners(foot, ctx);
  const H = 34;
  const walls = wallFaces(c, H, params.wallColor ?? '#cdbd98', params.timberColor ?? '#5a3f24');
  // auvent rayé en façade (au-dessus de O→S)
  const a = upXY(c.O, H * 0.5);
  const b = upXY(c.S, H * 0.5);
  const awning = `<path d="M${pt(a)} L${pt(b)} L${b[0]},${b[1] + 16} L${a[0]},${a[1] + 16} Z" fill="#a8423a" opacity="0.85"/>`;
  return { walls: walls + awning, interior: floorInterior(c), roof: hipRoof(c, H, 18, roofOf(params)) };
};

const chapelle: BuildingViz['render'] = (foot, params, ctx) => {
  const c = footCorners(foot, ctx);
  const H = 70;
  const walls = wallFaces(c, H, params.wallColor ?? '#b9b2a4', '#6a655c');
  const apex = [(c.N[0] + c.S[0]) / 2, (c.N[1] + c.S[1]) / 2 - (H + 64)];
  const cross =
    `<line x1="${apex[0]}" y1="${apex[1]}" x2="${apex[0]}" y2="${apex[1] - 20}" stroke="#d8c27a" stroke-width="3"/>` +
    `<line x1="${apex[0] - 7}" y1="${apex[1] - 14}" x2="${apex[0] + 7}" y2="${apex[1] - 14}" stroke="#d8c27a" stroke-width="3"/>`;
  return { walls, interior: floorInterior(c), roof: hipRoof(c, H, 64, ROOF.ardoise) + cross };
};

const tour: BuildingViz['render'] = (foot, params, ctx) => {
  const c = footCorners(foot, ctx);
  const cx = (c.E[0] + c.O[0]) / 2;
  const cyBase = (c.S[1] + c.N[1]) / 2;
  const rx = Math.max(18, (c.E[0] - c.O[0]) / 2 - 4);
  const ry = Math.max(8, (c.S[1] - c.N[1]) / 2 - 2);
  const H = 60 * (params.floors ?? 2);
  const stone = params.wallColor ?? '#8d8a84';
  const body =
    `<path d="M${cx - rx},${cyBase} L${cx - rx},${cyBase - H} A${rx},${ry} 0 0 1 ${cx + rx},${cyBase - H} L${cx + rx},${cyBase} A${rx},${ry} 0 0 1 ${cx - rx},${cyBase} Z" fill="${stone}" stroke="#56524b" stroke-width="2"/>` +
    `<ellipse cx="${cx}" cy="${cyBase - H}" rx="${rx}" ry="${ry}" fill="#a09c95"/>`;
  // créneaux
  let cren = '';
  for (let i = -2; i <= 2; i++)
    cren += `<rect x="${cx + i * (rx / 2.5) - 4}" y="${cyBase - H - ry - 8}" width="8" height="12" fill="${stone}" stroke="#56524b"/>`;
  return { walls: body, interior: '', roof: cren };
};

const manoir: BuildingViz['render'] = (foot, params, ctx) => {
  const c = footCorners(foot, ctx);
  const H = 56 * (params.floors ?? 2);
  const walls =
    wallFaces(c, H, params.wallColor ?? '#cfc3a6', params.timberColor ?? '#3a2c1e') +
    `<path d="M${up(c.O, H * 0.5)} L${up(c.S, H * 0.5)} L${up(c.E, H * 0.5)}" stroke="${params.timberColor ?? '#3a2c1e'}" stroke-width="2.5" fill="none" opacity="0.6"/>`;
  return { walls, interior: floorInterior(c), roof: hipRoof(c, H, 44, ROOF.ardoise) };
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
const FLOORS_ONLY: ParamField[] = [{ key: 'floors', label: 'Étages', type: 'number', min: 1, max: 4, step: 1 }];

export const BUILDINGS: Record<string, BuildingViz> = {
  maison: { id: 'maison', paramsSchema: HOUSE_SCHEMA, render: colombage },
  taverne: { id: 'taverne', paramsSchema: HOUSE_SCHEMA, render: taverne },
  forge: { id: 'forge', paramsSchema: HOUSE_SCHEMA, render: forge },
  echoppe: { id: 'echoppe', paramsSchema: HOUSE_SCHEMA, render: echoppe },
  chapelle: { id: 'chapelle', paramsSchema: FLOORS_ONLY, render: chapelle },
  tour: { id: 'tour', paramsSchema: FLOORS_ONLY, render: tour },
  manoir: { id: 'manoir', paramsSchema: HOUSE_SCHEMA, render: manoir },
};

export function buildingLayers(type: string, foot: Rect, params: BuildingParams, ctx: RenderCtx): BuildingLayers {
  const viz = BUILDINGS[type];
  if (!viz) return colombage(foot, params, ctx); // fallback = maison générique
  return viz.render(foot, params, ctx);
}
export type BuildingId = keyof typeof BUILDINGS;
