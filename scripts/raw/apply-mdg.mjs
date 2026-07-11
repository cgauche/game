// Applique les résultats du workflow d'intégration MDG aux fiches + catalogues de l'Atlas.
// Idempotent : un sentinel HTML marque le contenu ajouté ; relancer ne duplique pas.
// Usage : node scripts/raw/apply-mdg.mjs <workflow-output.json>
import { readFileSync, writeFileSync } from 'node:fs'

const OUTFILE = process.argv[2]
if (!OUTFILE) { console.error('usage: node scripts/raw/apply-mdg.mjs <workflow-output.json>'); process.exit(1) }
const SENT = '<!-- MDG-INTEGRATION -->'
const data = JSON.parse(readFileSync(OUTFILE, 'utf8')).result

// insère les puces de Sommaire avant le `---` qui clôt la section ## Sommaire
function insertSommaire(text, bullets) {
  if (!bullets || !bullets.trim()) return text
  const si = text.indexOf('## Sommaire')
  if (si < 0) return text
  const rel = text.slice(si).search(/\n---\s*$/m)
  if (rel < 0) return text
  const end = si + rel
  return text.slice(0, end) + `\n- **La Mer des Griffes (MDG)** ${SENT}\n${bullets.trim()}\n` + text.slice(end)
}
// ajoute les topics avant un éventuel "## Bilan", sinon en fin de fiche
function appendTopics(text, topics) {
  const block = `\n\n---\n\n${SENT}\n\n${topics.trim()}\n`
  const bi = text.search(/\n## Bilan/)
  return bi >= 0 ? text.slice(0, bi) + block + text.slice(bi) : text.replace(/\s*$/, '') + block + '\n'
}

for (const r of data) {
  let f = readFileSync(r.fiche, 'utf8')
  if (f.includes(SENT)) { console.log('skip (déjà appliqué) :', r.fiche) }
  else {
    f = insertSommaire(f, r.sommaire)
    f = appendTopics(f, r.ficheTopics)
    writeFileSync(r.fiche, f)
    console.log(`fiche  + ${r.domain.padEnd(11)} → ${r.fiche}  (+${r.ficheTopics.length} c.)`)
  }
  if (r.catalogue && r.catalogueEntries && r.catalogueEntries.trim()) {
    const tag = `${SENT} ${r.domain}`
    const c = readFileSync(r.catalogue, 'utf8')
    if (c.includes(tag)) { console.log('skip cat (déjà) :', r.catalogue) }
    else {
      writeFileSync(r.catalogue, c.replace(/\s*$/, '') + `\n\n---\n\n${tag}\n\n${r.catalogueEntries.trim()}\n`)
      console.log(`catal. + ${r.domain.padEnd(11)} → ${r.catalogue}  (+${r.catalogueEntries.length} c.)`)
    }
  }
}
console.log('\nIntégration MDG appliquée.')
