// Garde de graphie des citations RAW (#487 lot 3) — verrouille à ZÉRO la classe « chapitre-relative »
// `NN-Nom l.X` (ex. `18-Traumatisme l.417-422`) : cette forme est INVISIBLE de `ldbRe`/`otherRe`
// (_lib.mjs — les deux exigent le livre AVANT le numéro de chapitre, jamais un nom de chapitre
// collé au numéro), donc jamais comptée par `reconcile.mjs`, jamais ré-ancrée. Forme canonique :
// `LDB NN l.X` (ou `<ABRÉV> NN l.X` pour les 14 autres livres) — sans nom de chapitre.
// Zéro tolérance, PAS de baseline (le stock doit être à 0 après le lot #487) : toute occurrence
// nouvelle ou survivante fait échouer le test avec la liste `fichier:ligne`.
// Re-run : node scripts/raw/citation-graphy-guard.mjs
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

export const SRC_DIR = 'src'
export const EXTS = ['.ts', '.tsx', '.json']
export const RAWDIR = 'docs/raw'

// Fiches EXCLUES des scans docs/raw (rapports générés / épreuves de ré-ancrage — graphies libres).
const DOCS_EXCLUDE = new Set(['coverage.md', 'reconciliation.md', 'reanchor.md'])
const isScannedFiche = (name) => name.endsWith('.md') && !DOCS_EXCLUDE.has(name) && !name.startsWith('epreuve-')

// (a) Plage de lignes à tiret CADRATIN/demi-cadratin : `l.417–422` / `l.417—422`. Forme canonique =
// tiret-moins `l.417-422` (dépliée par `span`) ; en/em-dash est INVISIBLE de `span` → jamais dépliée.
export const EMDASH_RANGE_RE = () => /l\.\d+[–—]/g
// (b) Réf de livre SANS chapitre : `<ABRÉV> l.<n>` (AA/ZI/MDG/EDOC?/T2C?/T3/ADE I·II/Middenheim/NADAJ/
// Altdorf/Ubersreik) — invisible de `otherRe` (qui exige un numéro de chapitre) → jamais comptée.
export const BOOK_NO_CHAPTER_RE = () => /\b(AA|ZI|MDG|EDOC?|T2C?|T3|ADE ?I{1,2}|Middenheim|NADAJ|Altdorf|Ubersreik) l\.\d/g
// (c) Nom de FICHIER de chapitre en backticks entre le livre et les lignes : `` `NN - Titre.md` l.X ``
// (ex. `ADE II \`08 - Le théâtre de la guerre.md\` l.89-131`) — invisible d'`otherRe` (numéro de
// chapitre attendu NU, pas un nom de fichier). Forme canonique : `<ABRÉV> NN l.X`.
export const BACKTICK_FILE_RE = () => /`\d{1,2} - [^`]*\.md` l\.\d/g

// `\b\d{1,2}-[A-Za-zÀ-ÿ]+ l\.\d+` : un numéro de chapitre (1-2 chiffres) collé par un tiret à un
// nom (lettres accentuées comprises — `\w` seul EXCLUT les accents hors mode Unicode, d'où la classe
// explicite), suivi d'une réf `l.<ligne>` — ex. `15-Déplacement l.79`, `18-Traumatisme l.417`,
// `15-Dépl l.87`. Les dates (`2026-07-15`) et ids (`ticket-42`) ne matchent pas : `\d{1,2}-` exige
// 1-2 chiffres puis un TIRET puis une LETTRE (jamais un second groupe de chiffres, jamais un id nu
// sans " l.<n>" collé juste après le nom).
export const GRAPHY_RE = () => /\b\d{1,2}-[A-Za-zÀ-ÿ]+ l\.\d+/g

function walk(dir, exts, acc = []) {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e)
    let s
    try { s = statSync(p) } catch { continue }
    if (s.isDirectory()) { if (e !== 'node_modules') walk(p, exts, acc) }
    else if (exts.some((x) => e.endsWith(x))) acc.push(p)
  }
  return acc
}

/** Scanne `srcDir` (défaut `src/`) pour la graphie chapitre-relative. Retourne
 *  `{ file, row, text }[]` — `text` = la ligne tronquée (160c) pour le diagnostic. Pur (aucune écriture). */
export function scanGraphyViolations(srcDir = SRC_DIR, exts = EXTS) {
  const violations = []
  for (const f of walk(srcDir, exts)) {
    const lines = readFileSync(f, 'utf8').split('\n')
    lines.forEach((ln, i) => {
      const re = GRAPHY_RE()
      if (re.test(ln)) violations.push({ file: f.replace(/\\/g, '/'), row: i + 1, text: ln.trim().slice(0, 160) })
    })
  }
  return violations
}

/** Scanne les fiches `docs/raw/*.md` (hors rapports/épreuves) pour les DEUX graphies de fiche à
 *  verrouiller : (a) plage à tiret cadratin, (b) réf de livre sans chapitre. Retourne
 *  `{ file, row, kind, text }[]` (`kind` ∈ `emdash-range` | `book-no-chapter`). Pur (aucune écriture). */
export function scanDocsRawViolations(rawDir = RAWDIR) {
  const violations = []
  let names
  try { names = readdirSync(rawDir).filter(isScannedFiche) } catch { names = [] }
  for (const name of names) {
    const lines = readFileSync(join(rawDir, name), 'utf8').split('\n')
    lines.forEach((ln, i) => {
      const hit = (re, kind) => { if (re().test(ln)) violations.push({ file: `${rawDir}/${name}`, row: i + 1, kind, text: ln.trim().slice(0, 160) }) }
      hit(EMDASH_RANGE_RE, 'emdash-range')
      hit(BOOK_NO_CHAPTER_RE, 'book-no-chapter')
      hit(BACKTICK_FILE_RE, 'backtick-file')
    })
  }
  return violations
}

function main() {
  const src = scanGraphyViolations()
  const docs = scanDocsRawViolations()
  if (src.length) {
    console.log(`citation-graphy-guard : ${src.length} graphie(s) chapitre-relative(s) (src/) :`)
    for (const { file, row, text } of src) console.log(`  ${file}:${row}  ${text}`)
  } else {
    console.log('citation-graphy-guard : 0 graphie chapitre-relative (src/) — classe verrouillée à zéro.')
  }
  if (docs.length) {
    console.log(`citation-graphy-guard : ${docs.length} graphie(s) de fiche (docs/raw/) :`)
    for (const { file, row, kind, text } of docs) console.log(`  ${file}:${row}  [${kind}]  ${text}`)
  } else {
    console.log('citation-graphy-guard : 0 graphie de fiche (docs/raw/) — deux classes verrouillées à zéro.')
  }
  if (src.length || docs.length) process.exitCode = 1
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isMain) main()
