/** Vérif des TAILLES RELATIVES (sl) : tous les quadrupèdes sur une ligne de sol commune. */
import { writeFileSync } from 'node:fs';
import { Resvg } from '@resvg/resvg-js';
import { DEFS } from '../src/gameIso/sprites';
import { bonesToSvg } from '../src/gameIso/rig/renderBones';
import { resolveQuad } from '../src/gameIso/rig/quadruped/composeQuad';
import { QUAD_SPECIES, quadSpeciesNames } from '../src/gameIso/rig/quadruped/quadSkeleton';

const names = quadSpeciesNames();
const BASE = 1.1, GROUND = 250, SLOT = 150;
const cells: string[] = [];
names.forEach((sp, i) => {
  const sl = QUAD_SPECIES[sp].sl, SC = BASE * sl;
  const inner = bonesToSvg(resolveQuad(sp, 'profile'));
  const cx = 90 + i * SLOT;
  cells.push(`<g transform="translate(${cx - 60 * SC},${GROUND - 150 * SC}) scale(${SC})">${inner}</g>`);
  cells.push(`<text x="${cx}" y="${GROUND + 18}" text-anchor="middle" font-size="12" fill="#cdd" font-family="sans-serif">${sp} (${sl})</text>`);
});
const W = 90 + names.length * SLOT, H = GROUND + 40;
const full = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}"><defs>${DEFS}</defs><rect width="${W}" height="${H}" fill="#11141c"/><line x1="0" y1="${GROUND}" x2="${W}" y2="${GROUND}" stroke="#e06a4a" stroke-width="1" opacity="0.5"/><text x="10" y="20" font-size="14" fill="#d8a93b" font-family="sans-serif">Tailles relatives (sl) — ligne de sol commune</text>${cells.join('')}</svg>`;
writeFileSync('public/qc/_qc-quad-sizes.png', new Resvg(full, { background: '#11141c', fitTo: { mode: 'width', value: Math.min(1900, W) } }).render().asPng());
console.log('OK _qc-quad-sizes.png');
