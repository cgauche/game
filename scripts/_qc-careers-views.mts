/** TEMP — face/profil/dos côte à côte pour PLUSIEURS carrières, afin de juger la cohérence
 *  inter-vues et repérer celles à doter d'un art directionnel dédié. */
import { writeFileSync } from 'node:fs';
import { Resvg } from '@resvg/resvg-js';
import { DEFS } from '../src/gameIso/sprites';
import { bonesToSvg } from '../src/gameIso/rig/renderBones';
import { resolveRig } from '../src/gameIso/rig/composeRig';
import type { Appearance } from '../src/gameIso/rig/appearance';
import type { View } from '../src/gameIso/rig/facing';

const app: Appearance = { species: 'Humain', sex: 'M', build: 0.5, seed: 1 };
const equip = { weapons: [], armour: [] };
// carrières à inspecter (priorité 3) — passées en argv sinon défaut.
const CAREERS = process.argv.slice(2).length
  ? process.argv.slice(2)
  : ['Mendiant', 'Voleur', 'Sorcier', 'Noble', 'Nonne', 'Batelier', 'Répurgateur', 'Flagellant', 'Artisan', 'Bourgeois', 'Agitateur'];
const VIEWS: View[] = ['front', 'profile', 'back'];

const SUB = 120, GAP = 6, SC = 1.95, FEET = 150, ROWH = 305;
// 3 sous-vues par carrière, étiquette à gauche.
const LBLW = 92;
const rows = CAREERS.map((career, r) => {
  const cells = VIEWS.map((view, c) => {
    const inner = bonesToSvg(resolveRig(app, equip, {}, career, view));
    const x = LBLW + c * (SUB + GAP);
    return `<g transform="translate(${x},0)"><rect width="${SUB}" height="${ROWH - GAP}" fill="#2b3142"/><line x1="0" y1="${FEET * SC}" x2="${SUB}" y2="${FEET * SC}" stroke="#e06a4a" stroke-width="0.4" opacity="0.5"/><g transform="translate(${SUB / 2 - 60 * SC},0) scale(${SC})">${inner}</g></g>`;
  }).join('');
  return `<g transform="translate(6,${30 + r * ROWH})"><text x="0" y="${ROWH / 2}" font-size="10" fill="#d8a93b" font-family="sans-serif">${career}</text>${cells}</g>`;
});
const W = 6 + LBLW + VIEWS.length * (SUB + GAP), H = 30 + CAREERS.length * ROWH;
const full = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}"><defs>${DEFS}</defs><rect width="${W}" height="${H}" fill="#11141c"/><text x="6" y="18" font-size="11" fill="#cdd" font-family="sans-serif">Carrières — face / profil / dos (cohérence inter-vues)</text>${rows.join('')}</svg>`;
writeFileSync('public/qc/careers-views.png', new Resvg(full, { background: '#11141c', fitTo: { mode: 'width', value: W * 2 } }).render().asPng());
console.log('OK careers-views.png —', CAREERS.join(', '));
