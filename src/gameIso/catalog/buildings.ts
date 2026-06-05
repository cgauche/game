import { tileCenter, TW, TH } from '../iso';
import type { BuildingViz, BuildingLayers, RenderCtx, Rect, ParamField } from './types';
import type { BuildingParams, Facing } from '../../state/scene';

/** Coins écran (sol) de l'empreinte, labellisés par POSITION ÉCRAN (rot-aware) :
 *  le coin projeté le plus bas = S (face avant), le plus haut = N, etc. → murs/porte
 *  toujours sur les faces face-caméra quelle que soit la rotation. */
export function footCorners(foot: Rect, ctx: RenderCtx) {
  const pts = [
    tileCenter(foot.x, foot.y, ctx.dims),
    tileCenter(foot.x + foot.w - 1, foot.y, ctx.dims),
    tileCenter(foot.x + foot.w - 1, foot.y + foot.h - 1, ctx.dims),
    tileCenter(foot.x, foot.y + foot.h - 1, ctx.dims),
  ];
  const top = pts.reduce((a, b) => (b.cy < a.cy ? b : a));
  const bot = pts.reduce((a, b) => (b.cy > a.cy ? b : a));
  const right = pts.reduce((a, b) => (b.cx > a.cx ? b : a));
  const left = pts.reduce((a, b) => (b.cx < a.cx ? b : a));
  return {
    N: [top.cx, top.cy - TH / 2] as number[],
    E: [right.cx + TW / 2, right.cy] as number[],
    S: [bot.cx, bot.cy + TH / 2] as number[],
    O: [left.cx - TW / 2, left.cy] as number[],
  };
}

const FACING_ORDER: Facing[] = ['N', 'E', 'S', 'O'];
/** Tourne une façade-monde dans le repère écran courant (cran horaire `rot`). */
export function rotateFacing(f: Facing | undefined, rot: number): Facing | undefined {
  if (!f) return undefined;
  return FACING_ORDER[(FACING_ORDER.indexOf(f) + rot) & 3];
}
type Corners = ReturnType<typeof footCorners>;
const up = (p: number[], h: number) => `${p[0]},${p[1] - h}`;
const pt = (p: number[]) => `${p[0]},${p[1]}`;
/** Point décalé vers le haut, gardé en nombres (pas de round-trip via string). */
const upXY = (p: number[], h: number): [number, number] => [p[0], p[1] - h];
const mid = (a: number[], b: number[]) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
const lerp = (a: number[], b: number[], t: number): [number, number] => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];

/** Quad (chemin `d`) plaqué sur une face de mur : base p0→p1, bande de hauteur [y0,y1]·H, centré en tC (demi-largeur tH). */
function pane(p0: number[], p1: number[], H: number, tC: number, tH: number, y0: number, y1: number): string {
  const A = lerp(p0, p1, tC - tH);
  const B = lerp(p0, p1, tC + tH);
  return `M${A[0]},${A[1] - H * y0} L${B[0]},${B[1] - H * y0} L${B[0]},${B[1] - H * y1} L${A[0]},${A[1] - H * y1} Z`;
}

// --- Helpers de calques partagés ------------------------------------------
function groundShadow(c: Corners): string {
  const cx = (c.E[0] + c.O[0]) / 2;
  const cy = (c.S[1] + c.N[1]) / 2;
  const grow = (p: number[]) => [cx + (p[0] - cx) * 1.06, cy + (p[1] - cy) * 1.06 + 4];
  return `<path d="M${grow(c.N)} L${grow(c.E)} L${grow(c.S)} L${grow(c.O)} Z" fill="#000" opacity="0.20"/>`;
}

function wallFaces(c: Corners, H: number, wallC: string, edge: string): string {
  return (
    `<path d="M${pt(c.O)} L${pt(c.S)} L${up(c.S, H)} L${up(c.O, H)} Z" fill="${wallC}" stroke="${edge}" stroke-width="2"/>` +
    `<path d="M${pt(c.S)} L${pt(c.E)} L${up(c.E, H)} L${up(c.S, H)} Z" fill="${wallC}" stroke="${edge}" stroke-width="2" opacity="0.9"/>`
  );
}

