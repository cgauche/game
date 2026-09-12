// Garde de cohérence des lignes citées par l'Atlas RAW (#454, défaut C).
// Pour chaque réf `<ABRÉV> NN l.X[-Y|+n…]` de docs/raw/*.md, résout le fichier-chapitre
// (`chapterFile`, _lib.mjs) et vérifie que la borne haute de la plage ne dépasse pas le nombre
// de lignes du fichier. Un livre/chapitre INTROUVABLE n'est pas le sujet ici (Sens A de
// reconcile.mjs) — seul un chapitre TROUVÉ dont la ligne est HORS BORNE est une réf morte.
// Cliquet NOMINATIF PAR SITE (`scripts/raw/dead-refs-stock.json`, écart `ecartDuVolet` de
// `stockNominatif.mjs`, clé `fiche :: réf citée :: occurrence`) : un site NEUF est une régression à
// corriger ou à déclarer, une entrée dont le site a disparu est une dette SOLDÉE à retirer. Le stock
// est ABSENT en régime nominal → tolérance ZÉRO (`readStock` traite un fichier absent comme zéro
// entrée). S'il renaît, il se recrée à sa mesure MINIMALE, chaque entrée portant son lot et sa date.
// Re-run : node scripts/raw/check-refs.mjs
import { listerDossier } from '../guards/lib/lister.mjs'
import { join, dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { ldbRe, otherRe, span, chapterFile, bookOf, RAWDOC_META_GENERATED, readText, PIVOT_ABBR } from './_lib.mjs'
import { ecartDuVolet, readStock } from './stockNominatif.mjs'

export const RAWDIR = 'docs/raw'
export const EXCLUDE = RAWDOC_META_GENERATED // (#454 DoD, #585 lot A) — source unique _lib.mjs
export const STOCK_PATH = join(dirname(fileURLToPath(import.meta.url)), 'dead-refs-stock.json')
// Sites morts observés → sites du stock : la FICHE où la réf est lue (chemin depuis la racine du
// dépôt, c'est lui que la porte de plage reconnaît) et la réf citée, borne HAUTE comprise.
export const sitesMorts = (dead, rawDir = RAWDIR) => dead.map((d) => ({ file: `${rawDir}/${d.doc}`, ref: `${d.ref} l.${d.hi}` }))

// Réfs `LDB NN l.X…` et réfs « autres livres » (AA/ZI/EDO…) d'une ligne — génère
// `{ abbr, nn, hi }` (borne haute de la plage dépliée par `span`).
function* refsInLine(ln) {
  const ldb = ldbRe()
  let m
  while ((m = ldb.exec(ln))) {
    const [, hi] = span(m[2], m[3])
    yield { abbr: PIVOT_ABBR, nn: m[1], hi }
  }
  const other = otherRe()
  while ((m = other.exec(ln))) {
    const nn = m[2]
    if (nn == null) continue // pas de chapitre → hors sujet (réf de livre entier, pas de fichier à borner)
    const abbr = bookOf(m[1].replace(/\s+/g, ' ').trim())
    const [, hi] = span(m[3], m[4])
    yield { abbr, nn, hi }
  }
}

const lineCountCache = new Map()
function lineCount(path) {
  if (!lineCountCache.has(path)) lineCountCache.set(path, readText(path).split('\n').length)
  return lineCountCache.get(path)
}

/** Parcourt `rawDir` (docs/raw par défaut) et retourne les réfs mortes : `{ doc, row, ref, hi, chapterLines, file }`. */
export function scanDeadRefs(rawDir = RAWDIR, exclude = EXCLUDE) {
  const dead = []
  const docs = listerDossier(rawDir).filter((f) => f.endsWith('.md') && !exclude.has(f))
  for (const doc of docs) {
    const lines = readText(join(rawDir, doc)).split('\n')
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

/** Groupe des lignes-réf par clé `ABBR NN`. Servi à `check-folio-continuity.mjs`, dont le cliquet
 *  de folios est encore un COMPTE par fichier-chapitre. */
export function countsByChapterRef(dead) {
  const counts = {}
  for (const d of dead) counts[d.ref] = (counts[d.ref] ?? 0) + 1
  return counts
}

/** Compare des comptes mesurés à une baseline gelée : toute hausse ET toute baisse (baseline
 *  périmée) sont des anomalies — retourne `{ over, stale }` (listes de lignes-rapport). Seul
 *  consommateur : `check-folio-continuity.mjs`, sur `folio-gaps-baseline.json`. */
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
  const { neuves, perimees } = ecartDuVolet({
    sites: sitesMorts(dead), stock: readStock(STOCK_PATH), ou: 'dead-refs-stock.json',
  })

  console.log(`refs mortes (ligne hors borne du chapitre résolu) : ${dead.length} site(s)`)

  if (neuves.length) {
    console.log('RÉGRESSION — site(s) de réf morte hors du stock :')
    for (const o of neuves) console.log(`  ${o}`)
  }
  if (perimees.length) {
    console.log('Entrée(s) SOLDÉE(s) (réfs réparées) :')
    for (const s of perimees) console.log(`  ${s}`)
  }
  if (!neuves.length && !perimees.length) {
    console.log('OK — cliquet aligné, aucune régression.')
    return
  }
  console.log('Détail (fichier:ligne — réf morte, le chapitre a N lignes) :')
  for (const d of dead) console.log(`docs/raw/${d.doc}:${d.row} — ${d.ref} l.${d.hi} (${d.file} a ${d.chapterLines} lignes)`)
  process.exitCode = 1
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isMain) main()
