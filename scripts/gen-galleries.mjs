/**
 * Régénère TOUTES les galeries QC depuis le code/l'art existant, en une commande.
 *   npm run galleries        (ou : node scripts/gen-galleries.mjs)
 * Chaque galerie est produite par son générateur dédié ; le hub est public/galeries.html.
 */
import { execSync } from 'node:child_process';

const STEPS = [
  ['Bestiaire — sprites', 'node scripts/gen-gallery.mjs'],
  ['Tenues de carrière (64)', 'npx tsx scripts/gen-tenue-gallery.mts'],
  ['Rig — espèces × équipement', 'npx tsx scripts/gen-rig-gallery.mts'],
  ['Armes', 'npx tsx scripts/gen-weapon-gallery.mts'],
  ['Animations par arme', 'npx tsx scripts/gen-anim-gallery.mts'],
  ['Bestiaire — 3 vues', 'npx tsx scripts/gen-bestiary-views-gallery.mts'],
  ['Têtes — 3 vues', 'npx tsx scripts/gen-head-views-gallery.mts'],
  ['Tenues — 3 vues', 'npx tsx scripts/gen-tenue-views-gallery.mts'],
  ['Debug — ancrage sol & armes', 'npx tsx scripts/_dbg-species.mts'],
];

let ok = 0;
const failed = [];
for (const [label, cmd] of STEPS) {
  process.stdout.write(`\n▶ ${label}\n`);
  try {
    execSync(cmd, { stdio: 'inherit' });
    ok++;
  } catch {
    failed.push(label);
    console.error(`  ✗ ÉCHEC : ${cmd}`);
  }
}
console.log(`\nGaleries régénérées : ${ok}/${STEPS.length} OK${failed.length ? ` — échecs : ${failed.join(', ')}` : ''}.`);
console.log('Hub : public/galeries.html');
if (failed.length) process.exitCode = 1;
