/**
 * PROTO diagnostic (jetable) : isole la source du penchant 2-mains en FRONT (axe rouge = centre).
 * Usage : npx tsx scripts/_qc-pose-proto.mts
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { Resvg } from '@resvg/resvg-js';
import { renderToStaticMarkup } from 'react-dom/server';
import React from 'react';
import { RigSprite } from '../src/gameIso/rig/composeRig';
import { DEFS } from '../src/gameIso/sprites';
import type { Pose } from '../src/gameIso/rig/poses';
import type { Weapon } from '../src/engine/types';

mkdirSync('public/qc', { recursive: true });
const APP = { species: 'Humain', sex: 'M', build: 0.5, seed: 4 } as const;
const HALL: Weapon = { name: 'Hallebarde', type: 'melee', damage: '+4', qualities: [] } as Weapon;
const AXIS = `<line x1="60" y1="0" x2="60" y2="150" stroke="#e44" stroke-width="0.5" opacity="0.6"/>`;

// On décompose la prise pour voir QUI penche : juste l'arme, +bras droit, +bras gauche (cross), variantes.
const PANES: Array<{ label: string; pose: Pose }> = [
  { label: 'arme seule', pose: { arme: -132 } },
  { label: '+brasD', pose: { arme: -132, epauleD: 12, avantBrasD: 6 } },
  { label: '+brasG cross', pose: { arme: -132, epauleD: 12, avantBrasD: 6, epauleG: 40, avantBrasG: 34 } },
  { label: 'grip + bassin -6', pose: { arme: -132, epauleD: 12, avantBrasD: 6, epauleG: 40, avantBrasG: 34, bassin: -6 } },
  { label: 'grip moins cross', pose: { arme: -140, epauleD: 16, avantBrasD: 10, epauleG: 26, avantBrasG: 30 } },
];

const COL_W = 124, ROW_H = 172;
const tiles = PANES.map((p, i) => {
  const x = (i % 5) * COL_W;
  const body = renderToStaticMarkup(React.createElement(RigSprite, { appearance: APP, equip: { weapons: [HALL], armour: [] }, career: 'Soldat', pose: p.pose, view: 'front' }));
  return `<g transform="translate(${x},0)"><rect width="120" height="150" fill="#1d2230"/>${body}${AXIS}<text x="60" y="164" text-anchor="middle" font-size="9" fill="#cdd">${p.label}</text></g>`;
});
const W = 5 * COL_W, H = ROW_H;
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}"><defs>${DEFS}</defs>${tiles.join('')}</svg>`;
writeFileSync('public/qc/pose-proto.png', new Resvg(svg, { background: '#11141c', fitTo: { mode: 'width', value: W * 2.4 } }).render().asPng());
console.log('OK → public/qc/pose-proto.png (lean isolation)');
