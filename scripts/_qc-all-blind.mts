/** QC AVEUGLE de TOUS les modèles (bipèdes + quadrupèdes + ailés), mélangés, sans label.
 *  → public/qc/_qc-all-blind.png + public/qc/_qc-all-truth.json (vérité privée). */
import { writeFileSync } from 'node:fs';
import { Resvg } from '@resvg/resvg-js';
import { DEFS } from '../src/gameIso/sprites';
import { bonesToSvg } from '../src/gameIso/rig/renderBones';
import { resolveRig } from '../src/gameIso/rig/composeRig';
import { entityRigProfile } from '../src/gameIso/rig/enemyProfile';
import { resolveQuad } from '../src/gameIso/rig/quadruped/composeQuad';
import { QUAD_SPECIES } from '../src/gameIso/rig/quadruped/quadSkeleton';
import { resolveWing, WINGED_SPECIES } from '../src/gameIso/rig/winged/composeWing';
import { hashSeed } from '../src/engine/dice';
import type { View } from '../src/gameIso/rig/facing';

type Entry = { plan: 'biped' | 'quad' | 'winged'; name: string; weapon?: string };
// Ordre MÉLANGÉ (pas de regroupement par gabarit) pour ne rien suggérer.
const ENTRIES: Entry[] = [
  { plan: 'biped', name: 'Squelette', weapon: 'Lance' },
  { plan: 'quad', name: 'Loup' },
  { plan: 'winged', name: 'Dragon' },
  { plan: 'biped', name: 'Orc', weapon: 'Épée' },
  { plan: 'quad', name: 'Cheval' },
  { plan: 'biped', name: 'Goule de crypte' },
  { plan: 'winged', name: 'Pégase' },
  { plan: 'biped', name: 'Gobelin', weapon: 'Lance' },
  { plan: 'quad', name: 'Sanglier' },
  { plan: 'biped', name: 'Sanguinaire de Khorne', weapon: 'Épée' },
  { plan: 'biped', name: 'Minotaure', weapon: 'Hache' },
  { plan: 'winged', name: 'Griffon' },
  { plan: 'quad', name: 'Ours' },
  { plan: 'biped', name: 'Vampire' },
  { plan: 'biped', name: 'Zombie' },
  { plan: 'quad', name: 'Rat géant' },
  { plan: 'biped', name: 'Snotling', weapon: 'Gourdin' },
  { plan: 'winged', name: 'Hippogriffe' },
  { plan: 'biped', name: 'Ogre', weapon: 'Gourdin' },
  { plan: 'biped', name: 'Gor', weapon: 'Hache' },
  { plan: 'biped', name: 'Troll' },
  { plan: 'quad', name: 'Chien' },
  { plan: 'biped', name: 'Skaven', weapon: 'Dague' },
];

function svgFor(e: Entry, view: View, idx: number): { svg: string; sl: number } {
  if (e.plan === 'biped') {
    const prof = entityRigProfile(e.name, hashSeed(e.name + idx), e.weapon ? { weapon: e.weapon } : {})!;
    return { svg: bonesToSvg(resolveRig(prof.appearance, prof.equip, {}, prof.tenue, view)), sl: 1 };
  }
  if (e.plan === 'quad') {
    return { svg: bonesToSvg(resolveQuad(e.name, view)), sl: QUAD_SPECIES[e.name].sl };
  }
  return { svg: bonesToSvg(resolveWing(e.name, view)), sl: WINGED_SPECIES[e.name].sl };
}

const COLS = 6, CW = 300, CH = 330, BASE = 1.35, FEET = 280, SUB = CW / 2;
const cells: string[] = [];
ENTRIES.forEach((e, idx) => {
  const col = idx % COLS, row = Math.floor(idx / COLS);
  const ox = 10 + col * CW, oy = 36 + row * CH;
  cells.push(`<rect x="${ox}" y="${oy}" width="${CW - 8}" height="${CH - 10}" fill="#2b3142" stroke="#3a4156"/>`);
  cells.push(`<text x="${ox + 8}" y="${oy + 18}" font-size="15" fill="#e8c25a" font-family="sans-serif" font-weight="bold">#${idx + 1}</text>`);
  (['profile', 'front'] as View[]).forEach((view, i) => {
    const { svg, sl } = svgFor(e, view, idx);
    const SC = BASE * Math.min(sl, 1.6); // cap géant dragon pour tenir dans la case
    const sx = ox + i * SUB + SUB / 2;
    cells.push(`<g transform="translate(${sx - 60 * SC},${oy + FEET - 150 * SC}) scale(${SC})">${svg}</g>`);
  });
});
const W = 10 + COLS * CW, H = 36 + Math.ceil(ENTRIES.length / COLS) * CH + 10;
const full = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}"><defs>${DEFS}</defs><rect width="${W}" height="${H}" fill="#171b24"/><text x="10" y="22" font-size="15" fill="#9fb0c8" font-family="sans-serif">Identifie chaque creature (profil gauche + face droite par case)</text>${cells.join('')}</svg>`;
writeFileSync('public/qc/_qc-all-blind.png', new Resvg(full, { background: '#171b24', fitTo: { mode: 'width', value: Math.min(1900, W * 2) } }).render().asPng());
writeFileSync('public/qc/_qc-all-truth.json', JSON.stringify(ENTRIES.map((e, i) => ({ cell: i + 1, plan: e.plan, truth: e.name })), null, 2));
console.log('OK _qc-all-blind.png (' + ENTRIES.length + ' creatures)');
