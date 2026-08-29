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
import { asRigSpeciesId } from '../src/gameIso/rig/appearance';
import { assertWardrobeId } from './_lib-wardrobe';

// Mannequin : ID de garde-robe (carrière ∪ classe ∪ tenue), validé fail-fast — un id qui retombe
// sur « nu » déshabillerait la planche en silence (#1338).
const MANNEQUIN = 'soldat';
assertWardrobeId(MANNEQUIN, 'qc-ranged-carry');

const SAMPLE: [string, 'melee' | 'ranged'][] = [
  ['Arbalète lourde', 'ranged'], ['Arc long', 'ranged'], ['Pistolet', 'ranged'], ['Arquebuse', 'ranged'], ['Épée', 'melee'],
];
const cells = SAMPLE.map(([name, type], i) => {
  const w = { label: name, type, damage: { plusBF: false, flat: 4 }, qualities: [] } as Weapon;
  const svg = renderToStaticMarkup(
    React.createElement(RigSprite, { appearance: { species: asRigSpeciesId('humain'), sex: 'M', build: 0.5, seed: 4 }, equip: { weapons: [w], armour: [] }, career: MANNEQUIN, pose: weaponRest(w) }),
  );
  return `<g transform="translate(${i * 124},0)"><rect width="120" height="150" fill="#1d2230"/>${svg}<text x="60" y="164" text-anchor="middle" font-size="11" fill="#cdd">${name}</text></g>`;
});
const full = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${SAMPLE.length * 124} 172"><defs>${DEFS}</defs>${cells.join('')}</svg>`;
const r = new Resvg(full, { background: '#11141c', fitTo: { mode: 'width', value: SAMPLE.length * 248 } });
writeFileSync('public/qc/ranged-carry.png', r.render().asPng());
console.log('OK → public/qc/ranged-carry.png');
