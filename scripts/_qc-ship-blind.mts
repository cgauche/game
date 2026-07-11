/** QC AVEUGLE — profil de chacun des 20 arts de navires (SHIP_ARTS), SANS étiquette, un PNG par id.
 *  Patron : scripts/_qc-blind.mts / scripts/_qc-sp2-decor.mts (Resvg) ; rendu = même chemin que
 *  scripts/gen-oriented-objects-gallery.mts (planById('navire').resolve + bonesToSvg).
 *  Sortie : public/qc/ships-blind/<id>.png (fond neutre, ~480px de large, aucune étiquette).
 *  Usage : npx tsx scripts/_qc-ship-blind.mts */
import { mkdirSync, writeFileSync } from 'node:fs';
import { Resvg } from '@resvg/resvg-js';
import { DEFS } from '../src/gameIso/sprites';
import { bonesToSvg } from '../src/gameIso/rig/renderBones';
import { planById } from '../src/gameIso/rig/bodyPlan';
import { SHIP_ARTS } from '../src/gameIso/rig/ship/_registry.generated';

mkdirSync('public/qc/ships-blind', { recursive: true });

const W = 120, H = 150;
const plan = planById('navire');
const BG = '#243040';

const out: Record<string, string> = {};
for (const { id } of SHIP_ARTS) {
  const body = bonesToSvg(plan.resolve(id, 'profile', plan.restPose(), {}));
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}"><defs>${DEFS}</defs>` +
    `<rect width="${W}" height="${H}" fill="${BG}"/>${body}</svg>`;
  const png = new Resvg(svg, { background: BG, fitTo: { mode: 'width', value: 480 } }).render().asPng();
  const path = `public/qc/ships-blind/${id}.png`;
  writeFileSync(path, png);
  out[id] = path;
}
console.log('OK', Object.keys(out).length, 'PNG dans public/qc/ships-blind/');
console.log(JSON.stringify(out));
