/** QC : mutants modulaires (rig + parts monstrueux par slot + arme équipée). → public/qc/monster.png */
import { writeFileSync } from 'node:fs';
import { Resvg } from '@resvg/resvg-js';
import { renderToStaticMarkup } from 'react-dom/server';
import React from 'react';
import { RigSprite } from '../src/gameIso/rig/composeRig';
import { DEFS } from '../src/gameIso/sprites';
import { carryPose } from '../src/gameIso/rig/anim/weaponClips';
import type { Appearance } from '../src/gameIso/rig/appearance';
import type { MonsterParts } from '../src/gameIso/rig/parts/monstrous';
import type { Weapon } from '../src/engine/types';

type Case = { label: string; monster: MonsterParts; weapon?: [string, 'melee' | 'ranged'] };
const CASES: Case[] = [
  { label: 'Knud (lézard+arbalète)', monster: { tete: 'lezard' }, weapon: ['Arbalète', 'ranged'] },
  { label: 'Mikael (tête chien)', monster: { tete: 'chien' } },
  { label: 'Johann (tête ogive)', monster: { tete: 'ogive' } },
  { label: 'Terenz (crétin+hache)', monster: { tete: 'minuscule' }, weapon: ['Hache', 'melee'] },
  { label: 'Erik (pattes de chèvre)', monster: { jambes: 'chevre' } },
  { label: 'Tentacule (bras G)', monster: { brasG: 'tentacule' } },
  { label: 'Cornes + queue', monster: { tete: 'chien', cornes: true, queue: true } },
  { label: 'Combo complet', monster: { tete: 'lezard', brasG: 'tentacule', brasD: 'griffe', jambes: 'chevre', cornes: true, queue: true } },
];
const cells = CASES.map((cse, i) => {
  const app: Appearance = { species: 'Humain', sex: 'M', build: 0.55, seed: 4, monster: cse.monster };
  const w = cse.weapon ? ({ name: cse.weapon[0], type: cse.weapon[1], damage: '+4', qualities: [] } as Weapon) : undefined;
  const svg = renderToStaticMarkup(
    React.createElement(RigSprite, { appearance: app, equip: { weapons: w ? [w] : [], armour: [] }, career: 'Mendiant', pose: w ? carryPose(w) : {} }),
  );
  const col = i % 4, row = Math.floor(i / 4);
  return `<g transform="translate(${col * 128},${row * 176})"><rect width="120" height="150" fill="#241d22"/>${svg}<text x="60" y="166" text-anchor="middle" font-size="10" fill="#e9c">${cse.label}</text></g>`;
});
const full = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${4 * 128} ${2 * 176}"><defs>${DEFS}</defs>${cells.join('')}</svg>`;
const r = new Resvg(full, { background: '#15111a', fitTo: { mode: 'width', value: 4 * 256 } });
writeFileSync('public/qc/monster.png', r.render().asPng());
console.log('OK → public/qc/monster.png');
