/**
 * QC — rend un sol MULTI-NIVEAUX (niveau 0 plein + plateforme « loge » au niveau 1, tuiles « vide »
 * transparentes) pour vérifier visuellement le rendu des étages. npx tsx scripts/qc/render-multilevel.mts
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { Resvg } from '@resvg/resvg-js';
import { groundTile } from '../../src/gameIso/ground';
import { DEFS } from '../../src/gameIso/sprites';
import { stageSize, tileCenter, depth, floorDepth, type Dims } from '../../src/gameIso/iso';
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

// Réplique du tri de profondeur de IsoStage : planchers (floorDepth, une bande par étage) + 2 jetons
// au SOL (z=0). Un jeton SOUS la loge (4,4) doit être MASQUÉ par le plancher haut ; un jeton hors loge
// (4,7) reste visible — preuve du surplomb. (depth jeton = base + 0.5, comme tokenNode.)
// Jeton GRAND (130px) : son sommet (~130px au-dessus du sol) monte dans la zone-écran du plancher
// haut (soulevé de LEVEL_H=96px) → le sol de la loge doit RECOUVRIR le haut du jeton placé dessous.
const marker = (x: number, y: number, fill: string, h = 130) => {
  const { cx, cy } = tileCenter(x, y, d);
  return `<g><ellipse cx="${cx}" cy="${cy}" rx="9" ry="4.5" fill="#000" opacity="0.35"/><rect x="${cx - 7}" y="${cy - h}" width="14" height="${h}" rx="3" fill="${fill}" stroke="#101015"/></g>`;
};
const objs: { d: number; svg: string }[] = [];
for (const lvl of scene.levels) {
  const fd = floorDepth(d, lvl.z);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const h = groundTile(scene, x, y, d, lvl.z); if (h) objs.push({ d: fd, svg: h }); }
}
objs.push({ d: depth(4, 4, d, 0) + 0.5, svg: marker(4, 4, '#e0473a') }); // sous la loge → sommet recouvert
objs.push({ d: depth(4, 7, d, 0) + 0.5, svg: marker(4, 7, '#3a9be0') }); // hors loge → entièrement visible
objs.sort((a, b) => a.d - b.d);

const stage = stageSize(d);
const body = objs.map((o) => o.svg).join('');
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${stage.w} ${stage.h}" width="${stage.w}" height="${stage.h}"><defs>${DEFS}</defs><rect width="${stage.w}" height="${stage.h}" fill="#1d2230"/>${body}</svg>`;
const png = new Resvg(svg, { fitTo: { mode: 'width', value: stage.w * 2 }, font: { loadSystemFonts: true } }).render().asPng();
mkdirSync('public/qc/opera', { recursive: true });
writeFileSync('public/qc/opera/multilevel.png', png);
console.log('OK: public/qc/opera/multilevel.png — jeton rouge (4,4) masqué par la loge, jeton bleu (4,7) visible');
