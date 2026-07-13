/** QC recoloriage : carrière défaut vs surcharges palette. → public/qc/tenue-recolor.png */
import { mkdirSync, writeFileSync } from 'node:fs';
import { Resvg } from '@resvg/resvg-js';
import { renderToStaticMarkup } from 'react-dom/server';
import React from 'react';
import { RigSprite } from '../src/gameIso/rig/composeRig';
import { DEFS } from '../src/gameIso/sprites';
import type { Appearance, RigSpeciesId } from '../src/gameIso/rig/appearance';
import type { Palette } from '../src/gameIso/rig/palette';

const app = (colors?: Palette): Appearance => ({ species: 'Humain' as RigSpeciesId, sex: 'M', build: 0.5, seed: 4, colors });
const CASES: { career: string; label: string; colors?: Palette }[] = [
  { career: 'Batelier', label: 'Batelier défaut' },
  { career: 'Batelier', label: 'vet1 rouge', colors: { vet1: '#a83838' } },
  { career: 'Batelier', label: 'vet1 bleu + vet2 violet', colors: { vet1: '#3f6fb0', vet2: '#6a3a8a' } },
  { career: 'Médecin', label: 'Médecin défaut' },
  { career: 'Médecin', label: 'vet1 vert', colors: { vet1: '#3f7a3c' } },
  { career: 'Soldat', label: 'Soldat metal→bronze', colors: { metal: '#a87038' } },
];
const cells = CASES.map((c, i) => {
  const inner = renderToStaticMarkup(React.createElement(RigSprite, { appearance: app(c.colors), equip: { weapons: [], armour: [] }, career: c.career }));
  const x = (i % 3) * 130, y = Math.floor(i / 3) * 175;
  return `<g transform="translate(${x},${y})"><rect width="124" height="156" fill="#222a38"/>${inner}` +
    `<text x="62" y="170" text-anchor="middle" font-size="9" fill="#cdd" font-family="sans-serif">${c.label}</text></g>`;
});
mkdirSync('public/qc', { recursive: true });
const full = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${3 * 130} ${2 * 175}"><defs>${DEFS}</defs>${cells.join('')}</svg>`;
writeFileSync('public/qc/tenue-recolor.png', new Resvg(full, { background: '#11141c', fitTo: { mode: 'width', value: 780 } }).render().asPng());
console.log('OK → public/qc/tenue-recolor.png');
