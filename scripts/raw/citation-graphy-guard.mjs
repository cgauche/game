// Garde de graphie des citations RAW (#487 lot 3, étendue #585 lot A, #454 DoD) — verrouille la
// classe « chapitre-relative » (zéro tolérance) et CLIQUETTE les dérives de graphie cosmétique
// (`ch.`, folio nu, réf sans chapitre) le temps de leur strip mécanique (lot B). Les familles
// `bareFolio`/`bookNoChapterSrc` couvrent désormais `src/**` ET `docs/raw/*.md` (fiches scannées,
// même périmètre que `chDot` — #454 : les scans étaient auparavant aveugles à docs/raw).
// `NN-Nom l.X` (ex. `18-Traumatisme l.417-422`) : cette forme est INVISIBLE de `ldbRe`/`otherRe`
// (_lib.mjs — les deux exigent le livre AVANT le numéro de chapitre, jamais un nom de chapitre
// collé au numéro), donc jamais comptée par `reconcile.mjs`, jamais ré-ancrée. Forme canonique :
// `LDB NN l.X` (ou `<ABRÉV> NN l.X` pour les 14 autres livres) — sans nom de chapitre.
// Zéro tolérance, PAS de baseline (le stock doit être à 0 après le lot #487) : toute occurrence
// nouvelle ou survivante fait échouer le test avec la liste `fichier:ligne`.
// Re-run : node scripts/raw/citation-graphy-guard.mjs
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { fieldBlockMask } from './build-implemente.mjs'
import { otherAbbrAlternation, bookOf, folioRange, chapterBoundaryRiskFor, RAWDOC_META_GENERATED, RAWDOC_AUTHOR_META, isRawEpreuve, readText } from './_lib.mjs'
import { countsByFile, assertAgainstBaseline, readBaseline as readBaselineFile } from './check-code-refs.mjs'

export const SRC_DIR = 'src'
export const EXTS = ['.ts', '.tsx', '.json']
export const RAWDIR = 'docs/raw'
export const BASELINE_PATH = join(dirname(fileURLToPath(import.meta.url)), 'graphy-baseline.json')

// Fiches EXCLUES des scans docs/raw (rapports générés / épreuves de ré-ancrage — graphies libres).
// Source UNIQUE _lib.mjs (#454 DoD, #585 lot A) — jamais un Set dupliqué à la main ici.
const DOCS_EXCLUDE = RAWDOC_META_GENERATED
const isScannedFiche = (name) => name.endsWith('.md') && !DOCS_EXCLUDE.has(name) && !isRawEpreuve(name)
// Scan (d) « prose d'état d'implémentation » : mêmes exclusions + fiches d'auteur (index, conventions
// de sourcing) dont les réfs sont illustratives, pas de la prose d'état à juger (RAWDOC_AUTHOR_META).
const isImplProseScanned = (name) => isScannedFiche(name) && !RAWDOC_AUTHOR_META.has(name)

// (a) Plage de lignes à tiret CADRATIN/demi-cadratin : `l.417–422` / `l.417—422`. Forme canonique =
// tiret-moins `l.417-422` (dépliée par `span`) ; en/em-dash est INVISIBLE de `span` → jamais dépliée.
export const EMDASH_RANGE_RE = () => /l\.\d+[–—]/g
// (b) Réf de livre SANS chapitre : `<ABRÉV> l.<n>` — invisible de `otherRe` (qui exige un numéro de
// chapitre) → jamais comptée. Alternation DÉRIVÉE de `_lib.mjs` (#434 défaut 10 : une alternation
// écrite à la main ici se désynchronisait dès qu'un livre s'ajoutait à BOOKS). LDB hors scan : cf.
// `ldbRe` (`_lib.mjs`), le groupe livre y est obligatoire — une réf `LDB l.X` sans chapitre n'a pas
// de forme distincte détectable par cette classe (elle resterait juste hors couverture `ldbRe`/
// `reconcile`, pas une graphie « livre-sans-chapitre » au sens de cette garde).
export const BOOK_NO_CHAPTER_RE = () => new RegExp(`\\b(${otherAbbrAlternation()}) l\\.\\d`, 'g')
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

