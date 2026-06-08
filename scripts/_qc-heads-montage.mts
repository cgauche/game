/** Montage QC des 10 têtes : défaut par espèce + 1 ligne recolor. → public/qc/heads.png */
import { writeFileSync } from 'node:fs';
import { Resvg } from '@resvg/resvg-js';
import { GENERATED_HEADS } from '../src/gameIso/rig/parts/generated/heads';
import { racePalette } from '../src/gameIso/rig/races';
import { buildTokenMap, applyTokenMap, type Palette } from '../src/gameIso/rig/palette';
import { DEFS } from '../src/gameIso/sprites';

const keys = Object.keys(GENERATED_HEADS);
const cell = (key: string, overrides: Palette, label: string, x: number, y: number) => {
  const h = GENERATED_HEADS[key] as { visage?: string; cheveux?: string };
  const [raceId, sexStr] = key.split(':');
  const tmap = buildTokenMap(racePalette(raceId, sexStr as 'M' | 'F'), overrides);
  const inner = `<g>${applyTokenMap(h.cheveux ?? '', tmap)}</g><g>${applyTokenMap(h.visage ?? '', tmap)}</g>`;
  return `<g transform="translate(${x},${y})"><rect width="86" height="104" fill="#2b3142"/>` +
    `<g transform="translate(43,30) scale(2.5)">${inner}</g>` +
    `<text x="43" y="100" text-anchor="middle" font-size="7" fill="#cdd" font-family="sans-serif">${label}</text></g>`;
};

const COLS = 5;
const cells: string[] = [];
// Ligne(s) défaut : 10 têtes.
keys.forEach((k, i) => cells.push(cell(k, {}, k, (i % COLS) * 90, Math.floor(i / COLS) * 112)));
// Ligne recolor : yeux bleus / cheveux roux / peau pâle sur 5 têtes.
const recolor: Palette = { yeux: '#2f6ac0', cheveux: '#a0331e', peau: '#d8b48a' };
['Humain:M', 'Humain:F', 'Nain:M', 'Halfling:M', 'Haut-Elfe:F'].forEach((k, i) =>
  cells.push(cell(k, recolor, `${k} (recolor)`, (i % COLS) * 90, (2 + Math.floor(i / COLS)) * 112)));

const W = COLS * 90, H = 3 * 112 + 8;
const full = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}"><defs>${DEFS}</defs>${cells.join('')}</svg>`;
writeFileSync('public/qc/heads.png', new Resvg(full, { background: '#11141c', fitTo: { mode: 'width', value: W * 2 } }).render().asPng());
console.log('OK → public/qc/heads.png');
