import { writeFileSync } from 'node:fs';
import { Resvg } from '@resvg/resvg-js';
import { DEFS } from '../src/gameIso/sprites';
import { creatureView } from '../src/gameIso/sprites';

const LABELS = ['Chien', 'Basilic', 'Pégase', 'Pieuvre des tourbières', 'Troll', 'Zombie', 'Goule de crypte', 'Manticore', 'Chauve-souris vampire (Varghulf)', 'Démonette de Slaanesh', 'Sanguinaire de Khorne', 'Guerrier des clans', 'Vermine de choc', 'Rat ogre'];
const SHORT: Record<string, string> = { 'Chauve-souris vampire (Varghulf)': 'Varghulf', 'Pieuvre des tourbières': 'Pieuvre', 'Démonette de Slaanesh': 'Démonette', 'Sanguinaire de Khorne': 'Sanguinaire', 'Guerrier des clans': 'Skaven clan', 'Goule de crypte': 'Goule' };
const CW = 150, CH = 165, COLS = 5;
const cells = LABELS.map((label, i) => {
  const frag = creatureView(label, 'front');
  const x = (i % COLS) * CW, y = Math.floor(i / COLS) * CH;
  return `<g transform="translate(${x},${y})"><rect width="${CW}" height="${CH}" fill="${i % 2 ? '#20262f' : '#262d38'}"/><g transform="translate(${(CW - 150) / 2},0) scale(0.92)">${frag}</g><text x="${CW / 2}" y="${CH - 6}" fill="#9fb" font-size="11" text-anchor="middle">${SHORT[label] ?? label}</text></g>`;
});
const W = COLS * CW, H = Math.ceil(LABELS.length / COLS) * CH;
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}"><defs>${DEFS}</defs><rect width="${W}" height="${H}" fill="#1a1f28"/>${cells.join('')}</svg>`;
const r = new Resvg(svg, { background: '#1a1f28', fitTo: { mode: 'width', value: W } });
writeFileSync('public/qc/creatures-redo-montage.png', r.render().asPng());
console.log('OK: public/qc/creatures-redo-montage.png');