// (d) Prose d'état d'implémentation dans une fiche, HORS bloc de champ généré `**Implémente**`
// (frontière via `fieldBlockMask`, source unique). Verrouille à zéro toute réapparition de « X n'est
// pas câblé / ne sont pas implémentés » — la graphie PLURIELLE (`ne sont pas implémentés`) échappait
// à l'ancien NONIMPL_RE. Fabrique FRAÎCHE (état /g non partagé). Insensible à la casse.
export const NONIMPL_RE = () => new RegExp(
  '(?:' + [
    'non[- ]impl[ée]ment[ée]?e?s?',
    "n['’](?:est|étaient?|était) pas (?:encore )?impl[ée]ment[ée]?e?s?",
    'ne sont pas (?:encore )?impl[ée]ment[ée]?e?s?',
    'non c[âa]bl[ée]?e?s?',
    'pas (?:encore )?c[âa]bl[ée]?e?s?',
  ].join('|') + ')\\b',
  'iu',
)

// --- (#585 lot A) extension : cosmétique `ch.` (e), folio nu (f), abréviation INCONNUE (g) ---
// Alternation TOUS livres (LDB compris) — dérivée de `_lib.mjs` (LDB ne préfixe-collisionne AUCUNE
// autre abréviation, l'ordre de longueur d'`otherAbbrAlternation` reste valide en lui ajoutant LDB
// en tête, sans recomposer le tri).
const ALL_ABBR_ALT = () => `LDB|${otherAbbrAlternation()}`
// (e) `ch.` cosmétique devant un numéro de chapitre — TOLÉRÉ par `ldbRe`/`otherRe` (#434 défaut 3),
// mais graphie DÉVIANTE au sens de #585 (le numéro de fichier n'a plus besoin du préfixe `ch.` depuis
// la convention 2ed2acff/a5eddf80) : cliqueté par fichier, strip mécanique = lot B.
export const CH_DOT_RE = () => new RegExp(`\\b(${ALL_ABBR_ALT()}) ch\\.\\d+`, 'g')
// (f) Folio NU sans chapitre : `<ABRÉV> p.<n>` (chapitre absent → invérifiable contre les data-folio
// bakés). Classification par TYPE de champ : en `.ts`/`.tsx` seule une ligne de COMMENTAIRE compte
// (une citation dans un titre de test `describe`/`it` reste hors périmètre, ce n'est pas un
// commentaire) ; en `.json` seul un champ `"ref": …` compte (les champs `desc`/prose sont verbatim
// source — règle 5, jamais réécrits — et `source:{book,page}` est la convention folio-imprimé, hors
// périmètre de cette garde, cf. #585).
export const BARE_FOLIO_RE = () => new RegExp(`\\b(${ALL_ABBR_ALT()}) p\\.\\d+`, 'g')
const isCommentLine = (ln) => { const t = ln.trim(); return t.startsWith('//') || t.startsWith('*') || t.startsWith('/*') }
const isRefFieldLine = (ln) => /^\s*"ref"\s*:/.test(ln)
// (g) Réf `ABRÉV NN l.X` / `ABRÉV NN p.X` dont l'abréviation N'EST PAS un livre connu de `_lib.mjs`
// (`bookOf` couvre BOOKS + les variantes tolérantes) — inversion : l'inconnu échoue NOMINATIVEMENT,
// zéro tolérance, PAS de baseline (une abréviation inconnue est toujours un typo/une invention, jamais
// un stock à geler).
export const UNKNOWN_ABBR_RE = () => /\b[A-Z]{2,6}(?:\s+I{1,2})? \d+ [lp]\.\d+/g

// (h) MULTI-FOLIOS dont un folio tombe dans un chapitre DIFFÉRENT du chapitre écrit (#522 juge
// adversarial) : `<ABRÉV> NN p.X` suivi d'un ou plusieurs folios supplémentaires (`/Y`, `-Y`, `,Z`).
// Un seul chapitre N est écrit dans la réf — si un des folios listés ne résout PAS dans CE chapitre
// (`folioRange(abbr, folio).ch !== N`), c'est que le folio appartient à un AUTRE chapitre, jamais
// écrit : violation. Forme canonique : deux réfs séparées (`ABRÉV NN p.X / ABRÉV MM p.Y`).
export const MULTI_FOLIO_RE = () => new RegExp(`\\b(${ALL_ABBR_ALT()}) (\\d+) p\\.(\\d+)((?:[/,-]\\d+)+)`, 'g')

