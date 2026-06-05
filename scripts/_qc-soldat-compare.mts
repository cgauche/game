import { writeFileSync } from 'node:fs';
import { Resvg } from '@resvg/resvg-js';
import { renderToStaticMarkup } from 'react-dom/server';
import React from 'react';
import { RigSprite } from '../src/gameIso/rig/composeRig';
import { DEFS } from '../src/gameIso/sprites';
const careers = ['Soldat', 'Mendiant', 'Villageois', 'Noble', 'Garde'];
const cells = careers.map((c, i) => {
  const inner = renderToStaticMarkup(React.createElement(RigSprite, { appearance: { species: 'Humain', sex: 'M', build: 0.5, seed: 4 }, equip: { weapons: [], armour: [] }, career: c }));
  const x = i * 150;
  return `<g transform="translate(${x},0)"><rect width="146" height="180" fill="#222a38"/><g transform="translate(13,8) scale(1.05)">${inner}</g><text x="73" y="196" text-anchor="middle" font-size="11" fill="#cdd" font-family="sans-serif">${c}</text></g>`;
});
const full = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${careers.length * 150} 205"><defs>${DEFS}</defs>${cells.join('')}</svg>`;
writeFileSync('public/qc/_soldat-compare.png', new Resvg(full, { background: '#11141c', fitTo: { mode: 'width', value: 1050 } }).render().asPng());
console.log('OK → public/qc/_soldat-compare.png');
