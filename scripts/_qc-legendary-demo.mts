/**
 * DÉMO objet légendaire de bout en bout : un ItemInstance.skin → recomputeLoadout →
 * Weapon.skin → rendu sur modèle (le héros tient l'arme RECOLORÉE). Prouve toute la chaîne.
 * → public/qc/legendary-demo.png. Usage : npx tsx scripts/_qc-legendary-demo.mts
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { Resvg } from '@resvg/resvg-js';
import { renderToStaticMarkup } from 'react-dom/server';
import React from 'react';
import { RigSprite } from '../src/gameIso/rig/composeRig';
import { DEFS } from '../src/gameIso/sprites';
import { weaponRest } from '../src/gameIso/rig/anim/weaponClips';
import { recomputeLoadout } from '../src/engine/items';
import type { Combatant, ItemInstance } from '../src/engine/types';
import { asRigSpeciesId } from '../src/gameIso/rig/appearance';
import { assertWardrobeId } from './_lib-wardrobe';

// Mannequin : ID de garde-robe (carrière ∪ classe ∪ tenue), validé fail-fast — un id qui retombe
// sur « nu » déshabillerait la planche en silence (#1338).
const MANNEQUIN = 'soldat';
assertWardrobeId(MANNEQUIN, 'qc-legendary-demo');

const APP = { species: asRigSpeciesId('humain'), sex: 'M', build: 0.5, seed: 4 } as const;

/** Construit un héros tenant une épée bâtarde, avec ou sans skin légendaire, via la VRAIE chaîne. */
function heroWeapon(skin?: Record<string, string>) {
  const it = { uid: 'leg', label: 'Épée bâtarde', kind: 'melee', damage: { plusBF: true, flat: 5 }, qualities: [], enc: 1, equipped: true, skin } as ItemInstance;
  const c = { characteristics: { F: 35, E: 35 }, items: [it] } as unknown as Combatant;
  recomputeLoadout(c); // ItemInstance.skin → Weapon.skin
  return c.weapons[0];
}

const cell = (label: string, skin?: Record<string, string>) => {
  const w = heroWeapon(skin);
  const body = renderToStaticMarkup(React.createElement(RigSprite, {
    appearance: APP, equip: { weapons: [w], armour: [] }, career: MANNEQUIN, pose: weaponRest(w), view: 'profile',
  }));
  return `<rect width="120" height="150" fill="#1d2230"/>${body}<text x="60" y="164" text-anchor="middle" font-size="10" fill="#cdd">${label}</text>`;
};

const CELLS: Array<{ label: string; skin?: Record<string, string> }> = [
  { label: 'défaut (acier)' },
  { label: 'Lame du Crépuscule', skin: { metal: '#caa64a', metalH: '#f4e08a', accent: '#fff0b0' } },
  { label: 'Lame de Sang', skin: { metal: '#b23030', metalH: '#e85a4a', cuir: '#2a2026' } },
];

mkdirSync('public/qc', { recursive: true });
const CW = 124, CH = 172;
const tiles = CELLS.map((c, i) => `<g transform="translate(${i * CW},0)">${cell(c.label, c.skin)}</g>`);
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${CELLS.length * CW} ${CH}"><defs>${DEFS}</defs>${tiles.join('')}</svg>`;
writeFileSync('public/qc/legendary-demo.png', new Resvg(svg, { background: '#11141c', fitTo: { mode: 'width', value: CELLS.length * CW * 2.4 } }).render().asPng());
console.log('OK → public/qc/legendary-demo.png');
