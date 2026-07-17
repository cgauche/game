// Garde anti-réapparition de COMPTES manuscrits dans les pages de garde de l'Atlas RAW (#544).
// `docs/raw/00-index.md` citait 3 fois « les 15 livres » et `docs/raw/sources.md` 2 fois (nombre
// recopié à la main, dérivable de BOOKS dans _lib.mjs), et 00-index.md avait aussi porté par le
// passé des comptes d'état (✅/🟡/⬜/❌ … N) recopiés depuis les fichiers GÉNÉRÉS
// (coverage.md/reconciliation.md/reanchor.md) — un compte manuscrit ment dès le commit suivant
// (fiche mémoire game-doc-derivee-jamais-ecrite-a-la-main). Forme retenue : PAS de stamp entre
// marqueurs (un seul nombre dérivable, disproportionné pour 2 pages courtes) — le texte cesse de
// porter un chiffre (renvoi vers la table de sources.md, dérivée de BOOKS) et cette garde échoue
// si un motif de la CLASSE interdite réapparaît, dans L'UN OU L'AUTRE fichier :
//   1. `N livres` — nombre de livres recopié en dur (doit dériver de BOOKS.length, jamais écrit).
//   2. `<pastille-état> N` — compte d'état (✅/🟡/⬜/❌) collé à un nombre, hors formulation de
//      seuil invariant (`⬜ = 0`, qui ne mesure rien et ne devient jamais périmée).
// Re-run : node scripts/raw/check-atlas-counts.mjs (chaîné dans npm run docs:check).
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { BOOKS } from './_lib.mjs'

const RAW_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '../../docs/raw')
export const INDEX_PATH = resolve(RAW_DIR, '00-index.md')
export const SOURCES_PATH = resolve(RAW_DIR, 'sources.md')
export const SCANNED_PATHS = [INDEX_PATH, SOURCES_PATH]

// Nombre de livres écrit en dur devant « livres » (ex. « 15 livres », « depuis les 14 livres »).
const BOOK_COUNT_RE = /\b(\d+)\s+livres\b/gi
// Pastille d'état (✅/🟡/⬜/❌) directement suivie d'un chiffre — un COMPTE, pas un seuil invariant
// (`⬜ = 0` ne matche pas : le `=` s'intercale entre la pastille et le chiffre).
const STATE_COUNT_RE = /[✅🟡⬜❌]\s+\d+\b/gu

/** Balaie `text` (PUR, aucun accès fichier) → liste de violations `{ line, excerpt, reason }`. */
export function scanForbiddenCounts(text) {
  const violations = []
  const lines = text.split('\n')
  lines.forEach((line, i) => {
    for (const m of line.matchAll(BOOK_COUNT_RE)) {
      violations.push({ line: i + 1, excerpt: m[0], reason: `nombre de livres recopié en dur (dérive de BOOKS.length = ${BOOKS.length} dans _lib.mjs, jamais écrit ici)` })
    }
    for (const m of line.matchAll(STATE_COUNT_RE)) {
      violations.push({ line: i + 1, excerpt: m[0], reason: 'compte d\'état manuscrit (✅/🟡/⬜/❌ + N) — les comptes courants vivent dans coverage.md/reconciliation.md/reanchor.md (GÉNÉRÉS), jamais dans les pages de garde de l\'Atlas' })
    }
  })
  return violations
}

function main() {
  let all = []
  for (const path of SCANNED_PATHS) {
    const text = readFileSync(path, 'utf8')
    const rel = 'docs/raw/' + path.slice(RAW_DIR.length + 1)
    all = all.concat(scanForbiddenCounts(text).map((v) => ({ ...v, rel })))
  }
  if (all.length) {
    console.error(`check-atlas-counts — ${all.length} compte(s) manuscrit(s) interdit(s) :`)
    for (const v of all) console.error(`  ${v.rel}:${v.line} « ${v.excerpt} » — ${v.reason}`)
    process.exitCode = 1
    return
  }
  console.log(`check-atlas-counts — OK (aucun compte manuscrit dans ${SCANNED_PATHS.length} page(s) de garde de l'Atlas ; ${BOOKS.length} livres dans BOOKS)`)
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isMain) main()