// (i) Folio SIMPLE `<ABRÉV> N p.X` cité au DERNIER folio du chapitre N alors que le chapitre N+1
// s'ouvre sur X ou X+1 (#454 juge adversarial, cas prouvé `LDB 48 p.255` — voir `chapterBoundaryRisk`,
// _lib.mjs). Négation `(?![/,-]\d)` : exclut les formes multi-folios déjà couvertes par le scan (h)
// ci-dessus (périmètre disjoint, pas de double-compte). AVERTISSEMENT cliqueté (jamais bloquant à
// l'aveugle) : la position structurelle rend le débordement PLAUSIBLE, mais seule une relecture
// verbatim tranche si le sujet cité vit réellement en N ou en N+1 — non automatisable ici.
export const CHAPTER_BOUNDARY_FOLIO_RE = () => new RegExp(`\\b(${ALL_ABBR_ALT()}) (\\d+) p\\.(\\d+)(?![/,-]\\d)`, 'g')

/** Scan (h) : multi-folios à cheval sur des chapitres différents — `src/**` (.ts/.tsx/.json), même
 *  périmètre que (f) (commentaire en .ts/.tsx, champ `"ref"` en .json). Un folio NON RÉSOLVABLE
 *  (`folioRange` → `null`/`'ambiguous'`, ancre absente — résidus #522) est INDÉTERMINÉ, jamais une
 *  violation (silence, pas de faux positif sur les trous de la ré-extraction Marker) : seul un folio
 *  qui RÉSOUT dans un chapitre différent de N est fautif. Retourne `{ file, row, folios, text }[]`
 *  (`folios` = les folios fautifs, avec leur chapitre résolu). Pur (aucune écriture). */
export function scanMultiFolioSplitViolations(srcDir = SRC_DIR, exts = EXTS) {
  const violations = []
  for (const f of walk(srcDir, exts)) {
    const rel = f.replace(/\\/g, '/')
    const isJson = f.endsWith('.json')
    const lines = readFileSync(f, 'utf8').split('\n')
    lines.forEach((ln, i) => {
      const inScope = isJson ? isRefFieldLine(ln) : isCommentLine(ln)
      if (!inScope) return
      const re = MULTI_FOLIO_RE()
      let m
      while ((m = re.exec(ln))) {
        const [, abbr, chStr, folioStr, suffix] = m
        const ch = Number(chStr)
        const extraFolios = (suffix.match(/\d+/g) || []).map(Number)
        const badFolios = []
        for (const folio of [Number(folioStr), ...extraFolios]) {
          const res = folioRange(abbr, folio)
          if (!res || res === 'ambiguous') continue // indéterminé, jamais une violation
          if (res.ch !== ch) badFolios.push({ folio, ch: res.ch })
        }
        if (badFolios.length) violations.push({ file: rel, row: i + 1, folios: badFolios, text: ln.trim().slice(0, 160) })
      }
    })
  }
  return violations
}

/** Scan (i) : folio simple `<ABRÉV> N p.X` au DERNIER folio du chapitre N, chapitre N+1 s'ouvrant
 *  sur X/X+1 (#454 juge adversarial, `chapterBoundaryRisk`). Même périmètre que (h) en `src/**`, ET
 *  `docs/raw/*.md` (fiches scannées, patron `chDot`/`bareFolio`). AVERTISSEMENT cliqueté (non bloquant
 *  sur le stock EXISTANT, cf. `main()`) — un candidat structurel n'est PAS une preuve verbatim.
 *  Retourne `{ file, row, abbr, ch, folio, text }[]`. Pur (aucune écriture). */