/** Fenêtres (une par face avant) + porte sur le mur du côté `facing`. Éclairées la nuit. */
function openings(c: Corners, H: number, facing?: Facing, night?: boolean): string {
  const glass = night ? '#f2c45a' : '#33414d';
  const frame = '#2a2018';
  const wood = '#42301c';
  let s = '';
  // fenêtres à volets, mi-hauteur, une par face avant (halo + flicker la nuit)
  const win = (p0: number[], p1: number[], op = 1): string => {
    const halo = night ? `<path d="${pane(p0, p1, H, 0.5, 0.13, 0.4, 0.78)}" fill="#f2c45a" opacity="0.22"/>` : '';
    const pn = `<path d="${pane(p0, p1, H, 0.5, 0.07, 0.46, 0.72)}" fill="${glass}" stroke="${frame}" stroke-width="1.5" opacity="${op}"/>`;
    return night ? `<g class="warm">${halo}${pn}</g>` : pn;
  };
  s += win(c.O, c.S);
  s += win(c.S, c.E, 0.92);
  // porte : choix de la face avant selon facing (E → face droite ; sinon face gauche)
  const onRight = facing === 'E';
  const tC = onRight ? 0.5 : facing === 'S' ? 0.82 : 0.5;
  const [p0, p1] = onRight ? [c.S, c.E] : [c.O, c.S];
  s += `<path d="${pane(p0, p1, H, tC, 0.11, 0, 0.52)}" fill="${wood}" stroke="${frame}" stroke-width="2"/>`;
  s += `<path d="${pane(p0, p1, H, tC, 0.085, 0.03, 0.48)}" fill="#241a10"/>`; // vantail sombre
  return s;
}

/** Pans de colombage (bandeau + montants + croix de St-André) pour les façades à pans de bois. */
function timberBraces(c: Corners, H: number, timber: string): string {
  let s = `<path d="M${up(c.O, H * 0.5)} L${up(c.S, H * 0.5)} L${up(c.E, H * 0.5)}" stroke="${timber}" stroke-width="3" fill="none" opacity="0.7"/>`;
  s += `<path d="M${pt(c.S)} L${up(c.S, H)}" stroke="${timber}" stroke-width="3" opacity="0.6"/>`;
  for (const [a, b] of [[c.O, c.S], [c.S, c.E]] as const) {
    const m = lerp(a, b, 0.5);
    s += `<path d="M${pt(m)} L${m[0]},${m[1] - H}" stroke="${timber}" stroke-width="2" opacity="0.45"/>`;
    s += `<path d="M${a[0]},${a[1] - H * 0.5} L${b[0]},${b[1] - H}" stroke="${timber}" stroke-width="1.6" opacity="0.35"/>`;
  }
  return s;
}

const ROOF: Record<string, [string, string, string, string]> = {
  tuile: ['#8a3326', '#6a271e', '#7a2d22', '#511d16'],
  chaume: ['#9a7b3a', '#7a5f29', '#8a6c30', '#65501f'],
  ardoise: ['#4a5560', '#363f48', '#414c56', '#2c343b'],
};
const COURSE: Record<string, string> = { tuile: '#5a1f17', chaume: '#6a531f', ardoise: '#2a323a' };

