/** QC des nouveaux quad exotiques (Basilic reptilien / Crapaud batracien) : profil/face/dos. */
import { writeFileSync } from 'node:fs';
import { Resvg } from '@resvg/resvg-js';
import { DEFS } from '../src/gameIso/sprites';
import { quadrupedSvg } from '../src/gameIso/rig/quadruped/composeQuad';
import type { View } from '../src/gameIso/rig/facing';

const names = ['Basilic', 'Crapaud', 'Hydre'];
const views: View[] = ['profile', 'front', 'back'];
const CW = 300, CH = 320, FEET = 280;
const cells: string[] = [];
names.forEach((name, r) => {
  views.forEach((view, c) => {
    const inner = quadrupedSvg(name, view);
    const SC = 1.5;
    const ox = 10 + c * CW, oy = 10 + r * CH, cx = (CW - 8) / 2;
    cells.push(`<g transform="translate(${ox},${oy})"><rect width="${CW - 8}" height="${CH - 10}" fill="#2b3142"/><g transform="translate(${cx - 60 * SC},${FEET - 150 * SC}) scale(${SC})">${inner}</g><text x="${cx}" y="${CH - 16}" text-anchor="middle" font-size="14" fill="#cdd" font-family="sans-serif">${name} ${view}</text></g>`);
  });
});
const W = 10 + 3 * CW, H = 10 + names.length * CH;
const full = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}"><defs>${DEFS}</defs><rect width="${W}" height="${H}" fill="#11141c"/>${cells.join('')}</svg>`;
writeFileSync('public/qc/_qc-newquad.png', new Resvg(full, { background: '#11141c', fitTo: { mode: 'width', value: W } }).render().asPng());
console.log('OK public/qc/_qc-newquad.png');
