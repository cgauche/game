/** QC — planche des NOUVEAUX props de l'Opéra (vue de face), pour vérifier la lisibilité au 1er coup d'œil.
 *  npx tsx scripts/qc/opera-newprops.mts → public/qc/opera-newprops.png */
import { writeFileSync, mkdirSync } from 'node:fs';
import { Resvg } from '@resvg/resvg-js';
import { propSvg } from '../../src/gameIso/catalog/decor';
import { DEFS } from '../../src/gameIso/sprites';

const ids = ['banc', 'coiffeuse', 'portant-costumes', 'paravent', 'decor-flat', 'scie-chevalet', 'canape'];
const cols = 4, cw = 140, ch = 180;
const cells = ids.map((id, i) => {
  const cx = (i % cols) * cw, cy = Math.floor(i / cols) * ch;
  return `<g transform="translate(${cx},${cy})"><rect width="${cw}" height="${ch}" fill="#2a2d38"/>` +
    `<g transform="translate(10,15)">${propSvg(id, 'S', 0)}</g>` +
    `<text x="${cw / 2}" y="${ch - 8}" fill="#e8e0cc" font-size="13" text-anchor="middle">${id}</text></g>`;
}).join('');
const w = cols * cw, h = Math.ceil(ids.length / cols) * ch;
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}"><defs>${DEFS}</defs><rect width="${w}" height="${h}" fill="#1a1d27"/>${cells}</svg>`;
mkdirSync('public/qc', { recursive: true });
writeFileSync('public/qc/opera-newprops.png', new Resvg(svg, { fitTo: { mode: 'width', value: w * 1.6 }, font: { loadSystemFonts: true } }).render().asPng());
console.log('OK: public/qc/opera-newprops.png');
