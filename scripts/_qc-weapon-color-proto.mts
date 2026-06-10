/**
 * PROTO couleur (jetable) : prouve la tokenisation d'une arme — rendu isolé en 4 variantes :
 *  original (dégradés) | tokenisé@défaut (doit ≈ original) | tokenisé@or | tokenisé@émeraude.
 * → public/qc/weapon-color-proto.png. Usage : npx tsx scripts/_qc-weapon-color-proto.mts
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { Resvg } from '@resvg/resvg-js';
import { DEFS } from '../src/gameIso/sprites';
import { buildTokenMap, applyTokenMap, type Palette } from '../src/gameIso/rig/palette';
import { weapon as EPEE } from '../src/gameIso/rig/parts/weapons/defs/epee_batarde';

// Art TOKENISÉ à la main (épée bâtarde) : dégradés métal → @metal (+ reflet @metalH), bruns
// manche → @cuir/@cuirO/@cuirH, garde dorée → @accent. Strokes outline gardés fixes.
const TOKENIZED = EPEE.art
  .replace(/url\(#g_steelD\)/g, '@metal')
  .replace(/url\(#g_steel\)/g, '@metal')
  .replace(/#cfd8e6/g, '@metalH')
  .replace(/#9aa6b4/g, '@metal')
  .replace(/#3a2814/g, '@cuirO')
  .replace(/#5a3f24/g, '@cuir')
  .replace(/#6a4a2a/g, '@cuirH')
  .replace(/#caa64a/g, '@accent');

// Palette STOCKÉE (ombres/reflets EXACTS d'origine → défaut sans perte sur les flats).
const STORED: Record<string, string> = {
  metal: '#9aa6b8', metalH: '#cfd8e6', metalO: '#5a6376',
  cuir: '#5a3f24', cuirO: '#3a2814', cuirH: '#6a4a2a',
  accent: '#caa64a',
};

const resolve = (overrides: Palette) => applyTokenMap(TOKENIZED, buildTokenMap(STORED, overrides));

const CELLS: Array<{ label: string; svg: string }> = [
  { label: 'original', svg: EPEE.art },
  { label: 'token @défaut', svg: resolve({}) },
  { label: 'token @or', svg: resolve({ metal: '#caa64a', accent: '#f0d878' }) },
  { label: 'token @émeraude', svg: resolve({ metal: '#3a9a6a', accent: '#d8e8a0' }) },
];

mkdirSync('public/qc', { recursive: true });
const CW = 80, CH = 110;
const tiles = CELLS.map((c, i) =>
  `<g transform="translate(${i * CW},0)"><rect width="${CW}" height="${CH}" fill="#1d2230"/>` +
  `<g transform="translate(${CW / 2},${CH - 18})">${c.svg}</g>` +
  `<text x="${CW / 2}" y="${CH - 4}" text-anchor="middle" font-size="7" fill="#cdd">${c.label}</text></g>`,
);
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${CELLS.length * CW} ${CH}"><defs>${DEFS}</defs>${tiles.join('')}</svg>`;
writeFileSync('public/qc/weapon-color-proto.png', new Resvg(svg, { background: '#11141c', fitTo: { mode: 'width', value: CELLS.length * CW * 4 } }).render().asPng());
console.log('OK → public/qc/weapon-color-proto.png');
