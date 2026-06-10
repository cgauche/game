/**
 * QC reconnaissabilité SP2 — montage des nouveaux décors fouillables + distracteurs (caisse/tonneau/
 * cadavre, pour tester les confusions coffre↔caisse etc.). Sans label = utilisable en check aveugle.
 * Usage : npx tsx scripts/_qc-sp2-decor.mts  → public/qc/sp2-decor.png
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { Resvg } from '@resvg/resvg-js';
import { DEFS } from '../src/gameIso/sprites';
import { PROPS } from '../src/gameIso/catalog/decor';

// Ordre MÉLANGÉ (coffre près de caisse pour tester la confusion). Nouveaux = lettre/coffre/cle/bourse/etagere.
const slugs = ['coffre', 'tonneau', 'lettre', 'caisse', 'bourse', 'cadavre', 'cle', 'etagere'];
mkdirSync('public/qc', { recursive: true });

const CW = 120, CH = 158;
const tiles = slugs.map((id, i) => {
  const p = PROPS[id];
  const g = p.render({}, { dims: { w: 0, h: 0 } } as any);
  return `<g transform="translate(${i * CW},0)"><rect width="${CW}" height="${CH}" fill="#46532f"/>${g}` +
    `<text x="8" y="18" font-size="12" fill="#ffffff" opacity="0.5">${i + 1}</text></g>`;
});
const W = slugs.length * CW;
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${CH}"><defs>${DEFS}</defs>${tiles.join('')}</svg>`;
writeFileSync('public/qc/sp2-decor.png', new Resvg(svg, { background: '#2a3320', fitTo: { mode: 'width', value: W * 3 } }).render().asPng());
console.log('wrote public/qc/sp2-decor.png — order:', slugs.join(', '));
