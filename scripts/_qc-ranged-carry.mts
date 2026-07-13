/** QC : rig au REPOS (weaponRest) tenant des armes à distance → doit être épaulé/visé,
 *  pas pendant. → public/qc/ranged-carry.png */
import { writeFileSync } from 'node:fs';
import { Resvg } from '@resvg/resvg-js';
import { renderToStaticMarkup } from 'react-dom/server';
import React from 'react';
import { RigSprite } from '../src/gameIso/rig/composeRig';
import { DEFS } from '../src/gameIso/sprites';
import { weaponRest } from '../src/gameIso/rig/anim/weaponClips';
import type { Weapon } from '../src/engine/types';
import type { RigSpeciesId } from '../src/gameIso/rig/appearance';

const SAMPLE: [string, 'melee' | 'ranged'][] = [
  ['Arbalète lourde', 'ranged'], ['Arc long', 'ranged'], ['Pistolet', 'ranged'], ['Arquebuse', 'ranged'], ['Épée', 'melee'],
];
const cells = SAMPLE.map(([name, type], i) => {
  const w = { name, type, damage: { plusBF: false, flat: 4 }, qualities: [] } as Weapon;
  const svg = renderToStaticMarkup(
    React.createElement(RigSprite, { appearance: { species: 'Humain' as RigSpeciesId, sex: 'M', build: 0.5, seed: 4 }, equip: { weapons: [w], armour: [] }, career: 'Soldat', pose: weaponRest(w) }),
  );
  return `<g transform="translate(${i * 124},0)"><rect width="120" height="150" fill="#1d2230"/>${svg}<text x="60" y="164" text-anchor="middle" font-size="11" fill="#cdd">${name}</text></g>`;
});
const full = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${SAMPLE.length * 124} 172"><defs>${DEFS}</defs>${cells.join('')}</svg>`;
const r = new Resvg(full, { background: '#11141c', fitTo: { mode: 'width', value: SAMPLE.length * 248 } });
writeFileSync('public/qc/ranged-carry.png', r.render().asPng());
console.log('OK → public/qc/ranged-carry.png');