function hipRoof(c: Corners, H: number, roofH: number, material: string): string {
  const col = ROOF[material] ?? ROOF.tuile;
  const apex = [(c.N[0] + c.S[0]) / 2, (c.N[1] + c.S[1]) / 2 - (H + roofH)];
  let s =
    `<path d="M${up(c.O, H)} L${up(c.N, H)} L${pt(apex)} Z" fill="${col[0]}"/>` +
    `<path d="M${up(c.N, H)} L${up(c.E, H)} L${pt(apex)} Z" fill="${col[1]}"/>` +
    `<path d="M${up(c.O, H)} L${up(c.S, H)} L${pt(apex)} Z" fill="${col[2]}"/>` +
    `<path d="M${up(c.S, H)} L${up(c.E, H)} L${pt(apex)} Z" fill="${col[3]}"/>`;
  // rangs de tuiles/ardoises (lignes parallèles aux avant-toits)
  const courseCol = COURSE[material] ?? COURSE.tuile;
  const n = material === 'chaume' ? 2 : 3;
  const faces: [number[], number[]][] = [
    [upXY(c.O, H), upXY(c.N, H)],
    [upXY(c.N, H), upXY(c.E, H)],
    [upXY(c.O, H), upXY(c.S, H)],
    [upXY(c.S, H), upXY(c.E, H)],
  ];
  for (const [e0, e1] of faces)
    for (let i = 1; i <= n; i++) {
      const f = i / (n + 1);
      const a = lerp(e0, apex, f);
      const b = lerp(e1, apex, f);
      s += `<line x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}" stroke="${courseCol}" stroke-width="1.2" opacity="0.5"/>`;
    }
  return s;
}

function floorInterior(c: Corners): string {
  return `<path d="M${pt(c.N)} L${pt(c.E)} L${pt(c.S)} L${pt(c.O)} Z" fill="#3a2c1e" opacity="0.9"/>`;
}

// --- Générateurs ----------------------------------------------------------
const colombage: BuildingViz['render'] = (foot, params, ctx) => {
  const c = footCorners(foot, ctx);
  const H = 40 * (params.floors ?? 2);
  const timber = params.timberColor ?? '#4a3220';
  const wallC = params.wallColor ?? '#d8c9a8';
  const walls = groundShadow(c) + wallFaces(c, H, wallC, timber) + timberBraces(c, H, timber) + openings(c, H, ctx.facing, ctx.night);
  return { walls, interior: floorInterior(c), roof: hipRoof(c, H, 34, params.roofMaterial ?? 'tuile') };
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
  const walls = groundShadow(c) + wallFaces(c, H, params.wallColor ?? '#8a8378', '#4d4a44') + openings(c, H, ctx.facing, ctx.night);
  // cheminée + fumée animée (coin E)
  const e = upXY(c.E, H);
  const ch = [e[0] - 10, e[1] - 6];
  const chimney =
    `<rect x="${ch[0] - 6}" y="${ch[1] - 26}" width="14" height="30" fill="#5a5048" stroke="#2e2a25"/>` +
    `<g class="smoke" style="transform-box:fill-box;transform-origin:${ch[0]}px ${ch[1] - 26}px">` +
    `<circle cx="${ch[0]}" cy="${ch[1] - 30}" r="7" fill="#cfc8bf" opacity="0.5"/>` +
    `<circle cx="${ch[0] + 4}" cy="${ch[1] - 40}" r="9" fill="#bcb4a9" opacity="0.4"/></g>`;
  return { walls: walls + chimney, interior: floorInterior(c), roof: hipRoof(c, H, 22, 'ardoise') };
};

const echoppe: BuildingViz['render'] = (foot, params, ctx) => {
  const c = footCorners(foot, ctx);
  const H = 34;
  const walls = groundShadow(c) + wallFaces(c, H, params.wallColor ?? '#cdbd98', params.timberColor ?? '#5a3f24') + openings(c, H, ctx.facing, ctx.night);
  // auvent rayé en façade (au-dessus de O→S)
  const a = upXY(c.O, H * 0.5);
  const b = upXY(c.S, H * 0.5);
  const awning = `<path d="M${pt(a)} L${pt(b)} L${b[0]},${b[1] + 16} L${a[0]},${a[1] + 16} Z" fill="#a8423a" opacity="0.85"/>`;
  return { walls: walls + awning, interior: floorInterior(c), roof: hipRoof(c, H, 18, params.roofMaterial ?? 'tuile') };
};

