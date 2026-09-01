// Étape de `npm run docs:check` : le SCHÉMA DE PROGRESSION de chaque niveau de Carrière est-il celui
// que le PDF imprime ? Consomme le comparateur PARTAGÉ `scripts/guards/lib/progressionSchemas.mjs`
// (le test `src/data/progression-schemas.test.ts` consomme le MÊME — un seul comparateur).
// L'artefact est committé : cette étape ne relit AUCUN PDF, elle est rejouable en CI.
//
// `--careers <chemin>` / `--careerLevels <chemin>` / `--artefact <chemin>` confrontent d'AUTRES
// fichiers que ceux de `src/data` — c'est ce qui rend le chemin d'ÉCHEC de ce CLI (message + code 1)
// éprouvable de bout en bout par `src/data/progression-schemas.test.ts`, et pas seulement son vert.
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
  careers: option('careers'),
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
// Une bande sans Carrière est rendue ici, jamais comptée en `ko` : la porte de ce chemin est le test
// qui épingle NOMMÉMENT les bandes attendues (`src/data/progression-schemas.test.ts`), pas ce CLI.
for (const b of a.bandesHorsDonnee) {
  console.log(
    `  BANDE HORS DONNÉE ${b.book} folio ${b.page} (page PDF ${b.pdfpage}, y=${b.y}) : ` +
      `aucune Carrière de la donnée ne la réclame — titres de la page ${JSON.stringify(b.titres)}`,
  )
}

let ko = 0
// Le folio DÉCLARÉ par `careers.json` contre le folio IMPRIMÉ que l'artefact tient du PDF : cette
// étape est le SEUL instrument qui voit les deux (la garde d'intégrité de folio, elle, confronte la
// donnée au CORPUS md, qui peut mentir du même mensonge — #1640).
for (const e of a.folioEcarts) {
  console.error(
    `FOLIO ${e.career} (${e.book}) : careers.json déclare p.${e.declare}, le PDF imprime la page ${e.imprime}`,
  )
  ko++
}
for (const v of a.violations) {
  console.error(`DÉSACCORD ${formatViolation(v)}`)
  ko++
}
for (const x of a.ambigus) {
  console.error(
    `AMBIGU ${x.book} folio ${x.page} (page PDF ${x.pdfpage}, y=${x.y}) : titres ${JSON.stringify(x.titres)} ` +
      `rapprochent ${x.candidats.length} Carrières — ${x.candidats.join(', ')}`,
  )
  ko++
}
if (ko > 0) {
  console.error(`\n${ko} désaccord(s) entre src/data (careers.json, careerLevels.json) et le PDF.`)
  process.exit(1)
}
console.log('progression : OK')
