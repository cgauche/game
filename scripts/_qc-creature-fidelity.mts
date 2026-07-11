/** QC FIDÉLITÉ — profil de chaque créature NON-BIPÈDE (quadruped/winged/avian/spectral/crustace/
 *  serpentine/jabberslythe/arachnid/cephalopod/squig/amorphous/fish), un PNG INDIVIDUEL par id.
 *  Patron : scripts/_qc-ship-blind.mts (Resvg, fond neutre, vue profil) ; créatures = CREATURES
 *  (src/gameIso/rig/creatures) + planById().resolve, comme scripts/gen-bestiary-gallery.mts.
 *  Exclut 'biped' (rig humanoïde) et 'engin' (corps statique, pas une créature).
 *  Sortie : public/qc/creature-fidelity/<id>.png (~480px de large, aucune étiquette).
 *  Usage : npx tsx scripts/_qc-creature-fidelity.mts */
import { mkdirSync, writeFileSync } from 'node:fs';
import { Resvg } from '@resvg/resvg-js';
import { DEFS } from '../src/gameIso/sprites';
import { bonesToSvg } from '../src/gameIso/rig/renderBones';
import { planById } from '../src/gameIso/rig/bodyPlan';
import { CREATURES, defId } from '../src/gameIso/rig/creatures';

const OUT_DIR = 'public/qc/creature-fidelity';
mkdirSync(OUT_DIR, { recursive: true });

const W = 120, H = 150;
const BG = '#243040';

const targets = CREATURES.filter((c) => c.plan !== 'biped' && c.plan !== 'engin');

const out: Record<string, string> = {};
for (const c of targets) {
  const id = defId(c);
  const plan = planById(c.plan);
  const body = bonesToSvg(plan.resolve(id, 'profile', plan.restPose(), {}));
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}"><defs>${DEFS}</defs>` +
    `<rect width="${W}" height="${H}" fill="${BG}"/>${body}</svg>`;
  const png = new Resvg(svg, { background: BG, fitTo: { mode: 'width', value: 480 } }).render().asPng();
  const path = `${OUT_DIR}/${id}.png`;
  writeFileSync(path, png);
  out[id] = path;
}
console.log('OK', Object.keys(out).length, `PNG dans ${OUT_DIR}/`);
console.log(JSON.stringify(out));
