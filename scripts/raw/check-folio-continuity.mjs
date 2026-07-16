// Garde de continuité des folios extraits (#397, item conditionnel du DoD « garde de complétude
// d'ancres si exprimable »). Chaque fichier `.md` de `Source/**` porte des ancres
// `<span id="page-N-0" data-folio="M"></span>` posées par l'extraction Marker. Le défaut #397
// (folios 235-236 sans ancre dans LDB 46) était INVISIBLE : rien ne vérifiait la CONTINUITÉ de la
// séquence des `data-folio`. Dans un fichier donné, la séquence doit être STRICTEMENT CROISSANTE
// ET CONSÉCUTIVE (delta 1) — tout delta ≠ 1 est un saut : une ou plusieurs pages n'ont reçu aucune
// ancre lors de l'extraction.
// Cliquet PAR fichier-chapitre (`scripts/raw/folio-gaps-baseline.json`, patron `check-refs.mjs`/
// `dead-refs-baseline.json`) : le stock déjà présent (mesuré, pas 0) est GELÉ — toute HAUSSE
// échoue ; une baseline devenue trop haute (extraction réparée) doit être ABAISSÉE.
// Re-run : node scripts/raw/check-folio-continuity.mjs
import { readdirSync, readFileSync } from 'node:fs'
import { join, dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { BOOKS } from './_lib.mjs'
import { countsByChapterRef, assertAgainstBaseline } from './check-refs.mjs'

export const BASELINE_PATH = join(dirname(fileURLToPath(import.meta.url)), 'folio-gaps-baseline.json')
const CHAPTER_FILE_RE = /^(\d+) - .*\.md$/

// Retourne les sauts de la séquence de `data-folio` d'un texte (PUR, aucun accès fichier) :
// `[{ from, to, delta }]` pour chaque paire consécutive dont le delta ≠ 1 (saut ou régression).
export function folioGapsInText(text) {
  const re = /data-folio="(\d+)"/g
  const folios = []
  let m
  while ((m = re.exec(text))) folios.push(Number(m[1]))
  const gaps = []
  for (let i = 1; i < folios.length; i++) {
    const delta = folios[i] - folios[i - 1]
    if (delta !== 1) gaps.push({ from: folios[i - 1], to: folios[i], delta })
  }
  return gaps
}

// Balaie un dossier de livre (fichiers `NN - *.md`) → `[{ abbr, nn, file, from, to, delta, ref }]`.
// `ref` = clé du cliquet (`ABBR NN`, patron `check-refs.mjs`).
export function scanBookDir(abbr, dir) {
  let files
  try { files = readdirSync(dir).filter((f) => CHAPTER_FILE_RE.test(f)) } catch { return [] }
  const out = []
  for (const file of files.sort()) {
    const nn = Number(file.match(CHAPTER_FILE_RE)[1])
    const text = readFileSync(join(dir, file), 'utf8')
    for (const gap of folioGapsInText(text)) {
      out.push({ abbr, nn, file, ...gap, ref: `${abbr} ${nn}` })
    }
  }
  return out
}

/** Balaie tous les livres de `books` (BOOKS par défaut) → sauts de folios agrégés. */
export function scanAllBooks(books = BOOKS) {
  const out = []
  for (const [abbr, dir] of books) out.push(...scanBookDir(abbr, dir))
  return out
}

function main() {
  const gaps = scanAllBooks()
  const counts = countsByChapterRef(gaps)
  const baseline = JSON.parse(readFileSync(BASELINE_PATH, 'utf8'))
  const { over, stale } = assertAgainstBaseline(counts, baseline)

  console.log(`sauts de folio (data-folio non consécutif) : ${gaps.length} sur ${Object.keys(counts).length} chapitre(s)-réf`)

  if (over.length) {
    console.log('RÉGRESSION — hausse de sauts de folio par chapitre-réf :')
    for (const o of over) console.log(`  ${o}`)
  }
  if (stale.length) {
    console.log('Baseline(s) PÉRIMÉE(s) (sauts réparés) — à ABAISSER dans folio-gaps-baseline.json :')
    for (const s of stale) console.log(`  ${s}`)
  }
  if (!over.length && !stale.length) {
    console.log('OK — cliquet aligné, aucune régression.')
    return
  }
  console.log('Détail (fichier — saut de folio N→M) :')
  for (const g of gaps) console.log(`${g.abbr} ${String(g.nn).padStart(2, '0')} (${g.file}) — folio ${g.from} → ${g.to} (Δ${g.delta})`)
  process.exitCode = 1
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isMain) main()
