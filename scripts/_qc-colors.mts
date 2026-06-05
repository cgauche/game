/** QC : personnalisation couleur (palette) — défaut vs surcharges. → public/qc/colors.png */
import { writeFileSync } from 'node:fs';
import { Resvg } from '@resvg/resvg-js';
import { renderToStaticMarkup } from 'react-dom/server';
import React from 'react';
import { RigSprite } from '../src/gameIso/rig/composeRig';
import { DEFS } from '../src/gameIso/sprites';
import type { Appearance } from '../src/gameIso/rig/appearance';

const CASES: { label: string; app: Appearance }[] = [
  { label: 'Lézard défaut (vert)', app: { species: 'Humain', sex: 'M', build: 0.5, seed: 4, monster: { tete: 'lezard' } } },
  { label: 'Lézard peau bleue', app: { species: 'Humain', sex: 'M', build: 0.5, seed: 4, monster: { tete: 'lezard' }, colors: { peau: '#3f6fb0' } } },
  { label: 'Lézard peau rouge', app: { species: 'Humain', sex: 'M', build: 0.5, seed: 4, monster: { tete: 'lezard' }, colors: { peau: '#a83838' } } },
  { label: 'Chien défaut (fauve)', app: { species: 'Humain', sex: 'M', build: 0.5, seed: 4, monster: { tete: 'chien' } } },
  { label: 'Chien peau grise', app: { species: 'Humain', sex: 'M', build: 0.5, seed: 4, monster: { tete: 'chien' }, colors: { peau: '#8a8f96' } } },
  { label: 'Mendiant + peau verte', app: { species: 'Humain', sex: 'M', build: 0.5, seed: 4, colors: { peau: '#5d7a42' } } },
];
const cells = CASES.map((c, i) => {
  const svg = renderToStaticMarkup(React.createElement(RigSprite, { appearance: c.app, equip: { weapons: [], armour: [] }, career: 'Mendiant' }));
  const col = i % 3, row = Math.floor(i / 3);
  return `<g transform="translate(${col * 128},${row * 168})"><rect width="120" height="150" fill="#1d2230"/>${svg}<text x="60" y="164" text-anchor="middle" font-size="10" fill="#cdd">${c.label}</text></g>`;
});
const full = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${3 * 128} ${2 * 168}"><defs>${DEFS}</defs>${cells.join('')}</svg>`;
const r = new Resvg(full, { background: '#11141c', fitTo: { mode: 'width', value: 3 * 256 } });
writeFileSync('public/qc/colors.png', r.render().asPng());
console.log('OK → public/qc/colors.png');