export function scanChapterBoundaryFolioViolations(srcDir = SRC_DIR, exts = EXTS, rawDir = RAWDIR) {
  const violations = []
  const srcFiles = walk(srcDir, exts).map((f) => ({ f, isJson: f.endsWith('.json'), isRaw: false }))
  const docFiles = rawFiles(rawDir, isScannedFiche).map((f) => ({ f, isJson: false, isRaw: true }))
  for (const { f, isJson, isRaw } of [...srcFiles, ...docFiles]) {
    const rel = f.replace(/\\/g, '/')
    const lines = readText(f).split('\n')
    lines.forEach((ln, i) => {
      const inScope = isRaw ? true : (isJson ? isRefFieldLine(ln) : isCommentLine(ln))
      if (!inScope) return
      const re = CHAPTER_BOUNDARY_FOLIO_RE()
      let m
      while ((m = re.exec(ln))) {
        const [, abbr, chStr, folioStr] = m
        const ch = Number(chStr)
        const folio = Number(folioStr)
        if (chapterBoundaryRiskFor(abbr, ch, folio)) {
          violations.push({ file: rel, row: i + 1, abbr, ch, folio, text: ln.trim().slice(0, 160) })
        }
      }
    })
  }
  return violations
}

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

function rawFiles(rawDir, filter) {
  let names
  try { names = readdirSync(rawDir).filter(filter) } catch { names = [] }
  return names.map((n) => join(rawDir, n))
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
    const lines = readText(join(rawDir, name)).split('\n')
    lines.forEach((ln, i) => {
      const hit = (re, kind) => { if (re().test(ln)) violations.push({ file: `${rawDir}/${name}`, row: i + 1, kind, text: ln.trim().slice(0, 160) }) }
      hit(EMDASH_RANGE_RE, 'emdash-range')
      hit(BOOK_NO_CHAPTER_RE, 'book-no-chapter')
      hit(BACKTICK_FILE_RE, 'backtick-file')
    })
  }
  return violations
}

/** Scanne les fiches `docs/raw/*.md` (hors rapports/épreuves + 00-index) pour la prose d'état
 *  d'implémentation (scan d) : toute ligne HORS bloc de champ `**Implémente**` qui matche `NONIMPL_RE`.
 *  Retourne `{ file, row, text }[]`. Pur (aucune écriture). */
export function scanImplProseViolations(rawDir = RAWDIR) {
  const violations = []
  let names
  try { names = readdirSync(rawDir).filter(isImplProseScanned) } catch { names = [] }
  for (const name of names) {
    const lines = readText(join(rawDir, name)).split('\n')
    const { inFieldBlock } = fieldBlockMask(lines)
    lines.forEach((ln, i) => {
      if (inFieldBlock[i]) return
      if (NONIMPL_RE().test(ln)) violations.push({ file: `${rawDir}/${name}`, row: i + 1, text: ln.trim().slice(0, 160) })
    })
  }
  return violations
}

/** Scan (e) : `ch.` cosmétique — src/** (.ts/.tsx/.json) ET docs/raw/*.md (mêmes fiches que (b)/(c)).
 *  Retourne `{ file, row, text }[]`, UNE entrée par occurrence (cliqueté par fichier, cf. `countsByFile`). */
export function scanChDotViolations(srcDir = SRC_DIR, exts = EXTS, rawDir = RAWDIR) {
  const violations = []
  const files = [...walk(srcDir, exts), ...rawFiles(rawDir, isScannedFiche)]
  for (const f of files) {
    const rel = f.replace(/\\/g, '/')
    const lines = readText(f).split('\n')
    lines.forEach((ln, i) => {
      const re = CH_DOT_RE()
      let m
      while ((m = re.exec(ln))) violations.push({ file: rel, row: i + 1, text: ln.trim().slice(0, 160) })
    })
  }
  return violations
}

/** Scan (f) : folio NU `<ABRÉV> p.X` sans chapitre — seulement les lignes en SCOPE en `src/` :
 *  commentaire `.ts`/`.tsx`, champ `"ref"` en `.json` (desc/prose et `source:{book,page}` HORS
 *  scope, #585) — ET, en `docs/raw/*.md` (fiches scannées, patron `chDot`), TOUTE ligne (prose de
 *  citation, pas de notion de « commentaire »). Retourne `{ file, row, text }[]`. Pur (aucune écriture). */
