/** QC ponctuel : rig de chaque espèce (M) sur boîte 120×150 + ligne de sol y=150,
 *  pour vérifier l'ancrage au sol ET la connexion des membres. → public/qc/species.png */
import { writeFileSync } from 'node:fs';
import { Resvg } from '@resvg/resvg-js';
import { renderToStaticMarkup } from 'react-dom/server';
import React from 'react';
import { RigSprite } from '../src/gameIso/rig/composeRig';
import { DEFS } from '../src/gameIso/sprites';
import type { Weapon } from '../src/engine/types';
import { asRigSpeciesId } from '../src/gameIso/rig/appearance';
import { raceAppearance } from '../src/data';
import { assertWardrobeId } from './_lib-wardrobe';

// Mannequin : ID de garde-robe (carrière ∪ classe ∪ tenue), validé fail-fast — un id qui retombe
// sur « nu » déshabillerait la planche en silence (#1338).
const MANNEQUIN = 'soldat';
assertWardrobeId(MANNEQUIN, 'qc-species');

// Espèces sondées : le registre `raceAppearance.json` fait foi.
const SPECIES = raceAppearance.map((r) => ({ id: asRigSpeciesId(r.id), label: r.label }));
const wep = (name: string): Weapon => ({ label: name, type: 'melee', damage: { plusBF: false, flat: 4 }, qualities: [] } as Weapon);

const cells = SPECIES.map((sp, i) => {
  const svg = renderToStaticMarkup(
    React.createElement('svg', { viewBox: '0 0 120 158', width: 120, height: 158 },
      React.createElement('defs', { dangerouslySetInnerHTML: { __html: DEFS } }),
      React.createElement('rect', { x: 0, y: 0, width: 120, height: 158, fill: '#1d2230' }),
      // ligne de sol y=150
      React.createElement('line', { x1: 0, y1: 150, x2: 120, y2: 150, stroke: '#e05a5a', strokeWidth: 1, strokeDasharray: '4 3' }),
      React.createElement(RigSprite, { appearance: { species: sp.id, sex: 'M', build: 0.5, seed: 7 }, equip: { weapons: [wep('Épée')], armour: [] }, career: MANNEQUIN }),
    ),
  );
  return `<g transform="translate(${i * 130},0)">${svg.replace(/^<svg[^>]*>/, '').replace(/<\/svg>$/, '')}<text x="60" y="156" text-anchor="middle" font-size="9" fill="#9fb3c8">${sp.label}</text></g>`;
});
const full = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${SPECIES.length * 130} 158"><defs>${DEFS}</defs>${cells.join('')}</svg>`;
const r = new Resvg(full, { background: '#0e141b', fitTo: { mode: 'width', value: SPECIES.length * 260 } });
writeFileSync('public/qc/species.png', r.render().asPng());
console.log('OK → public/qc/species.png');
