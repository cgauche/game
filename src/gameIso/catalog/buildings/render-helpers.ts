/** Primitives de rendu PARTAGÉES des bâtiments (calques sol/murs/toit, colombage de base,
 *  schémas de paramètres). Chaque `defs/<id>.ts` compose ces primitives pour son `render`.
 *  Déplacé verbatim de l'ancien `catalog/buildings.ts` (registre Jalon 0.10). */
import { tileCenter, TW, TH, WALL_H, depth, type Dims } from '../../iso';
import type { BuildingViz, RenderCtx, Rect, ParamField } from '../types';
import type { Facing } from '../../../state/scene';

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

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
export type Corners = ReturnType<typeof footCorners>;
export const up = (p: number[], h: number) => `${p[0]},${p[1] - h}`;
export const pt = (p: number[]) => `${p[0]},${p[1]}`;
/** Point décalé vers le haut, gardé en nombres (pas de round-trip via string). */
export const upXY = (p: number[], h: number): [number, number] => [p[0], p[1] - h];
export const mid = (a: number[], b: number[]) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
export const lerp = (a: number[], b: number[], t: number): [number, number] => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];

/** Quad (chemin `d`) plaqué sur une face de mur : base p0→p1, bande de hauteur [y0,y1]·H, centré en tC (demi-largeur tH). */
export function pane(p0: number[], p1: number[], H: number, tC: number, tH: number, y0: number, y1: number): string {
  const A = lerp(p0, p1, tC - tH);
  const B = lerp(p0, p1, tC + tH);
  return `M${A[0]},${A[1] - H * y0} L${B[0]},${B[1] - H * y0} L${B[0]},${B[1] - H * y1} L${A[0]},${A[1] - H * y1} Z`;
}

// --- Helpers de calques partagés ------------------------------------------
export function groundShadow(c: Corners): string {
  const cx = (c.E[0] + c.O[0]) / 2;
  const cy = (c.S[1] + c.N[1]) / 2;
  const grow = (p: number[]) => [cx + (p[0] - cx) * 1.06, cy + (p[1] - cy) * 1.06 + 4];
  return `<path d="M${grow(c.N)} L${grow(c.E)} L${grow(c.S)} L${grow(c.O)} Z" fill="#000" opacity="0.20"/>`;
}

export function wallFaces(c: Corners, H: number, wallC: string, edge: string): string {
  return (
    `<path d="M${pt(c.O)} L${pt(c.S)} L${up(c.S, H)} L${up(c.O, H)} Z" fill="${wallC}" stroke="${edge}" stroke-width="2"/>` +
    `<path d="M${pt(c.S)} L${pt(c.E)} L${up(c.E, H)} L${up(c.S, H)} Z" fill="${wallC}" stroke="${edge}" stroke-width="2" opacity="0.9"/>`
  );
}

