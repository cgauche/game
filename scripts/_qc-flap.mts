/** Vérif du battement : ailes au repos vs levées (pose aileD/aileG). */
import { writeFileSync } from 'node:fs';
import { Resvg } from '@resvg/resvg-js';
import { DEFS } from '../src/gameIso/sprites';
import { bonesToSvg } from '../src/gameIso/rig/renderBones';
import { resolveWing, WINGED_SPECIES } from '../src/gameIso/rig/winged/composeWing';
import type { View } from '../src/gameIso/rig/facing';

const rows: { name: string; view: View; pose: Record<string, number> }[] = [
  { name: 'Griffon', view: 'front', pose: {} },
  { name: 'Griffon', view: 'front', pose: { aileD: -28, aileG: 28 } },
  { name: 'Griffon', view: 'profile', pose: {} },
  { name: 'Griffon', view: 'profile', pose: { aileD: -28, aileG: 28 } },
  { name: 'Dragon', view: 'front', pose: {} },
  { name: 'Dragon', view: 'front', pose: { aileD: -28, aileG: 28 } },
];
const CW = 360, CH = 440, FEET = 380;
const cells: string[] = [];
rows.forEach((r, i) => {
  const sl = WINGED_SPECIES[r.name].sl, SC = 1.3 * sl;
  const inner = bonesToSvg(resolveWing(r.name, r.view, r.pose));
  const col = i % 3, row = Math.floor(i / 3);
  const ox = 10 + col * CW, oy = 10 + row * CH, cx = (CW - 8) / 2;
  cells.push(`<g transform="translate(${ox},${oy})"><rect width="${CW - 8}" height="${CH - 10}" fill="#2b3142"/><g transform="translate(${cx - 60 * SC},${FEET - 150 * SC}) scale(${SC})">${inner}</g><text x="${cx}" y="${CH - 16}" text-anchor="middle" font-size="13" fill="#cdd" font-family="sans-serif">${r.name} ${r.view} ${Object.keys(r.pose).length ? 'AILES LEVÉES' : 'repos'}</text></g>`);
});
const W = 10 + 3 * CW, H = 10 + 2 * CH;
const full = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}"><defs>${DEFS}</defs><rect width="${W}" height="${H}" fill="#11141c"/>${cells.join('')}</svg>`;
writeFileSync('public/qc/_qc-flap.png', new Resvg(full, { background: '#11141c', fitTo: { mode: 'width', value: W } }).render().asPng());
console.log('OK _qc-flap.png');
