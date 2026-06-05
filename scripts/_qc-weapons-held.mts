/** QC : rig tenant un échantillon d'armes représentatif. → public/qc/weapons-held.png */
import { writeFileSync } from 'node:fs';
import { Resvg } from '@resvg/resvg-js';
import { renderToStaticMarkup } from 'react-dom/server';
import React from 'react';
import { RigSprite } from '../src/gameIso/rig/composeRig';
import { DEFS } from '../src/gameIso/sprites';
import type { Weapon } from '../src/engine/types';

const SAMPLE: [string, 'melee' | 'ranged'][] = [
  ['Zweihänder', 'melee'], ['Grande hache', 'melee'], ['Marteau de guerre', 'melee'], ['Rapière', 'melee'],
  ['Hallebarde', 'melee'], ['Pique', 'melee'], ['Fléau d\'armes', 'melee'], ['Main Gauche', 'melee'],
  ['Arc long', 'ranged'], ['Arbalète lourde', 'ranged'], ['Pistolet', 'ranged'], ['Tromblon', 'ranged'],
  ['Fronde', 'ranged'], ['Javelot', 'ranged'], ['Fouet', 'ranged'], ['Bombe', 'ranged'],
];
const cells = SAMPLE.map(([name, type], i) => {
  const svg = renderToStaticMarkup(
    React.createElement(RigSprite, { appearance: { species: 'Humain', sex: 'M', build: 0.5, seed: 4 }, equip: { weapons: [{ name, type, damage: '+4', qualities: [] } as Weapon], armour: [] }, career: 'Soldat' }),
  );
  const col = i % 8, row = Math.floor(i / 8);
  return `<g transform="translate(${col * 124},${row * 168})"><rect width="120" height="150" fill="#1d2230"/>${svg}<text x="60" y="164" text-anchor="middle" font-size="11" fill="#cdd">${name}</text></g>`;
});
const full = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${8 * 124} ${2 * 168}"><defs>${DEFS}</defs>${cells.join('')}</svg>`;
const r = new Resvg(full, { background: '#11141c', fitTo: { mode: 'width', value: 8 * 248 } });
writeFileSync('public/qc/weapons-held.png', r.render().asPng());
console.log('OK → public/qc/weapons-held.png');