export function scanBareFolioViolations(srcDir = SRC_DIR, exts = EXTS, rawDir = RAWDIR) {
  const violations = []
  for (const f of walk(srcDir, exts)) {
    const rel = f.replace(/\\/g, '/')
    const isJson = f.endsWith('.json')
    const lines = readFileSync(f, 'utf8').split('\n')
    lines.forEach((ln, i) => {
      const inScope = isJson ? isRefFieldLine(ln) : isCommentLine(ln)
      if (!inScope) return
      const re = BARE_FOLIO_RE()
      let m
      while ((m = re.exec(ln))) violations.push({ file: rel, row: i + 1, text: ln.trim().slice(0, 160) })
    })
  }
  for (const f of rawFiles(rawDir, isScannedFiche)) {
    const rel = f.replace(/\\/g, '/')
    const lines = readText(f).split('\n')
    lines.forEach((ln, i) => {
      const re = BARE_FOLIO_RE()
      let m
      while ((m = re.exec(ln))) violations.push({ file: rel, row: i + 1, text: ln.trim().slice(0, 160) })
    })
  }
  return violations
}

/** Scan (b) étendu à src/** ET docs/raw/*.md (fiches scannées, patron `chDot`) — réf de livre sans
 *  chapitre `<ABRÉV> l.<n>` (`BOOK_NO_CHAPTER_RE`). Retourne `{ file, row, text }[]`. Pur (aucune écriture). */
export function scanBookNoChapterSrcViolations(srcDir = SRC_DIR, exts = EXTS, rawDir = RAWDIR) {
  const violations = []
  const files = [...walk(srcDir, exts), ...rawFiles(rawDir, isScannedFiche)]
  for (const f of files) {
    const rel = f.replace(/\\/g, '/')
    const lines = readText(f).split('\n')
    lines.forEach((ln, i) => {
      const re = BOOK_NO_CHAPTER_RE()
      let m
      while ((m = re.exec(ln))) violations.push({ file: rel, row: i + 1, text: ln.trim().slice(0, 160) })
    })
  }
  return violations
}

/** Scan (g) : réf `ABRÉV NN l.X`/`ABRÉV NN p.X` dont l'abréviation est INCONNUE de `_lib.mjs`
 *  (`bookOf` retourne null). Zéro tolérance, PAS de baseline. Retourne `{ file, row, abbr, text }[]`. */
export function scanUnknownAbbrViolations(srcDir = SRC_DIR, exts = EXTS, rawDir = RAWDIR) {
  const violations = []
  const files = [...walk(srcDir, exts), ...rawFiles(rawDir, isScannedFiche)]
  for (const f of files) {
    const rel = f.replace(/\\/g, '/')
    const lines = readText(f).split('\n')
    lines.forEach((ln, i) => {
      const re = UNKNOWN_ABBR_RE()
      let m
      while ((m = re.exec(ln))) {
        const abbr = m[0].replace(/ \d+ [lp]\.\d+$/, '')
        if (!bookOf(abbr)) violations.push({ file: rel, row: i + 1, abbr, text: ln.trim().slice(0, 160) })
      }
    })
  }
  return violations
}

/** Baseline gelée si `graphy-baseline.json` existe, sinon `{}` (une famille absente = `{}`). */
export function readBaseline(path = BASELINE_PATH) {
  return readBaselineFile(path)
}

// Compare une famille de violations à sa baseline — mêmes sémantiques que check-code-refs.mjs
// (hausse ET péremption sont des anomalies). `family` = clé de premier niveau de graphy-baseline.json.
function checkFamily(label, family, violations, baseline) {
  const counts = countsByFile(violations)
  const { over, stale } = assertAgainstBaseline(counts, baseline[family] ?? {})
  return { label, family, violations, counts, over, stale }
}

