/**
 * QC — le prop `siege` SEUL : un fauteuil 1×1 rendu à facing='N' sous les 4 crans de caméra (rot 0..3),
 * pour vérifier qu'il est lisible, centré dans sa case et qu'il PIVOTE (dos vers la caméra à rot 0 =
 * regarde la scène au Nord ; face quand la caméra fait demi-tour).
 *   npx tsx scripts/qc/render-siege.mts
 * Sortie : public/qc/siege.png
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { Resvg } from '@resvg/resvg-js';
import { propSvg } from '../../src/gameIso/catalog/decor';
import { DEFS } from '../../src/gameIso/sprites';

const ROTS = [0, 1, 2, 3] as const;
const LABELS = ['rot 0 (dos, regarde N)', 'rot 1', 'rot 2 (face)', 'rot 3'];

const CELL_W = 160, CELL_H = 200;
const W = ROTS.length * CELL_W, H = CELL_H;

const cells = ROTS.map((rot, i) => {
  const cx = i * CELL_W;
  const inner = propSvg('siege', 'N', rot);
  const ox = cx + (CELL_W - 120) / 2;
  return (
    `<g transform="translate(${ox},14)">${inner}</g>` +
    `<rect x="${cx + 4}" y="4" width="${CELL_W - 8}" height="${CELL_H - 8}" fill="none" stroke="#2a2f3a" stroke-width="1"/>` +
    `<text x="${cx + CELL_W / 2}" y="${CELL_H - 8}" fill="#e8e2d2" font-family="sans-serif" font-size="13" text-anchor="middle">${LABELS[i]}</text>`
  );
});

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}"><defs>${DEFS}</defs><rect width="${W}" height="${H}" fill="#1b1f29"/>${cells.join('')}</svg>`;
const png = new Resvg(svg, { fitTo: { mode: 'width', value: W * 2 }, font: { loadSystemFonts: true } }).render().asPng();
mkdirSync('public/qc', { recursive: true });
writeFileSync('public/qc/siege.png', png);
console.log('OK: public/qc/siege.png');
