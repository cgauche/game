/** QC ponctuel : rastérise les 4 morphologies Mutant (forme 4-7) côte à côte. */
import { writeFileSync } from 'node:fs';
import { Resvg } from '@resvg/resvg-js';
import { DEFS } from '../src/gameIso/sprites';
import { composeAppearance } from '../src/gameIso/appearance';

const formes: [number, string][] = [
  [4, 'charognard'], [5, 'lezard'], [6, 'chien'], [7, 'tentacule'],
];
const cells = formes.map(([f, name], i) => {
  const inner = composeAppearance('Mutant', 7, { forme: f }) ?? '<text x="80" y="80">∅</text>';
  return `<g transform="translate(${i * 170},0)">
    <rect width="160" height="180" fill="#1c2530"/>
    <g transform="scale(1)">${inner}</g>
    <text x="80" y="174" text-anchor="middle" font-size="12" fill="#9fb3c8">${f}:${name}</text>
  </g>`;
}).join('');
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${formes.length * 170} 180"><defs>${DEFS}</defs>${cells}</svg>`;
const r = new Resvg(svg, { background: '#0e141b', fitTo: { mode: 'width', value: formes.length * 340 } });
writeFileSync('public/qc/mutants-montage.png', r.render().asPng());
console.log('OK → public/qc/mutants-montage.png');
