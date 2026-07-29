// Étape de `npm run docs:check` : le SCHÉMA DE PROGRESSION de chaque niveau de Carrière est-il celui
// que le PDF imprime ? Consomme le comparateur PARTAGÉ `scripts/guards/lib/progressionSchemas.mjs`
// (le test `src/data/progression-schemas.test.ts` consomme le MÊME — un seul comparateur).
// L'artefact est committé : cette étape ne relit AUCUN PDF, elle est rejouable en CI.
//
// `--careerLevels <chemin>` / `--artefact <chemin>` confrontent d'AUTRES fichiers que ceux de
// `src/data` — c'est ce qui rend le chemin d'ÉCHEC de ce CLI (message + code 1) éprouvable de bout en
// bout par `src/data/progression-schemas.test.ts`, et pas seulement son chemin vert.
import { readFileSync } from 'node:fs'
import { auditProgressionSchemas, formatViolation } from '../guards/lib/progressionSchemas.mjs'

/** @param {string} nom @returns {unknown} */
function option(nom) {
  const i = process.argv.indexOf(`--${nom}`)
  if (i < 0) return undefined
  const chemin = process.argv[i + 1]
  if (!chemin) {
    console.error(`--${nom} attend un chemin de fichier JSON`)
    process.exit(2)
  }
  return JSON.parse(readFileSync(chemin, 'utf8'))
}

const a = auditProgressionSchemas({
  careerLevels: option('careerLevels'),
  artefact: option('artefact'),
})

console.log(
  `progression : ${a.couvertes}/${a.totalCarrieres} Carrières appariées à une bande du PDF ` +
    `(${a.totalBandes} bandes, livres extraits : ${a.livresArtefact.join(', ')})`,
)
for (const [book, n] of Object.entries(a.parLivre).sort()) console.log(`  ${book} : ${n}`)
for (const [book, ids] of Object.entries(a.nonCouvertes).sort()) {
  console.log(`  ANGLE MORT ${book} : ${ids.length} Carrière(s) non couverte(s) — ${ids.join(', ')}`)
}
for (const b of a.bandesHorsDonnee) {
  console.log(
    `  BANDE HORS DONNÉE ${b.book} folio ${b.folio} (page PDF ${b.pdfpage}, y=${b.y}) : ` +
      `aucune Carrière de la donnée ne la réclame — titres de la page ${JSON.stringify(b.titres)}`,
  )
}
if (a.folioEcarts.length > 0) {
  console.log(
    `  ${a.folioEcarts.length} écart(s) de folio déclaré/imprimé (relève de la garde d'intégrité de folio, pas de celle-ci)`,
  )
}

let ko = 0
for (const v of a.violations) {
  console.error(`DÉSACCORD ${formatViolation(v)}`)
  ko++
}
for (const x of a.ambigus) {
  console.error(
    `AMBIGU ${x.book} folio ${x.folio} (page PDF ${x.pdfpage}, y=${x.y}) : titres ${JSON.stringify(x.titres)} ` +
      `rapprochent ${x.candidats.length} Carrières — ${x.candidats.join(', ')}`,
  )
  ko++
}
if (ko > 0) {
  console.error(`\n${ko} désaccord(s) entre src/data/careerLevels.json et le PDF.`)
  process.exit(1)
}
console.log('progression : OK')
