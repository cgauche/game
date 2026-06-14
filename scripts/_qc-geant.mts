/** Vérif taille Géant (token-scale bipède) vs Humain/Ogre, ligne de sol commune. */
import { writeFileSync } from 'node:fs';
import { Resvg } from '@resvg/resvg-js';
import { DEFS } from '../src/gameIso/sprites';
import { bonesToSvg } from '../src/gameIso/rig/renderBones';
import { resolveRig } from '../src/gameIso/rig/composeRig';
import { entityRigProfile } from '../src/gameIso/rig/enemyProfile';
import { bipedSpeciesScale } from '../src/gameIso/rig/creatures';
import { hashSeed } from '../src/gameIso/appearance';
const NAMES = ['Humain', 'Ogre', 'Géant'];
const BASE = 1.1, GROUND = 430, SLOT = 230;
const cells: string[] = [];
NAMES.forEach((name, i) => {
  const prof = entityRigProfile(name, hashSeed(name))!;
  const sc = BASE * bipedSpeciesScale(name);
  const inner = bonesToSvg(resolveRig(prof.appearance, prof.equip, {}, prof.tenue, 'front'));
  const cx = 130 + i * SLOT;
  cells.push(`<g transform="translate(${cx - 60 * sc},${GROUND - 150 * sc}) scale(${sc})">${inner}</g>`);
  cells.push(`<text x="${cx}" y="${GROUND + 20}" text-anchor="middle" font-size="13" fill="#cdd" font-family="sans-serif">${name} (x${bipedSpeciesScale(name)})</text>`);
});
const W = 130 + NAMES.length * SLOT, H = GROUND + 40;
const full = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}"><defs>${DEFS}</defs><rect width="${W}" height="${H}" fill="#11141c"/><line x1="0" y1="${GROUND}" x2="${W}" y2="${GROUND}" stroke="#e06a4a" stroke-width="1" opacity="0.5"/>${cells.join('')}</svg>`;
writeFileSync('public/qc/_qc-geant.png', new Resvg(full, { background: '#11141c', fitTo: { mode: 'width', value: Math.min(1900, W) } }).render().asPng());
console.log('OK _qc-geant.png');
