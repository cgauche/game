/** QC pose de mort : debout vs sprawl doux basculé (78/82/86°). → public/qc/death.png */
import { mkdirSync, writeFileSync } from 'node:fs';
import { Resvg } from '@resvg/resvg-js';
import { renderToStaticMarkup } from 'react-dom/server';
import React from 'react';
import { RigSprite } from '../src/gameIso/rig/composeRig';
import { DEFS } from '../src/gameIso/sprites';
import type { Appearance, RigSpeciesId } from '../src/gameIso/rig/appearance';
import type { Pose } from '../src/gameIso/rig/poses';

const app: Appearance = { species: 'Humain' as RigSpeciesId, sex: 'M', build: 0.5, seed: 4 };
// Sprawl DOUX (membres relâchés/écartés) — le basculement fait la mise au sol.
const CORPSE: Pose = { tete: 18, torse: 6, epauleG: -30, epauleD: 24, avantBrasG: -14, avantBrasD: 10, cuisseG: 14, cuisseD: -10, tibiaG: 18, tibiaD: 6 };
const sprite = (pose?: Pose) =>
  renderToStaticMarkup(React.createElement(RigSprite, { appearance: app, equip: { weapons: [], armour: [] }, career: 'Soldat', pose: pose ?? {} }));

const cells = [
  { label: 'Debout', inner: sprite() },
  { label: 'Sprawl, sans bascule', inner: sprite(CORPSE) },
  { label: 'Sprawl + bascule 78°', inner: `<g transform="rotate(78 60 150)">${sprite(CORPSE)}</g>` },
  { label: 'Sprawl + bascule 82°', inner: `<g transform="rotate(82 60 150)">${sprite(CORPSE)}</g>` },
  { label: 'Sprawl + bascule 86°', inner: `<g transform="rotate(86 60 150)">${sprite(CORPSE)}</g>` },
].map((c, i) => {
  const x = i * 170;
  return `<g transform="translate(${x},0)"><rect x="2" y="2" width="166" height="170" fill="#222a38"/>` +
    `<line x1="2" y1="150" x2="168" y2="150" stroke="#3a4660" stroke-width="0.6"/>` +
    `${c.inner}<text x="85" y="186" text-anchor="middle" font-size="9" fill="#cdd" font-family="sans-serif">${c.label}</text></g>`;
});
mkdirSync('public/qc', { recursive: true });
const full = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 850 195"><defs>${DEFS}</defs>${cells.join('')}</svg>`;
const r = new Resvg(full, { background: '#11141c', fitTo: { mode: 'width', value: 1275 } });
writeFileSync('public/qc/death.png', r.render().asPng());
console.log('OK → public/qc/death.png');
