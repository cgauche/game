/** QC du gabarit aviaire (pigeon) : vues + poses (repos/bob/bec/mort) + recolor. */
import { writeFileSync } from 'node:fs';
import { Resvg } from '@resvg/resvg-js';
import { DEFS } from '../src/gameIso/sprites';
import { birdSvg, BIRD_DEFAULT, resolveBirdFromProps, birdPeck, birdBob } from '../src/gameIso/rig/avian/composeBird';
import { bonesToSvg } from '../src/gameIso/rig/renderBones';

const cells: { label: string; svg: string }[] = [
  { label: 'Pigeon profil', svg: birdSvg(BIRD_DEFAULT, 'profile') },
  { label: 'Pigeon face', svg: birdSvg(BIRD_DEFAULT, 'front') },
  { label: 'Pigeon dos', svg: birdSvg(BIRD_DEFAULT, 'back') },
  { label: 'dodeline', svg: bonesToSvg(resolveBirdFromProps(BIRD_DEFAULT, 'profile', birdBob(0.25))) },
  { label: 'coup de bec', svg: bonesToSvg(resolveBirdFromProps(BIRD_DEFAULT, 'profile', birdPeck(0.5))) },
  { label: 'mort', svg: birdSvg(BIRD_DEFAULT, 'profile', { dead: true }) },
  { label: 'recolor corbeau', svg: birdSvg(BIRD_DEFAULT, 'profile', { colors: { corps: '#2a2e36' } }) },
  { label: 'recolor rouge-gorge', svg: birdSvg(BIRD_DEFAULT, 'profile', { colors: { corps: '#7a5a3a' } }) },
];
const CW = 280, CH = 300, FEET = 250, COLS = 4;
const out = cells.map((c, i) => {
  const SC = 1.9, col = i % COLS, row = Math.floor(i / COLS);
  const ox = 10 + col * CW, oy = 10 + row * CH, cx = (CW - 8) / 2;
  return `<g transform="translate(${ox},${oy})"><rect width="${CW - 8}" height="${CH - 10}" fill="#2b3142"/><g transform="translate(${cx - 60 * SC},${FEET - 138 * SC}) scale(${SC})">${c.svg}</g><text x="${cx}" y="${CH - 16}" text-anchor="middle" font-size="13" fill="#cdd" font-family="sans-serif">${c.label}</text></g>`;
});
const W = 10 + COLS * CW, H = 10 + Math.ceil(cells.length / COLS) * CH;
const full = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}"><defs>${DEFS}</defs><rect width="${W}" height="${H}" fill="#11141c"/>${out.join('')}</svg>`;
writeFileSync('public/qc/_qc-bird.png', new Resvg(full, { background: '#11141c', fitTo: { mode: 'width', value: W } }).render().asPng());
console.log('OK public/qc/_qc-bird.png');
