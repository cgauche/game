/**
 * QC — élévation : une SCÈNE surélevée (gradin) + une FOSSE d'orchestre en contrebas, pour valider
 * le rendu des jupes (risers) et le décalage vertical des tokens. npx tsx scripts/qc/render-elevation.mts
 * → public/qc/elevation.png
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { Resvg } from '@resvg/resvg-js';
import { groundTile } from '../../src/gameIso/ground';
import { elevAt } from '../../src/state/scene';
import { DEFS } from '../../src/gameIso/sprites';
import { stageSize, depth, floorDepth, tileCenter, type Dims } from '../../src/gameIso/iso';
import type { Scene, Terrain } from '../../src/state/scene';

const W = 9, H = 9;
const tiles = new Array(W * H).fill('plancher') as Terrain[];
const elev = new Array(W * H).fill(0) as number[];
const set = (x: number, y: number, e: number) => { elev[y * W + x] = e; };
// SCÈNE surélevée (gradin) au fond : lignes 1-2, colonnes 2..6, +0.45
for (let y = 1; y <= 2; y++) for (let x = 2; x <= 6; x++) set(x, y, 0.45);
// FOSSE d'orchestre devant la scène : ligne 4, colonnes 2..6, -0.4
for (let x = 2; x <= 6; x++) { tiles[4 * W + x] = 'planches'; set(x, 4, -0.4); }

const scene = {
  id: 's', nom: '', description: '', dimensions: { w: W, h: H },
  levels: [{ z: 0, tiles, elev }], entities: [], dialogues: [], triggers: [], encounters: [], flags: {},
} as unknown as Scene;

const d: Dims = { w: W, h: H };
const objs: { d: number; svg: string }[] = [];
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const h = groundTile(scene, x, y, d, 0); if (h) objs.push({ d: floorDepth(d, 0), svg: h }); }

// pions : un artiste sur la scène (4,1), un musicien dans la fosse (4,4), un spectateur au parterre (4,6)
const pawn = (x: number, y: number, color: string) => {
  const z = elevAt(scene, x, y, 0);
  const { cx, cy } = tileCenter(x, y, d, z);
  objs.push({ d: depth(x, y, d, 0) + 0.5, svg: `<g><ellipse cx="${cx}" cy="${cy}" rx="9" ry="4" fill="#000" opacity="0.3"/><rect x="${cx - 6}" y="${cy - 40}" width="12" height="40" rx="4" fill="${color}"/><circle cx="${cx}" cy="${cy - 46}" r="7" fill="${color}"/></g>` });
};
pawn(4, 1, '#d9b44a'); // artiste sur la scène (surélevé)
pawn(4, 4, '#5aa0d9'); // musicien dans la fosse (abaissé)
pawn(4, 6, '#c44'); // spectateur au parterre (ras)

objs.sort((a, b) => a.d - b.d);
const stage = stageSize(d);
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${stage.w} ${stage.h}" width="${stage.w}" height="${stage.h}"><defs>${DEFS}</defs><rect width="${stage.w}" height="${stage.h}" fill="#14161f"/>${objs.map((o) => o.svg).join('')}</svg>`;
const png = new Resvg(svg, { fitTo: { mode: 'width', value: stage.w * 2 }, font: { loadSystemFonts: true } }).render().asPng();
mkdirSync('public/qc', { recursive: true });
writeFileSync('public/qc/elevation.png', png);
console.log('OK: public/qc/elevation.png — scène surélevée (gradin) + fosse d’orchestre + 3 pions');
