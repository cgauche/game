/** QC : les coiffures générées, rendues sur une tête (cheveux bruns). → public/qc/hairstyles.png */
import { readFileSync, writeFileSync } from 'node:fs';
import { Resvg } from '@resvg/resvg-js';
import { GENERATED_HEADS } from '../src/gameIso/rig/parts/generated/heads';
import { SPECIES_PALETTES } from '../src/gameIso/rig/parts/generated/speciesPalettes';
import { buildTokenMap, applyTokenMap } from '../src/gameIso/rig/palette';
import { DEFS } from '../src/gameIso/sprites';

const hairs: { sex: 'M' | 'F'; style: string; svg: string }[] = JSON.parse(readFileSync('public/qc/hairstyles-raw.json', 'utf8'));
const COLS = 4;
const cells = hairs.map((h, i) => {
  const key = `Humain:${h.sex}`;
  const tmap = buildTokenMap(SPECIES_PALETTES[key] ?? {}, {});
  const visage = applyTokenMap((GENERATED_HEADS[key] as { visage?: string }).visage ?? '', tmap);
  const hair = applyTokenMap(h.svg.replace(/<!--scalp-->/g, ''), tmap);
  const inner = `<g>${hair}</g><g>${visage}</g>`;
  const x = (i % COLS) * 96, y = Math.floor(i / COLS) * 124;
  return `<g transform="translate(${x},${y})"><rect width="92" height="118" fill="#2b3142"/>` +
    `<g transform="translate(46,42) scale(2.5)">${inner}</g>` +
    `<text x="46" y="113" text-anchor="middle" font-size="6.5" fill="#cdd" font-family="sans-serif">${i + 1}. ${h.sex} ${h.style.slice(0, 26)}</text></g>`;
});
const W = COLS * 96, H = Math.ceil(hairs.length / COLS) * 124;
const full = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}"><defs>${DEFS}</defs>${cells.join('')}</svg>`;
writeFileSync('public/qc/hairstyles.png', new Resvg(full, { background: '#11141c', fitTo: { mode: 'width', value: W * 2.4 } }).render().asPng());
console.log('OK → public/qc/hairstyles.png');