function main() {
  const src = scanGraphyViolations()
  const docs = scanDocsRawViolations()
  const implProse = scanImplProseViolations()
  const baseline = readBaseline()
  const chDot = checkFamily('ch. cosmétique', 'chDot', scanChDotViolations(), baseline)
  const bareFolio = checkFamily('folio nu', 'bareFolio', scanBareFolioViolations(), baseline)
  const bookNoChapterSrc = checkFamily('réf sans chapitre (src+docs/raw)', 'bookNoChapterSrc', scanBookNoChapterSrcViolations(), baseline)
  const unknownAbbr = scanUnknownAbbrViolations()
  const multiFolioSplit = scanMultiFolioSplitViolations()
  const chapterBoundaryFolio = checkFamily('folio en fin de chapitre (AVERTISSEMENT)', 'chapterBoundaryFolio', scanChapterBoundaryFolioViolations(), baseline)

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
  if (implProse.length) {
    console.log(`citation-graphy-guard : ${implProse.length} prose(s) d'état d'implémentation (docs/raw/, hors champ généré) :`)
    for (const { file, row, text } of implProse) console.log(`  ${file}:${row}  ${text}`)
  } else {
    console.log('citation-graphy-guard : 0 prose d\'état d\'implémentation (docs/raw/) — classe verrouillée à zéro.')
  }

  let baselineFail = false
  for (const { label, violations, over, stale } of [chDot, bareFolio, bookNoChapterSrc]) {
    console.log(`citation-graphy-guard (#585) : ${label} — ${violations.length} occurrence(s) mesurée(s).`)
    if (over.length) {
      baselineFail = true
      console.log(`  RÉGRESSION — hausse par fichier :`)
      for (const o of over) console.log(`    ${o}`)
    }
    if (stale.length) {
      baselineFail = true
      console.log(`  Baseline(s) PÉRIMÉE(s) (à ABAISSER dans graphy-baseline.json) :`)
      for (const s of stale) console.log(`    ${s}`)
    }
  }

  if (unknownAbbr.length) {
    console.log(`citation-graphy-guard (#585) : ${unknownAbbr.length} abréviation(s) INCONNUE(S) (zéro tolérance) :`)
    for (const { file, row, abbr, text } of unknownAbbr) console.log(`  ${file}:${row}  [${abbr}]  ${text}`)
  } else {
    console.log('citation-graphy-guard (#585) : 0 abréviation inconnue — classe verrouillée à zéro.')
  }

  if (multiFolioSplit.length) {
    console.log(`citation-graphy-guard (#522) : ${multiFolioSplit.length} multi-folio(s) à cheval sur un AUTRE chapitre (zéro tolérance) :`)
    for (const { file, row, folios, text } of multiFolioSplit) {
      const bad = folios.map((f) => `p.${f.folio}→ch${f.ch}`).join(', ')
      console.log(`  ${file}:${row}  [${bad}]  ${text}`)
    }
  } else {
    console.log('citation-graphy-guard (#522) : 0 multi-folio à cheval sur un autre chapitre — classe verrouillée à zéro.')
  }

  // (#454 juge adversarial) AVERTISSEMENT cliqueté, PAS bloquant à l'aveugle sur le stock existant :
  // un candidat structurel (dernier folio de N, N+1 s'ouvre sur X/X+1) n'est PAS une preuve verbatim
  // — le signal/bruit mesuré sur le repo entier est trop faible pour un zéro-tolérance (cas prouvé
  // unique `LDB 48 p.255` sur 48 candidats structurels du repo). Baseline = le stock ACTUEL exact
  // (`chapterBoundaryFolio` dans `graphy-baseline.json`) : toute HAUSSE ou péremption échoue quand
  // même (même mécanique de cliquet que chDot/bareFolio/bookNoChapterSrc), mais le stock gelé
  // lui-même ne fait PAS échouer le run — seule une dérive future le ferait.
  console.log(`citation-graphy-guard (#454) : ${chapterBoundaryFolio.violations.length} candidat(s) folio-en-fin-de-chapitre (AVERTISSEMENT, cliqueté, non bloquant sur le stock gelé) :`)
  for (const { file, row, abbr, ch, folio } of chapterBoundaryFolio.violations) {
    console.log(`  ${file}:${row}  [${abbr} ${ch} p.${folio}]`)
  }
  if (chapterBoundaryFolio.over.length) {
    baselineFail = true
    console.log(`  RÉGRESSION — hausse par fichier :`)
    for (const o of chapterBoundaryFolio.over) console.log(`    ${o}`)
  }
  if (chapterBoundaryFolio.stale.length) {
    baselineFail = true
    console.log(`  Baseline(s) PÉRIMÉE(s) (à ABAISSER dans graphy-baseline.json) :`)
    for (const s of chapterBoundaryFolio.stale) console.log(`    ${s}`)
  }

  if (src.length || docs.length || implProse.length || baselineFail || unknownAbbr.length || multiFolioSplit.length) process.exitCode = 1
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isMain) main()
