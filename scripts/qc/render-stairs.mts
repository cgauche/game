/**
 * QC — escalier : une volée reliant le sol (z0) à une plateforme (z1), rendue depuis `Scene.stairs`.
 * npx tsx scripts/qc/render-stairs.mts → public/qc/stairs.png
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { Resvg } from '@resvg/resvg-js';
import { groundTile } from '../../src/gameIso/ground';
import { stairSegs } from '../../src/gameIso/stairs';
import { DEFS } from '../../src/gameIso/sprites';
import { stageSize, floorDepth, type Dims } from '../../src/gameIso/iso';
import type { Scene, Terrain } from '../../src/state/scene';

const W = 6, H = 6;
const t0 = new Array(W * H).fill('dalle') as Terrain[];
const t1 = new Array(W * H).fill('vide') as Terrain[];
// plateforme z1 au fond (lignes 0-1), reliée au sol par un escalier en (2,2).
for (let y = 0; y <= 1; y++) for (let x = 1; x <= 4; x++) t1[y * W + x] = 'plancher';
const scene = {
  id: 's', nom: '', description: '', dimensions: { w: W, h: H },
  levels: [{ z: 0, tiles: t0 }, { z: 1, tiles: t1 }],
  stairs: [{ from: { x: 2, y: 2, z: 0 }, to: { x: 2, y: 2, z: 1 } }],
  entities: [], dialogues: [], triggers: [], encounters: [], flags: {},
} as unknown as Scene;

const d: Dims = { w: W, h: H };
const objs: { d: number; svg: string }[] = [];
for (const z of [0, 1]) for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const h = groundTile(scene, x, y, d, z); if (h) objs.push({ d: floorDepth(d, z), svg: h }); }
objs.push(...stairSegs(scene, d));
objs.sort((a, b) => a.d - b.d);

const stage = stageSize(d);
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${stage.w} ${stage.h}" width="${stage.w}" height="${stage.h}"><defs>${DEFS}</defs><rect width="${stage.w}" height="${stage.h}" fill="#14161f"/>${objs.map((o) => o.svg).join('')}</svg>`;
const png = new Resvg(svg, { fitTo: { mode: 'width', value: stage.w * 2.2 }, font: { loadSystemFonts: true } }).render().asPng();
mkdirSync('public/qc', { recursive: true });
writeFileSync('public/qc/stairs.png', png);
console.log('OK: public/qc/stairs.png — volée z0→z1 reliant le sol à une plateforme');
