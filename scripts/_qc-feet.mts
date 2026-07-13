/** QC : pieds directionnels (front/back/profile) sur 2 tenues. → public/qc/feet.png */
import { writeFileSync } from 'node:fs';
import { Resvg } from '@resvg/resvg-js';
import { renderToStaticMarkup } from 'react-dom/server';
import React from 'react';
import { RigSprite } from '../src/gameIso/rig/composeRig';
import { DEFS } from '../src/gameIso/sprites';
import type { RigSpeciesId } from '../src/gameIso/rig/appearance';

const CASES = [
  { label: 'Soldat', career: 'Soldat' },
  { label: 'Mendiant', career: 'Mendiant' },
];
const VIEWS = ['front', 'back', 'profile'] as const;
const cells: string[] = [];
CASES.forEach((cse, r) => {
  VIEWS.forEach((view, c) => {
    const svg = renderToStaticMarkup(
      React.createElement(RigSprite, { appearance: { species: 'Humain' as RigSpeciesId, sex: 'M', build: 0.5, seed: 4 }, equip: { weapons: [], armour: [] }, career: cse.career, view }),
    );
    cells.push(`<g transform="translate(${c * 124},${r * 168})"><rect width="120" height="150" fill="#1d2230"/>${svg}<text x="60" y="164" text-anchor="middle" font-size="10" fill="#cdd">${cse.label} / ${view}</text></g>`);
  });
});
const full = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${3 * 124} ${2 * 168}"><defs>${DEFS}</defs>${cells.join('')}</svg>`;
// Gros zoom sur le bas (pieds) en plus.
const r = new Resvg(full, { background: '#11141c', fitTo: { mode: 'width', value: 3 * 300 } });
writeFileSync('public/qc/feet.png', r.render().asPng());
console.log('OK → public/qc/feet.png');
