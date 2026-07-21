/**
 * QC — rend UNE créature riguée (profil + face, PNG zoomé) pour audit/retouche/jugement.
 *   npx tsx scripts/qc/render-creature.mts "<Nom du def>" [dossier-sortie] [prefixe-fichier]
 * Défauts : public/qc/creatures/<slug>-profile.png + <slug>-front.png.
 *   npx tsx scripts/qc/render-creature.mts --list   → JSON des créatures riguées (nom/plan/alias)
 * Utilisé par le workflow de refonte bestiaire (Jalon 8.5 lot 4) — un agent retouche un def
 * puis se re-rend ; le juge aveugle ne reçoit qu'un PNG au nom neutre.
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { Resvg } from '@resvg/resvg-js';
import { bonesToSvg } from '../../src/gameIso/rig/renderBones';
import { DEFS } from '../../src/gameIso/sprites';
import { planById } from '../../src/gameIso/rig/bodyPlan';
import { CREATURES } from '../../src/gameIso/rig/creatures';
import { norm } from '../../src/lib/normalize';
import type { View } from '../../src/gameIso/rig/facing';

const args = process.argv.slice(2);
if (args[0] === '--list') {
  const list = CREATURES.filter((c) => c.plan !== 'biped')
    .map((c) => ({ name: c.label, plan: c.plan }));
  console.log(JSON.stringify(list, null, 1));
  process.exit(0);
}

const name = args[0];
if (!name) { console.error('usage: render-creature.mts "<Nom>" [outdir] [prefix]'); process.exit(1); }
const def = CREATURES.find((c) => c.label === name || c.id === name); // lookup EXACT (label OU id)
if (!def || def.plan === 'biped') { console.error(`créature riguée introuvable: ${name}`); process.exit(1); }
const plan = planById(def.plan);
const outDir = args[1] ?? 'public/qc/creatures';
const prefix = args[2] ?? norm(def.label).replace(/[^a-z0-9]+/g, '-');
mkdirSync(outDir, { recursive: true });

// Résolution PAR ID (#646) — les tables d'espèces (BIRD_SPECIES/QUAD_SPECIES…) sont keyées par
// id depuis #637 ; un `resolve(def.label, …)` tombait SILENCIEUSEMENT sur le défaut du gabarit.
if (typeof plan.speciesNames === 'function' && !plan.speciesNames().includes(def.id)) {
  console.error(`espèce '${def.id}' absente du plan '${def.plan}' → rendu par défaut`);
}

for (const view of ['profile', 'front'] as View[]) {
  const bones = plan.resolve(def.id, view, plan.restPose(), {});
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 150" width="120" height="150"><defs>${DEFS}</defs><rect width="120" height="150" fill="#1d2230"/>${bonesToSvg(bones)}</svg>`;
  const png = new Resvg(svg, { fitTo: { mode: 'width', value: 620 }, font: { loadSystemFonts: true } }).render().asPng();
  const f = `${outDir}/${prefix}-${view}.png`;
  writeFileSync(f, png);
  console.log('OK:', f);
}