/** Fenêtres (une par face avant) + porte sur le mur du côté `facing`. Éclairées la nuit. */
export function openings(c: Corners, H: number, facing?: Facing, night?: boolean): string {
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
export function timberBraces(c: Corners, H: number, timber: string): string {
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

/** Élévation (px) d'un toit en croupe AU-DESSUS des avant-toits, calée sur l'EMPREINTE : un petit
 *  bâtiment (4×3) reste ~35 (pente douce, rétro-compatible avec l'ancien `roofH` fixe de 34) ; un grand
 *  (15×10) monte ~125 → pente NETTE et crédible au lieu d'un toit plat surdimensionné. Plafonné à 220.
 *  `steep` = multiplicateur pour les toits volontairement plus raides (chapelle/manoir en ardoise). */
export function roofRise(foot: Rect, steep = 1): number {
  return clamp((foot.w + foot.h) * 5 * steep, 34 * steep, 220);
}

/** Base (px) sur laquelle REPOSE le toit d'un bâtiment tout-en-scène = la hauteur des murs `WallSeg`
 *  (`WALL_H`). Le toit d'un `Roof` ne rend QUE le calque `.roof` (les murs sont des `WallSeg`, le sol du
 *  terrain), donc son avant-toit doit s'aligner sur le sommet des cloisons d'arête, sinon il flotte. */
export const ROOF_BASE = WALL_H;

export function hipRoof(c: Corners, H: number, roofH: number, material: string): string {
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

export function floorInterior(c: Corners): string {
  return `<path d="M${pt(c.N)} L${pt(c.E)} L${pt(c.S)} L${pt(c.O)} Z" fill="#3a2c1e" opacity="0.9"/>`;
}

/** Toit en croupe d'un bâtiment tout-en-scène : REPOSE sur les murs (`ROOF_BASE = WALL_H`) et sa pente
 *  s'adapte à l'EMPREINTE (`roofRise`). SOURCE UNIQUE pour tous les `defs/` (plus de `H`/`roofH` à la
 *  main → plus de toit flottant ni plat). `steep` pour les toits volontairement raides. */
export function buildingRoof(c: Corners, foot: Rect, material: string, steep = 1): string {
  return hipRoof(c, ROOF_BASE, roofRise(foot, steep), material);
}

/** Teintes de toit par matériau ET orientation de PENTE (face descendant vers l'avant-toit). Lumière en
 *  haut-gauche (comme les murs) : la pente qui regarde le Nord/haut est claire, le Sud/bas sombre. */
const ROOF_FACE: Record<string, { N: string; E: string; S: string; O: string; line: string }> = {
  tuile: { N: '#a04836', E: '#732a20', S: '#531b13', O: '#8a3527', line: '#411409' },
  chaume: { N: '#b0904a', E: '#7d642a', S: '#59461a', O: '#997c3c', line: '#463714' },
  ardoise: { N: '#63727f', E: '#3d4852', S: '#283037', O: '#4d5964', line: '#20272d' },
};

/** Matériau de toit par style de bâtiment (défaut tuile). */
export const STYLE_MATERIAL: Record<string, string> = {
  taverne: 'tuile', maison: 'tuile', echoppe: 'chaume',
  chapelle: 'ardoise', forge: 'ardoise', tour: 'ardoise', manoir: 'ardoise',
};

/** TOIT AUTO-CONSTRUIT à partir de l'ENSEMBLE DE CELLULES du bâtiment (forme QUELCONQUE : rectangle, U, L…).
 *  Chaque SOMMET de grille reçoit une hauteur = `WALL_H` + (distance-à-l'avant-toit)·pente → bas aux bords,
 *  haut au faîte (une LIGNE de faîte pour un rectangle, qui suit la forme sinon). Rendu cellule par cellule
 *  (quads iso triés arrière→avant, peintre), ombré selon l'orientation de la pente. Repose sur les murs
 *  `WallSeg` (base `WALL_H`) → aucun toit plat/flottant, aucune hypothèse de rectangle. */
export function roofFromCells(cells: Set<string>, dims: Dims, material: string): string {
  const SLOPE = 17; // px de montée par cran de profondeur
  const sh = ROOF_FACE[material] ?? ROOF_FACE.tuile;
  const has = (x: number, y: number) => cells.has(`${x},${y}`);
  // sommets de grille touchés par au moins une cellule
  const verts = new Set<string>();
  for (const k of cells) {
    const [x, y] = k.split(',').map(Number);
    verts.add(`${x},${y}`); verts.add(`${x + 1},${y}`); verts.add(`${x},${y + 1}`); verts.add(`${x + 1},${y + 1}`);
  }
  // profondeur BFS : sommet INTÉRIEUR = ses 4 cellules sont du toit ; sinon avant-toit (0)
  const inner = (vx: number, vy: number) => has(vx - 1, vy - 1) && has(vx, vy - 1) && has(vx - 1, vy) && has(vx, vy);
  const dep = new Map<string, number>();
  const q: [number, number][] = [];
  for (const k of verts) { const [vx, vy] = k.split(',').map(Number); if (!inner(vx, vy)) { dep.set(k, 0); q.push([vx, vy]); } }
  for (let i = 0; i < q.length; i++) {
    const [vx, vy] = q[i]; const d = dep.get(`${vx},${vy}`)!;
    for (const [nx, ny] of [[vx + 1, vy], [vx - 1, vy], [vx, vy + 1], [vx, vy - 1]] as [number, number][]) {
      const nk = `${nx},${ny}`;
      if (verts.has(nk) && !dep.has(nk)) { dep.set(nk, d + 1); q.push([nx, ny]); }
    }
  }
  const hgt = (vx: number, vy: number) => WALL_H + (dep.get(`${vx},${vy}`) ?? 0) * SLOPE;
  const scr = (vx: number, vy: number): [number, number] => { const { cx, cy } = tileCenter(vx - 0.5, vy - 0.5, dims); return [cx, cy - hgt(vx, vy)]; };
  // cellules triées arrière→avant (peintre iso : la pente avant recouvre l'arrière)
  const arr = [...cells].map((k) => k.split(',').map(Number) as [number, number]).sort((a, b) => depth(a[0], a[1], dims) - depth(b[0], b[1], dims));
  let s = '';
  for (const [x, y] of arr) {
    const TL = scr(x, y), TR = scr(x + 1, y), BR = scr(x + 1, y + 1), BL = scr(x, y + 1);
    const hTL = hgt(x, y), hTR = hgt(x + 1, y), hBR = hgt(x + 1, y + 1), hBL = hgt(x, y + 1);
    const dhx = hTR + hBR - hTL - hBL; // montée vers +x (grille)
    const dhy = hBL + hBR - hTL - hTR; // montée vers +y (grille)
    // teinte = pente DESCENDANTE (vers l'avant-toit) : dhx>0 descend vers -x (O), etc.
    const col = Math.abs(dhx) >= Math.abs(dhy) ? (dhx > 0 ? sh.O : dhx < 0 ? sh.E : sh.N) : dhy > 0 ? sh.N : dhy < 0 ? sh.S : sh.N;
    // GRILLE de tuiles VISIBLE (liseré sombre par cellule) : c'est elle qui donne la PROFONDEUR / le relief
    // du toit (rangs de tuiles) — préférée au rendu lisse qui aplatit la lecture.
    s += `<path d="M${TL[0]},${TL[1]} L${TR[0]},${TR[1]} L${BR[0]},${BR[1]} L${BL[0]},${BL[1]} Z" fill="${col}" stroke="${sh.line}" stroke-width="0.6" stroke-linejoin="round"/>`;
  }
  return s;
}

/** Maison à colombages générique — base réutilisée par maison/taverne et le fallback. */
export const colombage: BuildingViz['render'] = (foot, params, ctx) => {
  const c = footCorners(foot, ctx);
  const H = ROOF_BASE;
  const timber = params.timberColor ?? '#4a3220';
  const wallC = params.wallColor ?? '#d8c9a8';
  const walls = groundShadow(c) + wallFaces(c, H, wallC, timber) + timberBraces(c, H, timber) + openings(c, H, ctx.facing, ctx.night);
  return { walls, interior: floorInterior(c), roof: buildingRoof(c, foot, params.roofMaterial ?? 'tuile') };
};

export const HOUSE_SCHEMA: ParamField[] = [
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
export const FLOORS_ONLY: ParamField[] = [{ key: 'floors', label: 'Étages', type: 'number', min: 1, max: 4, step: 1 }];
