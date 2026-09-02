/**
 * CLI de la planche QC du mobilier volumique — écrit l'artefact et rien d'autre.
 * L'instrument lui-même (ses lois empruntées à la cuisson) vit dans `lib/plancheVolumique.ts`, qu'un
 * contrat IMPORTE pour le mesurer : un outil de QC enfermé dans un script ne se mesure pas.
 *   npx tsx scripts/qc/render-props-volumiques.mts → public/props-volumiques.html
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { COLONNES, RECETTES, construireHtml } from './lib/plancheVolumique';

const { html, vides } = construireHtml();
mkdirSync('public', { recursive: true });
writeFileSync('public/props-volumiques.html', html);
console.log(`OK: public/props-volumiques.html — ${RECETTES.length} lignes × ${COLONNES.length} vues monde + vignette de palette`);
if (vides.length) {
  console.error(`VUES MONDE VIDES : ${vides.join(', ')}`);
  process.exitCode = 1;
}
