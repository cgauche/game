/** Compare des approches de POSE DE MORT pour créatures (formes variées). → public/qc/creature-death.png */
import { writeFileSync } from 'node:fs';
import { Resvg } from '@resvg/resvg-js';
import { creatureView, DEFS } from '../src/gameIso/sprites';
import { hashSeed } from '../src/gameIso/appearance';

const NAMES = ['Orc', 'Loup', 'Araignée géante', 'Dragon', 'Serpent', 'Troll'];
// Approches : vivant | bascule 78° | bascule 55°+aplati | aplati (slump) seul.
const APPR = [
  { l: 'vivant', t: (s: string) => s },
  { l: 'bascule 78°', t: (s: string) => `<g transform="rotate(78 60 150)">${s}</g>` },
  { l: 'bascule 50° + aplati', t: (s: string) => `<g transform="translate(60 150) rotate(50) scale(1,0.78) translate(-60 -150)">${s}</g>` },
  { l: 'aplati au sol', t: (s: string) => `<g transform="translate(60 150) scale(1.05,0.42) translate(-60 -150)">${s}</g>` },
];
const CW = 150, CH = 168, FEET = 150;
const cells: string[] = [];
NAMES.forEach((name, r) => {
  cells.push(`<text x="4" y="${28 + r * CH + CH / 2}" font-size="9" fill="#9fb0c8" font-family="sans-serif">${name}</text>`);
  APPR.forEach((a, ci) => {
    const inner = a.t(creatureView(name, 'front', hashSeed(name)));
    const x = 96 + ci * CW, y = 28 + r * CH;
    cells.push(`<g transform="translate(${x},${y})"><rect width="${CW - 4}" height="${CH - 14}" fill="#262d3b"/><line x1="0" y1="${FEET}" x2="${CW - 4}" y2="${FEET}" stroke="#e06a4a" stroke-width="0.5"/><g transform="translate(6,0)">${inner}</g><text x="${(CW - 4) / 2}" y="${CH - 3}" text-anchor="middle" font-size="8" fill="#cdd" font-family="sans-serif">${a.l}</text></g>`);
  });
});
const W = 96 + APPR.length * CW, H = 28 + NAMES.length * CH;
const full = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}"><defs>${DEFS}</defs><rect width="${W}" height="${H}" fill="#11141c"/>${cells.join('')}</svg>`;
writeFileSync('public/qc/creature-death.png', new Resvg(full, { background: '#11141c', fitTo: { mode: 'width', value: W * 2 } }).render().asPng());
console.log('OK → public/qc/creature-death.png');
