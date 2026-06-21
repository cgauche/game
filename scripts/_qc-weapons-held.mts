/**
 * QC « sur modèle » : le rig (Soldat humain M) tient CHAQUE arme/bouclier.
 * → public/qc/held-<slug>.png (individuel, pour audit) + public/qc/weapons-held.png (montage).
 * Usage : npx tsx scripts/_qc-weapons-held.mts
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { Resvg } from '@resvg/resvg-js';
import { renderToStaticMarkup } from 'react-dom/server';
import React from 'react';
import { RigSprite } from '../src/gameIso/rig/composeRig';
import { DEFS } from '../src/gameIso/sprites';
import { WEAPON_FORMS, SHIELD_FORMS } from '../src/gameIso/rig/parts/weaponForms';
import { weaponRest } from '../src/gameIso/rig/anim/weaponClips';
import type { Weapon } from '../src/engine/types';

mkdirSync('public/qc', { recursive: true });
const APP = { species: 'Humain', sex: 'M', build: 0.5, seed: 4 } as const;
type Cell = { slug: string; label: string; svg: string };

// Applique la PRISE/orientation réelle du jeu (weaponRest) pour un rendu fidèle.
const rig = (equip: { weapons: Weapon[]; armour: never[]; shield?: Weapon }) =>
  renderToStaticMarkup(React.createElement(RigSprite, { appearance: APP, equip, career: 'Soldat', pose: weaponRest(equip.weapons[0]) }));

const cells: Cell[] = [
  ...WEAPON_FORMS.map((f) => ({ slug: f.slug, label: f.label, svg: rig({ weapons: [{ name: f.label, type: f.type, damage: { plusBF: false, flat: 4 }, qualities: [] } as Weapon], armour: [] }) })),
  ...SHIELD_FORMS.map((s) => {
    const sh = { name: s.label, type: 'melee', damage: { plusBF: false, flat: 0 }, qualities: ['Bouclier'] } as Weapon;
    return { slug: `shield_${s.slug}`, label: s.label, svg: rig({ weapons: [], armour: [], shield: sh }) };
  }),
];

// PNG individuels (pour l'audit sur-modèle)
for (const c of cells) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 150"><defs>${DEFS}</defs><rect width="120" height="150" fill="#1d2230"/>${c.svg}</svg>`;
  writeFileSync(`public/qc/held-${c.slug}.png`, new Resvg(svg, { background: '#11141c', fitTo: { mode: 'width', value: 240 } }).render().asPng());
}

// Montage (relecture à l'œil)
const COLS = 8;
const tiles = cells.map((c, i) => {
  const col = i % COLS, row = Math.floor(i / COLS);
  return `<g transform="translate(${col * 124},${row * 168})"><rect width="120" height="150" fill="#1d2230"/>${c.svg}<text x="60" y="164" text-anchor="middle" font-size="10" fill="#cdd">${c.label}</text></g>`;
});
const rows = Math.ceil(cells.length / COLS);
const full = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${COLS * 124} ${rows * 168}"><defs>${DEFS}</defs>${tiles.join('')}</svg>`;
writeFileSync('public/qc/weapons-held.png', new Resvg(full, { background: '#11141c', fitTo: { mode: 'width', value: COLS * 248 } }).render().asPng());
console.log(`OK → ${cells.length} held-*.png + public/qc/weapons-held.png`);
