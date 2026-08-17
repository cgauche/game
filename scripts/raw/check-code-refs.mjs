// Garde de cohérence des lignes citées par le CODE (suite #434/#487, prévention).
// `check-refs.mjs` borne les réfs des DOCS (docs/raw) ; rien ne couvrait celles du CODE — vécu :
// `LDB 60 l.92` cité dans un chapitre de 62 lignes. Ici : pour chaque réf `<ABRÉV> NN l.X[-Y|+n…]`
// de `src/**` (.ts/.tsx/.json, hors node_modules, hors `src/gameIso/rig/parts/tenues/defs/` — même
// périmètre que le générateur `build-implemente`), résout le fichier-chapitre (`chapterFile`, _lib.mjs)
// et signale la réf dont la borne haute dépasse le nombre de lignes du chapitre, OU dont le chapitre
// est introuvable. Regex de réfs RÉUTILISÉES (`ldbRe`/`otherRe`/`span`/`bookOf`) — jamais réécrites.
// Cliquet PAR FICHIER (`scripts/raw/dead-code-refs-baseline.json`, patron `assertAgainstBaseline` de
// check-refs.mjs) : toute HAUSSE échoue ; une baseline devenue trop haute (réfs réparées) doit être
// ABAISSÉE. Le stock gelé (dérive de ligne post-ré-extraction Marker) soldé (#583) : le fichier de
// baseline est ABSENT en régime nominal → tolérance ZÉRO (toute réf morte échoue nominativement,
// `readBaseline` traite un fichier absent comme `{}`). Si un résidu IRRÉDUCTIBLE réapparaît, la
// baseline se recrée à sa mesure MINIMALE avec un diagnostic en commentaire — jamais un cliquet
// tacite qui masque une future régression.
// Re-run : node scripts/raw/check-code-refs.mjs (npm run raw:check-code-refs).
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { ldbRe, otherRe, span, chapterFile, bookOf, readText, PIVOT_ABBR } from './_lib.mjs'

export const SRC_DIR = 'src'
export const EXCLUDE_SRC_PREFIX = 'src/gameIso/rig/parts/tenues/defs/' // art de couverture, pas une règle (cf. build-implemente)
export const BASELINE_PATH = join(dirname(fileURLToPath(import.meta.url)), 'dead-code-refs-baseline.json')

// Réfs `LDB NN l.X…` et « autres livres » (AA/ZI/EDO…) d'une ligne — `{ abbr, nn, hi }` (borne haute
// de la plage dépliée par `span`). Réfs de livre entier (sans numéro de chapitre) = hors sujet (aucun
// fichier à borner). Miroir de `refsInLine` de check-refs.mjs, même vocabulaire de _lib.mjs.
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
    if (nn == null) continue
    const abbr = bookOf(m[1].replace(/\s+/g, ' ').trim())
    if (!abbr) continue
    const [, hi] = span(m[3], m[4])
    yield { abbr, nn, hi }
  }
}

const lineCountCache = new Map()
function lineCount(path) {
  if (!lineCountCache.has(path)) lineCountCache.set(path, readText(path).split('\n').length)
  return lineCountCache.get(path)
}

export const isExcludedSrc = (rel) => rel.startsWith(EXCLUDE_SRC_PREFIX)

function walkSrc(dir, acc = []) {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e)
    let s
    try { s = statSync(p) } catch { continue }
    if (s.isDirectory()) { if (e !== 'node_modules') walkSrc(p, acc) }
    else if (/\.(tsx?|json)$/.test(e)) acc.push(p)
  }
  return acc
}

/** Parcourt `srcDir` (src/ par défaut) et retourne les réfs mortes du code :
 *  `{ file, row, ref, abbr, nn, hi, kind, chapterLines?, chapterFile? }`.
 *  `kind` ∈ `out-of-bounds` (chapitre résolu, ligne hors borne) | `chapter-not-found` (chapitre absent). */
export function scanDeadCodeRefs(srcDir = SRC_DIR) {
  const dead = []
  for (const f of walkSrc(srcDir)) {
    const rel = f.split('\\').join('/')
    if (isExcludedSrc(rel)) continue
    const lines = readFileSync(f, 'utf8').split('\n')
    lines.forEach((ln, i) => {
      for (const { abbr, nn, hi } of refsInLine(ln)) {
        const cf = chapterFile(abbr, nn)
        const ref = `${abbr} ${Number(nn)} l.${hi}`
        if (!cf) {
          dead.push({ file: rel, row: i + 1, ref, abbr, nn, hi, kind: 'chapter-not-found' })
          continue
        }
        const chapterLines = lineCount(cf.path)
        if (hi > chapterLines) {
          dead.push({ file: rel, row: i + 1, ref, abbr, nn, hi, kind: 'out-of-bounds', chapterLines, chapterFile: cf.file })
        }
      }
    })
  }
  return dead
}

/** Groupe les réfs mortes par FICHIER src (unité du cliquet). */
export function countsByFile(dead) {
  const counts = {}
  for (const d of dead) counts[d.file] = (counts[d.file] ?? 0) + 1
  return counts
}

/** Compare des comptes mesurés à une baseline gelée : toute hausse ET toute baisse (baseline
 *  périmée) sont des anomalies — retourne `{ over, stale }` (listes de lignes-rapport). Repris tel
 *  quel du patron de check-refs.mjs (même sémantique de cliquet). */
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

/** Baseline gelée si `dead-code-refs-baseline.json` existe, sinon `{}` (mode ZÉRO-TOLÉRANCE :
 *  fichier absent = aucune réf morte tolérée, `assertAgainstBaseline` fait le reste). */
export function readBaseline(path = BASELINE_PATH) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'))
  } catch (err) {
    if (err.code === 'ENOENT') return {}
    throw err
  }
}

function main() {
  const dead = scanDeadCodeRefs()
  const counts = countsByFile(dead)
  const baseline = readBaseline()
  const { over, stale } = assertAgainstBaseline(counts, baseline)

  console.log(`réfs de code mortes (ligne hors borne du chapitre, ou chapitre introuvable) : ${dead.length} sur ${Object.keys(counts).length} fichier(s)`)

  if (over.length) {
    console.log('RÉGRESSION — hausse de réfs mortes par fichier :')
    for (const o of over) console.log(`  ${o}`)
  }
  if (stale.length) {
    console.log('Baseline(s) PÉRIMÉE(s) (réfs réparées) — à ABAISSER dans dead-code-refs-baseline.json :')
    for (const s of stale) console.log(`  ${s}`)
  }
  if (!over.length && !stale.length) {
    console.log('OK — cliquet aligné, aucune régression.')
    return
  }
  console.log('Détail (fichier:ligne — réf, cause) :')
  for (const d of dead) {
    const cause = d.kind === 'out-of-bounds' ? `${d.chapterFile} a ${d.chapterLines} lignes` : 'chapitre introuvable'
    console.log(`${d.file}:${d.row} — ${d.ref} (${cause})`)
  }
  process.exitCode = 1
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isMain) main()
