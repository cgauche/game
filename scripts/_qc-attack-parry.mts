/** Cohérence garde / attaque / parade par arme (toutes composées sur weaponRest). → public/qc/attack-parry.png */
import { writeFileSync } from 'node:fs';
import { Resvg } from '@resvg/resvg-js';
import { renderToStaticMarkup } from 'react-dom/server';
import React from 'react';
import { RigSprite } from '../src/gameIso/rig/composeRig';
import { DEFS } from '../src/gameIso/sprites';
import { weaponRest, weaponAttackClip, weaponParryClip } from '../src/gameIso/rig/anim/weaponClips';
import { addPose } from '../src/gameIso/rig/poses';
import type { Weapon } from '../src/engine/types';
import type { RigSpeciesId } from '../src/gameIso/rig/appearance';

const WEAPONS = ['Épée', 'Rapière', 'Zweihänder', 'Fléau d\'armes', 'Hallebarde', 'Main Gauche', 'Mains nues'];
const wpn = (name: string): Weapon => ({ name, type: 'melee', damage: { plusBF: false, flat: 0 }, qualities: [] });
const peak = (steps: { pose: Record<string, number> }[]) => steps.reduce((a, s) => (Object.keys(s.pose).length > Object.keys(a).length ? s.pose : a), {} as Record<string, number>);

const CW = 118, CH = 168;
const cells: string[] = [];
WEAPONS.forEach((name, r) => {
  const w = wpn(name);
  const carry = weaponRest(w);
  const cols = [
    { l: 'garde', pose: carry },
    { l: 'attaque (pic)', pose: addPose(carry, peak(weaponAttackClip(w).steps)) },
    { l: 'parade', pose: addPose(carry, weaponParryClip(w, false).steps[0].pose) },
  ];
  cells.push(`<text x="6" y="${28 + r * CH + CH / 2}" font-size="9" fill="#9fb0c8" font-family="sans-serif">${name}</text>`);
  cols.forEach((col, ci) => {
    const inner = renderToStaticMarkup(React.createElement(RigSprite, { appearance: { species: 'Humain' as RigSpeciesId, sex: 'M', build: 0.5, seed: 4 }, equip: { weapons: [w], armour: [] }, career: 'Soldat', view: 'front', pose: col.pose }));
    const x = 96 + ci * CW, y = 28 + r * CH;
    cells.push(`<g transform="translate(${x},${y})"><rect width="${CW - 4}" height="${CH - 14}" fill="#262d3b"/><line x1="0" y1="150" x2="${CW - 4}" y2="150" stroke="#e06a4a" stroke-width="0.5"/>${inner}<text x="${(CW - 4) / 2}" y="${CH - 3}" text-anchor="middle" font-size="8" fill="#cdd" font-family="sans-serif">${col.l}</text></g>`);
  });
});
const W = 96 + 3 * CW, H = 28 + WEAPONS.length * CH;
const full = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}"><defs>${DEFS}</defs><rect width="${W}" height="${H}" fill="#11141c"/><text x="12" y="18" font-size="14" fill="#d8a93b" font-family="sans-serif">Garde / Attaque / Parade — cohérence par arme</text>${cells.join('')}</svg>`;
writeFileSync('public/qc/attack-parry.png', new Resvg(full, { background: '#11141c', fitTo: { mode: 'width', value: W * 2 } }).render().asPng());
console.log('OK → public/qc/attack-parry.png');
