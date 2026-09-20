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
//   2. `N chapitres` — même classe, à la granularité du chapitre (#1825 lot E2) : le nombre de
//      chapitres d'un livre se compte à son extraction, il ne se recopie pas dans une page.
//   3. `<pastille-état> N` — compte d'état (✅/🟡/⬜/❌) collé à un nombre, hors formulation de
//      seuil invariant (`⬜ = 0`, qui ne mesure rien et ne devient jamais périmée).
// PÉRIMÈTRE — les pages MANUSCRITES de l'Atlas, plus le script qui écrit l'EN-TÊTE de chaque fiche
// (`assemble-domain.mjs` : un cardinal écrit là se recopie dans toute fiche assemblée ensuite — la
// garde doit voir l'ÉCRIVAIN, pas seulement ses sorties). En sont dehors, parce qu'aucun compte n'y
// est manuscrit : les rapports ré-générés (`RAWDOC_META_GENERATED`), les catalogues ré-générés
// verbatim depuis `Source/` (`catalogue-*.md`, où un compte serait la PROSE du livre), et les
// épreuves DATÉES (`isRawEpreuve`), dont les comptes sont une mesure à une date, gelée.
// Re-run : node scripts/raw/check-atlas-counts.mjs (chaîné dans npm run docs:check).
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { listerDossier } from '../guards/lib/lister.mjs'
import { BOOKS, RAWDOC_META_GENERATED, isRawEpreuve, readText } from './_lib.mjs'

const RACINE = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const RAW_DIR = resolve(RACINE, 'docs/raw')
export const INDEX_PATH = resolve(RAW_DIR, '00-index.md')
export const SOURCES_PATH = resolve(RAW_DIR, 'sources.md')
/** L'ASSEMBLEUR des fiches : il INJECTE son en-tête dans chaque fiche qu'il écrit. */
export const ASSEMBLEUR_PATH = resolve(RACINE, 'scripts/raw/assemble-domain.mjs')

/** Une page `docs/raw/` est-elle MANUSCRITE (donc scannée) ? */
export const estPageManuscrite = (nom) =>
  nom.endsWith('.md') && !RAWDOC_META_GENERATED.has(nom) && !isRawEpreuve(nom) && !nom.startsWith('catalogue-')

/** Les fichiers balayés, dans l'ordre du dossier puis l'assembleur. */
export const cheminsBalayes = (rawDir = RAW_DIR) =>
  [...listerDossier(rawDir).filter(estPageManuscrite).map((f) => resolve(rawDir, f)), ASSEMBLEUR_PATH]
export const SCANNED_PATHS = cheminsBalayes()

// Nombre de livres écrit en dur devant « livres » (ex. « 15 livres », « depuis les 14 livres »).
const BOOK_COUNT_RE = /\b(\d+)\s+livres\b/gi
// Même classe, à la granularité du chapitre (ex. « Cœur des règles (85 chapitres) »).
const CHAPTER_COUNT_RE = /\b(\d+)\s+chapitres\b/gi
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
    for (const m of line.matchAll(CHAPTER_COUNT_RE)) {
      violations.push({ line: i + 1, excerpt: m[0], reason: 'nombre de chapitres recopié en dur — il se compte à l\'extraction (`coverage.md`, GÉNÉRÉ), jamais dans une page manuscrite' })
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
    const text = readText(path)
    const rel = path.slice(RACINE.length + 1).replace(/\\/g, '/')
    all = all.concat(scanForbiddenCounts(text).map((v) => ({ ...v, rel })))
  }
  if (all.length) {
    console.error(`check-atlas-counts — ${all.length} compte(s) manuscrit(s) interdit(s) :`)
    for (const v of all) console.error(`  ${v.rel}:${v.line} « ${v.excerpt} » — ${v.reason}`)
    process.exitCode = 1
    return
  }
  console.log(`check-atlas-counts — OK (aucun compte manuscrit dans ${SCANNED_PATHS.length} fichier(s) manuscrit(s) de l'Atlas ; ${BOOKS.length} livres dans BOOKS)`)
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isMain) main()
