/**
 * QC — rend un sol MULTI-NIVEAUX (niveau 0 plein + plateforme « loge » au niveau 1, tuiles « vide »
 * transparentes) pour vérifier visuellement le rendu des étages. npx tsx scripts/qc/render-multilevel.mts
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { Resvg } from '@resvg/resvg-js';
import { groundTile } from '../../src/gameIso/ground';
import { DEFS } from '../../src/gameIso/sprites';
import { stageSize, type Dims } from '../../src/gameIso/iso';
import type { Scene } from '../../src/state/scene';

const W = 9, H = 9;
const ground = new Array(W * H).fill('herbe');
const upper = new Array(W * H).fill('vide');
for (let y = 2; y <= 5; y++) for (let x = 2; x <= 6; x++) upper[y * W + x] = 'plancher'; // la loge en surplomb
const scene = {
  id: 's', nom: '', description: '', dimensions: { w: W, h: H },
  levels: [{ z: 0, tiles: ground }, { z: 1, tiles: upper }],
  entities: [], dialogues: [], triggers: [], encounters: [], flags: {},
} as unknown as Scene;

const d: Dims = { w: W, h: H };
let body = '';
for (const lvl of scene.levels) for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) body += groundTile(scene, x, y, d, lvl.z);
const stage = stageSize(d);
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${stage.w} ${stage.h}" width="${stage.w}" height="${stage.h}"><defs>${DEFS}</defs><rect width="${stage.w}" height="${stage.h}" fill="#1d2230"/>${body}</svg>`;
const png = new Resvg(svg, { fitTo: { mode: 'width', value: stage.w * 2 }, font: { loadSystemFonts: true } }).render().asPng();
mkdirSync('public/qc/opera', { recursive: true });
writeFileSync('public/qc/opera/multilevel.png', png);
console.log('OK: public/qc/opera/multilevel.png');
