// Garde de cohérence des lignes citées par l'Atlas RAW (#454, défaut C).
// Pour chaque réf `<ABRÉV> NN l.X[-Y|+n…]` de docs/raw/*.md, résout le fichier-chapitre
// (`chapterFile`, _lib.mjs) et vérifie que la borne haute de la plage ne dépasse pas le nombre
// de lignes du fichier. Un livre/chapitre INTROUVABLE n'est pas le sujet ici (Sens A de
// reconcile.mjs) — seul un chapitre TROUVÉ dont la ligne est HORS BORNE est une réf morte.
// Cliquet PAR RÉF-CHAPITRE (`scripts/raw/dead-refs-baseline.json`, patron src/ui/ui-ratchets.test.ts) :
// toute HAUSSE échoue ; une baseline devenue trop haute (réfs réparées) doit être ABAISSÉE.
// Re-run : node scripts/raw/check-refs.mjs
import { readdirSync, readFileSync } from 'node:fs'
import { join, dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { ldbRe, otherRe, span, chapterFile } from './_lib.mjs'

export const RAWDIR = 'docs/raw'
export const EXCLUDE = new Set(['coverage.md', 'reconciliation.md', 'reanchor.md'])
export const BASELINE_PATH = join(dirname(fileURLToPath(import.meta.url)), 'dead-refs-baseline.json')

// Réfs `LDB NN l.X…` et réfs « autres livres » (AA/ZI/EDO…) d'une ligne — génère
// `{ abbr, nn, hi }` (borne haute de la plage dépliée par `span`).
function* refsInLine(ln) {
  const ldb = ldbRe()
  let m
  while ((m = ldb.exec(ln))) {
    const [, hi] = span(m[2], m[3])
    yield { abbr: 'LDB', nn: m[1], hi }
  }
  const other = otherRe()
  while ((m = other.exec(ln))) {
    const nn = m[2]
    if (nn == null) continue // pas de chapitre → hors sujet (réf de livre entier, pas de fichier à borner)
    const abbr = m[1].replace(/\s+/g, ' ').trim()
    const [, hi] = span(m[3], '')
    yield { abbr, nn, hi }
  }
}

const lineCountCache = new Map()
function lineCount(path) {
  if (!lineCountCache.has(path)) lineCountCache.set(path, readFileSync(path, 'utf8').split('\n').length)
  return lineCountCache.get(path)
}

/** Parcourt `rawDir` (docs/raw par défaut) et retourne les réfs mortes : `{ doc, row, ref, hi, chapterLines, file }`. */
export function scanDeadRefs(rawDir = RAWDIR, exclude = EXCLUDE) {
  const dead = []
  const docs = readdirSync(rawDir).filter((f) => f.endsWith('.md') && !exclude.has(f))
  for (const doc of docs) {
    const lines = readFileSync(join(rawDir, doc), 'utf8').split('\n')
    lines.forEach((ln, i) => {
      for (const { abbr, nn, hi } of refsInLine(ln)) {
        const cf = chapterFile(abbr, nn)
        if (!cf) continue // livre/chapitre introuvable : hors sujet (Sens A de reconcile.mjs)
        const chapterLines = lineCount(cf.path)
        if (hi > chapterLines) dead.push({ doc, row: i + 1, ref: `${abbr} ${Number(nn)}`, hi, chapterLines, file: cf.file })
      }
    })
  }
  return dead
}

/** Groupe les réfs mortes par clé `ABBR NN` (unité du cliquet). */
export function countsByChapterRef(dead) {
  const counts = {}
  for (const d of dead) counts[d.ref] = (counts[d.ref] ?? 0) + 1
  return counts
}

/** Compare des comptes mesurés à une baseline gelée : toute hausse ET toute baisse (baseline
 *  périmée) sont des anomalies — retourne `{ over, stale }` (listes de lignes-rapport). */
export function assertAgainstBaseline(counts, baseline) {
  const over = []
  for (const [k, n] of Object.entries(counts)) {
    const b = baseline[k] ?? 0
    if (n > b) over.push(`${k} : ${n} (baseline ${b})`)
  }
  const stale = []
  for (const [k, b] of Object.entries(baseline)) {
    const n = counts[k] ?? 0
    if (n < b) stale.push(`${k} : baseline ${b}, réel ${n}`)
  }
  return { over, stale }
}

function main() {
  const dead = scanDeadRefs()
  const counts = countsByChapterRef(dead)
  const baseline = JSON.parse(readFileSync(BASELINE_PATH, 'utf8'))
  const { over, stale } = assertAgainstBaseline(counts, baseline)

  console.log(`refs mortes (ligne hors borne du chapitre résolu) : ${dead.length} sur ${Object.keys(counts).length} chapitre(s)-réf`)

  if (over.length) {
    console.log('RÉGRESSION — hausse de réfs mortes par chapitre-réf :')
    for (const o of over) console.log(`  ${o}`)
  }
  if (stale.length) {
    console.log('Baseline(s) PÉRIMÉE(s) (réfs réparées) — à ABAISSER dans dead-refs-baseline.json :')
    for (const s of stale) console.log(`  ${s}`)
  }
  if (!over.length && !stale.length) {
    console.log('OK — cliquet aligné, aucune régression.')
    return
  }
  console.log('Détail (fichier:ligne — réf morte, le chapitre a N lignes) :')
  for (const d of dead) console.log(`docs/raw/${d.doc}:${d.row} — ${d.ref} l.${d.hi} (${d.file} a ${d.chapterLines} lignes)`)
  process.exitCode = 1
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isMain) main()
