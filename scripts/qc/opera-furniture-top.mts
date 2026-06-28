/**
 * QC — placement du MOBILIER en vue du dessus schématique : reprend les murs (noir) + porte (vert) du
 * floorplan et superpose chaque prop du scénario `22-opera-plan` comme un POINT coloré (rouge = rez z0,
 * bleu = étage z1) avec son empreinte. Sert à vérifier qu'aucun meuble ne tombe DANS un mur / sur le
 * parterre / hors d'une pièce, et que les pièces latérales sont DENSÉMENT meublées.
 *   npx tsx scripts/qc/opera-furniture-top.mts → public/qc/opera-furniture-top.png
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { Resvg } from '@resvg/resvg-js';
import { buildOperaFloorplan } from '../../src/scenes/opera/floorplan';
import { scenarioEntities } from '../../src/scenes/opera/furnished';

const scene = buildOperaFloorplan();
const W = scene.dimensions.w, H = scene.dimensions.h;
const Z = (process.argv[2] === '1' ? 1 : 0) as 0 | 1;
const CELL = 22, PAD = 24;
const SW = W * CELL + PAD * 2, SH = H * CELL + PAD * 2;
const X = (gx: number) => PAD + gx * CELL;
const Y = (gy: number) => PAD + gy * CELL;
const parts: string[] = [];

for (const w of scene.walls ?? []) {
  if ((w.z ?? 0) !== Z) continue;
  const col = w.door ? '#1fb8a6' : '#111';
  const sw = w.door ? 6 : 4;
  if (w.side === 'N') parts.push(`<line x1="${X(w.x)}" y1="${Y(w.y)}" x2="${X(w.x + 1)}" y2="${Y(w.y)}" stroke="${col}" stroke-width="${sw}"/>`);
  else if (w.side === 'E') parts.push(`<line x1="${X(w.x + 1)}" y1="${Y(w.y)}" x2="${X(w.x + 1)}" y2="${Y(w.y + 1)}" stroke="${col}" stroke-width="${sw}"/>`);
  else if (w.side === '\\') parts.push(`<line x1="${X(w.x)}" y1="${Y(w.y)}" x2="${X(w.x + 1)}" y2="${Y(w.y + 1)}" stroke="#bbb" stroke-width="2"/>`);
  else if (w.side === '/') parts.push(`<line x1="${X(w.x + 1)}" y1="${Y(w.y)}" x2="${X(w.x)}" y2="${Y(w.y + 1)}" stroke="#bbb" stroke-width="2"/>`);
}
// parterre (sièges) en gris clair pour contexte
const seatColor = '#e8e8f0';
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
  if (scene.levels[0].tiles[y * W + x] === 'plancher' && Z === 0)
    parts.push(`<rect x="${X(x) + 1}" y="${Y(y) + 1}" width="${CELL - 2}" height="${CELL - 2}" fill="${seatColor}"/>`);
}
let n = 0;
for (const e of scenarioEntities) {
  if (e.kind !== 'prop' || (e.z ?? 0) !== Z) continue;
  n++;
  const fw = e.foot?.w ?? 1, fh = e.foot?.h ?? 1;
  parts.push(`<rect x="${X(e.pos.x) + 3}" y="${Y(e.pos.y) + 3}" width="${CELL * fw - 6}" height="${CELL * fh - 6}" fill="#d2433a" fill-opacity="0.55" stroke="#a01f18" stroke-width="1"/>`);
}
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${SW} ${SH}" width="${SW}" height="${SH}"><rect width="${SW}" height="${SH}" fill="#fff"/>${parts.join('')}</svg>`;
const png = new Resvg(svg, { fitTo: { mode: 'width', value: SW } }).render().asPng();
mkdirSync('public/qc', { recursive: true });
writeFileSync(`public/qc/opera-furniture-top${Z === 1 ? '-etage' : ''}.png`, png);
console.log(`OK: public/qc/opera-furniture-top${Z === 1 ? '-etage' : ''}.png — ${n} props z=${Z}`);
