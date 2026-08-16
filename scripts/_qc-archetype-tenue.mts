/**
 * QC des tenues hors-humain (Ogre) et d'une carrière humaine : rendu en DÉFAUT (doit être
 * lisible/correct) + RECOLORÉ (preuve que la palette se thème EXACTEMENT de la même manière pour
 * toutes). Soldat sert de non-régression humaine.
 * → public/qc/archetype-tenue.png. Usage : npx tsx scripts/_qc-archetype-tenue.mts
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { Resvg } from '@resvg/resvg-js';
import { renderToStaticMarkup } from 'react-dom/server';
import React from 'react';
import { RigSprite } from '../src/gameIso/rig/composeRig';
import { DEFS } from '../src/gameIso/sprites';
import type { Palette } from '../src/gameIso/rig/palette';
import type { RigSpeciesId } from '../src/gameIso/rig/appearance';
import { assertWardrobeId } from './_lib-wardrobe';

// (libellé affiché, espèce, ID de garde-robe, recolor?) — le libellé n'est QUE de l'affichage.
const ROWS: Array<{ label: string; species: string; career: string; colors?: Palette }> = [
  { label: 'Mangeur d’hommes', species: 'Ogre', career: 'mangeur-d-hommes' },
  { label: 'recolor vet2/metal', species: 'Ogre', career: 'mangeur-d-hommes', colors: { metal: '#b8863a', vet2: '#5a1818' } },
  { label: 'Boucher Ogre', species: 'Ogre', career: 'boucher-ogre' },
  { label: 'recolor vet1', species: 'Ogre', career: 'boucher-ogre', colors: { vet1: '#6a2a2a' } },
  { label: 'Gardechamps', species: 'Humain', career: 'gardechamps' },
  { label: 'Soldat\nnon-régression', species: 'Humain', career: 'soldat' },
];
// Garde fail-fast : un id qui retombe sur « nu » viderait la sonde de son objet (#1338).
for (const r of ROWS)
  assertWardrobeId(r.career, 'qc-archetype-tenue');

mkdirSync('public/qc', { recursive: true });
const CW = 124, CH = 168;
const tiles = ROWS.map((r, i) => {
  const appearance = { species: r.species as RigSpeciesId, sex: 'M', build: 0.5, seed: 4, colors: r.colors } as const;
  const body = renderToStaticMarkup(React.createElement(RigSprite, { appearance, equip: { weapons: [], armour: [] }, career: r.career, view: 'front' }));
  const lines = r.label.split('\n');
  const txt = lines.map((l, j) => `<text x="60" y="${150 + 8 + j * 8}" text-anchor="middle" font-size="7" fill="#cdd">${l}</text>`).join('');
  return `<g transform="translate(${(i % 3) * CW},${Math.floor(i / 3) * CH})"><rect width="120" height="150" fill="#1d2230"/>${body}${txt}</g>`;
});
const W = 3 * CW, H = 2 * CH;
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}"><defs>${DEFS}</defs>${tiles.join('')}</svg>`;
writeFileSync('public/qc/archetype-tenue.png', new Resvg(svg, { background: '#11141c', fitTo: { mode: 'width', value: W * 2.4 } }).render().asPng());
console.log('OK → public/qc/archetype-tenue.png');
