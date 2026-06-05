/** Vérifie l'indexation des coiffures via appearance.parts.cheveux (0=défaut, 1+=pool). → public/qc/hair-pick.png */
import { writeFileSync } from 'node:fs';
import { Resvg } from '@resvg/resvg-js';
import { renderToStaticMarkup } from 'react-dom/server';
import React from 'react';
import { RigSprite } from '../src/gameIso/rig/composeRig';
import { DEFS } from '../src/gameIso/sprites';
import { HAIRSTYLES } from '../src/gameIso/rig/parts/generated/hairstyles';

const rows: string[] = [];
(['M', 'F'] as const).forEach((sex, r) => {
  const n = 1 + HAIRSTYLES[sex].length;
  for (let idx = 0; idx < n; idx++) {
    const app = { species: 'Humain', sex, build: 0.5, seed: 4, parts: { cheveux: idx } };
    const inner = renderToStaticMarkup(React.createElement(RigSprite, { appearance: app, equip: { weapons: [], armour: [] }, career: 'Mendiant' }));
    const x = idx * 88, y = r * 150;
    rows.push(`<g transform="translate(${x},${y})"><rect width="84" height="142" fill="#222a38"/><g transform="translate(-18,-4) scale(1.0)">${inner}</g><text x="42" y="138" text-anchor="middle" font-size="8" fill="#cdd" font-family="sans-serif">${sex} ${idx === 0 ? 'défaut' : idx}</text></g>`);
  }
});
const W = (1 + Math.max(HAIRSTYLES.M.length, HAIRSTYLES.F.length)) * 88, H = 2 * 150;
const full = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}"><defs>${DEFS}</defs>${rows.join('')}</svg>`;
writeFileSync('public/qc/hair-pick.png', new Resvg(full, { background: '#11141c', fitTo: { mode: 'width', value: W * 2 } }).render().asPng());
console.log('OK → public/qc/hair-pick.png');
