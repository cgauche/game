// Registre de couverture de l'Atlas RAW — le backbone de « l'Atlas remplace la source ».
// Déterministe : pour chaque chapitre des 14 livres autorisés, vérifie s'il est CITÉ (`ABBR NN l.`)
// par au moins une fiche docs/raw/*.md. Un chapitre non cité = trou (à couvrir ou à marquer hors-règle).
// Re-run après chaque domaine pour voir les trous se réduire à zéro. Sortie : docs/raw/coverage.md
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { BOOKS, esc } from './_lib.mjs'
const rawDir = 'docs/raw'
// Profondeur-conscient : on garde chaque fiche séparée pour compter les refs et trouver la fiche PROPRIÉTAIRE.
const DOCS = readdirSync(rawDir).filter((f) => f.endsWith('.md') && f !== 'coverage.md')
  .map((f) => ({ file: f, text: readFileSync(join(rawDir, f), 'utf8') }))
// Chapitres LDB couverts par un CATALOGUE (catalogue-*.md = données mécaniques verbatim ré-extraites,
// sans réf `l.X` ligne — créditées au niveau CHAPITRE via `LDB NN`).
const CATALOG_CH = new Set() // clés « ABBR NN » créditées par un catalogue (tous livres)
for (const d of DOCS) {
  if (!/^catalogue-/.test(d.file)) continue
  for (const [ab] of BOOKS) {
    const re = new RegExp(`\\b${esc(ab)} (\\d+)\\b`, 'g'); let m
    while ((m = re.exec(d.text))) CATALOG_CH.add(`${ab} ${Number(m[1])}`)
  }
}
// Chapitres HORS-RÈGLE (exclus du dénominateur) : section MJ/cadre du LDB (terrain/politique/colonies/
// sites = direction de jeu, pas des règles PC) + front-matter (index/intro/préface) de tout livre.
// Conservateur : on ne tague QUE le clairement-non-règle, pour ne jamais masquer un vrai trou de règle.
// Livres d'AVENTURE purs : leurs chapitres-règles sont couverts (✅/catalogue) ; tout chapitre restant = scénario.
const SCENARIO_BOOKS = new Set(['EDO', 'T2', 'T3', 'Altdorf', 'Ubersreik', 'NADAJ'])
// Chapitres-scénario explicites des compagnons MIXTES (le reste de ces livres = règles, couvertes).
const HORS_REGLE = new Set([
  'LDB 52', 'LDB 53', 'LDB 54', 'LDB 55', 'LDB 56',
  'ADE I 1', 'ADE I 2', 'ADE I 3', 'ADE I 4', 'ADE I 5', 'ADE I 6',
  'ADE II 5', 'ADE II 6', 'ADE II 7',
  'Middenheim 1', 'Middenheim 2', 'Middenheim 3', 'Middenheim 5', 'Middenheim 6',
  'EDOC 2', 'EDOC 3', 'EDOC 5', 'EDOC 10', 'EDOC 11', 'EDOC 13', 'EDOC 14', 'EDOC 15', 'EDOC 16',
  'T2C 2', 'T2C 3', 'T2C 5', 'T2C 6', 'T2C 8', 'T2C 10', 'T2C 11', 'T2C 17', 'T2C 18', 'T2C 19',
])
const isFrontMatter = (t) => /^index$|^introduction|avant-?propos|préface|^preface|^sommaire|^\*+$/i.test(t.trim())
// Classe un chapitre : ✅ couvert (propriétaire ≥3 refs ligne, OU catalogue au chapitre) · 🟡 effleuré (1-2) · ⬜ trou (0).
function classify(ab, nn) {
  const re = new RegExp(`\\b${esc(ab)} 0*${Number(nn)} l\\.`, 'g')
  let total = 0, owner = '', ownerN = 0
  for (const d of DOCS) {
    const n = (d.text.match(re) || []).length
    total += n
    if (n > ownerN) { ownerN = n; owner = d.file }
  }
  const cat = CATALOG_CH.has(`${ab} ${Number(nn)}`)
  if (cat && ownerN < 3) owner = owner || 'catalogue-*.md'
  const mark = (ownerN >= 3 || cat) ? '✅' : total > 0 ? '🟡' : '⬜'
  return { total, owner, ownerN, mark, cat }
}

let out = ['# Atlas RAW — Registre de couverture', '',
  '> Contrat « l\'Atlas remplace la source » : chaque chapitre des 14 livres doit être **couvert** (cité',
  '> par une fiche `docs/raw/`) ou explicitement **hors-règle** (narratif). Un chapitre `⬜` = trou.',
  '> Recourir à la source pour un point = un défaut de l\'Atlas à corriger ici. Régénéré par',
  '> `node scripts/raw/coverage.mjs`.', '']

let gOk = 0, gMid = 0, gHole = 0
const perBook = []
for (const [ab, dir] of BOOKS) {
  let files
  try { files = readdirSync(dir).filter((f) => /^\d+ - /.test(f) && f.endsWith('.md')) }
  catch { out.push(`## ${ab} — ⚠ dossier introuvable (${dir})`, ''); continue }
  let bOk = 0, bMid = 0, bHole = 0
  const lines = ['| Ch. | Titre | État | refs (propriétaire) |', '|---|---|---|---|']
  for (const f of files.sort()) {
    const nn = f.match(/^(\d+) - /)[1]
    const title = f.replace(/^\d+ - /, '').replace(/\.md$/, '')
    const artefact = /^_/.test(title)
    const c = classify(ab, nn)
    if (artefact && c.total === 0) { lines.push(`| ${nn} | *(artefact OCR)* | ➖ | |`); continue }
    if (c.mark !== '✅' && (HORS_REGLE.has(`${ab} ${Number(nn)}`) || SCENARIO_BOOKS.has(ab) || isFrontMatter(title))) {
      lines.push(`| ${nn} | ${title} | ➖ hors-règle | |`); continue
    }
    if (c.mark === '✅') bOk++; else if (c.mark === '🟡') bMid++; else bHole++
    const detail = c.total ? `${c.total} (${c.owner} ×${c.ownerN})` : ''
    lines.push(`| ${nn} | ${artefact ? '*(artefact OCR)*' : title} | ${c.mark} | ${detail} |`)
  }
  gOk += bOk; gMid += bMid; gHole += bHole
  perBook.push(`${ab} ✅${bOk}·🟡${bMid}·⬜${bHole}`)
  out.push(`## ${ab} — ✅ ${bOk} · 🟡 ${bMid} · ⬜ ${bHole}`, '', ...lines, '')
}

const denom = gOk + gMid + gHole
out.splice(6, 0, `**Couverture (profondeur) : ✅ ${gOk} couverts · 🟡 ${gMid} effleurés · ⬜ ${gHole} trous** sur ${denom} chapitres-règles (hors artefacts OCR). ✅ = une fiche propriétaire le traite (≥3 refs) ; 🟡 = seulement cité en renvoi ; ⬜ = absent. Par livre : ${perBook.join(' · ')}.`, '')
writeFileSync(join(rawDir, 'coverage.md'), out.join('\n'))
console.log(`coverage profondeur : ✅ ${gOk} · 🟡 ${gMid} · ⬜ ${gHole} (sur ${denom} chapitres)`)
console.log('par livre : ' + perBook.join(' · '))