const chapelle: BuildingViz['render'] = (foot, params, ctx) => {
  const c = footCorners(foot, ctx);
  const H = 70;
  const walls = groundShadow(c) + wallFaces(c, H, params.wallColor ?? '#b9b2a4', '#6a655c') + openings(c, H, ctx.facing, ctx.night);
  const apex = [(c.N[0] + c.S[0]) / 2, (c.N[1] + c.S[1]) / 2 - (H + 64)];
  const cross =
    `<line x1="${apex[0]}" y1="${apex[1]}" x2="${apex[0]}" y2="${apex[1] - 20}" stroke="#d8c27a" stroke-width="3"/>` +
    `<line x1="${apex[0] - 7}" y1="${apex[1] - 14}" x2="${apex[0] + 7}" y2="${apex[1] - 14}" stroke="#d8c27a" stroke-width="3"/>`;
  return { walls, interior: floorInterior(c), roof: hipRoof(c, H, 64, 'ardoise') + cross };
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
    groundShadow(c) +
    `<path d="M${cx - rx},${cyBase} L${cx - rx},${cyBase - H} A${rx},${ry} 0 0 1 ${cx + rx},${cyBase - H} L${cx + rx},${cyBase} A${rx},${ry} 0 0 1 ${cx - rx},${cyBase} Z" fill="${stone}" stroke="#56524b" stroke-width="2"/>` +
    `<ellipse cx="${cx}" cy="${cyBase - H}" rx="${rx}" ry="${ry}" fill="#a09c95"/>`;
  // meurtrières + porte cintrée + assises de pierre
  let detail = '';
  for (const hy of [0.35, 0.62, 0.85]) detail += `<rect x="${cx - 2.5}" y="${cyBase - H * hy - 9}" width="5" height="14" rx="2" fill="#2c2a26"/>`;
  for (let i = 1; i <= 4; i++) detail += `<line x1="${cx - rx}" y1="${cyBase - (H * i) / 5}" x2="${cx + rx}" y2="${cyBase - (H * i) / 5}" stroke="#6e6a62" stroke-width="1" opacity="0.4"/>`;
  detail += `<path d="M${cx - 9},${cyBase} L${cx - 9},${cyBase - 16} Q${cx},${cyBase - 26} ${cx + 9},${cyBase - 16} L${cx + 9},${cyBase} Z" fill="#3a2a18" stroke="#241a10"/>`;
  // créneaux
  let cren = '';
  for (let i = -2; i <= 2; i++) cren += `<rect x="${cx + i * (rx / 2.5) - 4}" y="${cyBase - H - ry - 8}" width="8" height="12" fill="${stone}" stroke="#56524b"/>`;
  return { walls: body + detail, interior: '', roof: cren };
};

const manoir: BuildingViz['render'] = (foot, params, ctx) => {
  const c = footCorners(foot, ctx);
  const H = 56 * (params.floors ?? 2);
  const timber = params.timberColor ?? '#3a2c1e';
  const walls =
    groundShadow(c) +
    wallFaces(c, H, params.wallColor ?? '#cfc3a6', timber) +
    `<path d="M${up(c.O, H * 0.5)} L${up(c.S, H * 0.5)} L${up(c.E, H * 0.5)}" stroke="${timber}" stroke-width="2.5" fill="none" opacity="0.55"/>` +
    openings(c, H, ctx.facing, ctx.night);
  return { walls, interior: floorInterior(c), roof: hipRoof(c, H, 44, 'ardoise') };
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
  // La porte est posée selon une façade-monde ; on la tourne dans le repère écran courant.
  const rctx: RenderCtx = { ...ctx, facing: rotateFacing(ctx.facing, ctx.dims.rot ?? 0) };
  const viz = BUILDINGS[type];
  if (!viz) return colombage(foot, params, rctx); // fallback = maison générique
  return viz.render(foot, params, rctx);
}
export type BuildingId = keyof typeof BUILDINGS;
