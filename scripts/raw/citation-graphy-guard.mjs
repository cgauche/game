// Garde de graphie des citations RAW (#487 lot 3, étendue #585 lot A, #454 DoD) — verrouille la
// classe « chapitre-relative » (zéro tolérance) et CLIQUETTE les dérives de graphie cosmétique
// (`ch.`, folio nu, réf sans chapitre) le temps de leur strip mécanique (lot B). Les familles
// `bareFolio`/`bookNoChapterSrc` couvrent `src/**` ET `docs/raw/*.md` (fiches scannées, même
// périmètre que `chDot` — #454).
// `NN-Nom l.X` (ex. `18-Traumatisme l.417-422`) : cette forme est INVISIBLE de `ldbRe`/`otherRe`
// (_lib.mjs — les deux exigent le livre AVANT le numéro de chapitre, jamais un nom de chapitre
// collé au numéro), donc jamais comptée par `reconcile.mjs`, jamais ré-ancrée. Forme canonique :
// `LDB NN l.X` (ou `<ABRÉV> NN l.X` pour les 14 autres livres) — sans nom de chapitre.
// Zéro tolérance, PAS de baseline (le stock doit être à 0 après le lot #487) : toute occurrence
// nouvelle ou survivante fait échouer le test avec la liste `fichier:ligne`.
// Re-run : node scripts/raw/citation-graphy-guard.mjs
import { join, dirname, resolve } from 'node:path'
import { listerArbre, listerDossier } from '../guards/lib/lister.mjs'
import { fileURLToPath } from 'node:url'
import { fieldBlockMask } from './build-implemente.mjs'
import { otherAbbrAlternation, bookOf, folioRange, chapterBoundaryRiskFor, RAWDOC_META_GENERATED, RAWDOC_AUTHOR_META, isRawEpreuve, readText } from './_lib.mjs'
import { ecartDuVolet, readStock as readStockFile } from './check-code-refs.mjs'

export const SRC_DIR = 'src'
export const EXTS = ['.ts', '.tsx', '.json']
export const RAWDIR = 'docs/raw'
export const STOCK_PATH = join(dirname(fileURLToPath(import.meta.url)), 'graphy-stock.json')

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

// --- PASSE UNIQUE : un corpus lu une fois, une itération par (fichier, ligne), tous les détecteurs
// nourris au passage. Chaque CLASSE est une fonction PURE d'une LIGNE vers ses occurrences
// (`detecte*`) ; chaque `scan*Violations` lit sa famille dans le résultat de la passe, qui est
// mémoïsé par clé (dossiers + extensions). Ce qui coûtait n'était pas l'I/O (~2 s) mais le RE-SCAN
// du même corpus par famille, sept fois (mesure #1709 D2 : 18,9 s pour 3 743 fichiers de `src/`).
// MÉMO : il porte le RÉSULTAT de la passe, pas le texte lu (`readCorpus`, scripts/guards/lib) ;
// même condition de licéité — l'arbre scanné est STATIQUE pendant un run (les gates écrivantes
// jouent en série avant les lectrices, `scripts/gates/toutes.mjs` `AVANT_LES_LANES`). Les familles
// rendues sont GELÉES, comme le corpus de `readCorpus` (`sourceCorpus.mjs:96,100`) : un `push`/`sort`
// d'appelant ne peut pas s'écrire dans le mémo.
// LECTEUR : la marche reste `listerArbre`/`listerDossier` et non `readCorpus`, parce que ce garde
// scanne des corpus que ce dernier ne sait pas dire — une base à 0 fichier (il la refuse, par base)
// et un arbre dont `node_modules` est exclu (il n'expose pas `descendre` ; le contrat est verrouillé
// par `citation-graphy-guard.test.mjs:79-89`).

/** Occurrences de la fabrique de RegExp `/g` dans `ln` (fabrique FRAÎCHE : état `lastIndex` jamais
 *  partagé d'une ligne à l'autre). Pur. */
const occurrences = (fabrique, ln) => { const re = fabrique(); let n = 0; while (re.exec(ln)) n++; return n }

/** Classe chapitre-relative (`GRAPHY_RE`) : la ligne porte-t-elle la graphie ? Pur. */
export const detecteGraphy = (ln) => GRAPHY_RE().test(ln)

/** Graphies de FICHE d'une ligne, dans l'ordre du rapport : (a) plage à tiret cadratin,
 *  (b) réf de livre sans chapitre, (c) nom de fichier de chapitre en backticks. Une occurrence AU
 *  PLUS par `kind` et par ligne. Pur. */
export function detecteFiche(ln) {
  const kinds = []
  if (EMDASH_RANGE_RE().test(ln)) kinds.push('emdash-range')
  if (BOOK_NO_CHAPTER_RE().test(ln)) kinds.push('book-no-chapter')
  if (BACKTICK_FILE_RE().test(ln)) kinds.push('backtick-file')
  return kinds
}

/** (d) Prose d'état d'implémentation (`NONIMPL_RE`) — la frontière du bloc de champ généré
 *  `**Implémente**` est portée par l'appelant (`fieldBlockMask`, source unique). Pur. */
export const detecteImplProse = (ln) => NONIMPL_RE().test(ln)

/** (e) `ch.` cosmétique : nombre d'occurrences de la ligne. Pur. */
export const detecteChDot = (ln) => occurrences(CH_DOT_RE, ln)

/** (f) Folio NU `<ABRÉV> p.X` : nombre d'occurrences. La mise en SCOPE de la ligne (commentaire en
 *  `.ts`/`.tsx`, champ `"ref"` en `.json`, toute ligne en fiche) est portée par l'appelant. Pur. */
export const detecteBareFolio = (ln) => occurrences(BARE_FOLIO_RE, ln)

/** (b) Réf de livre SANS chapitre `<ABRÉV> l.<n>` : nombre d'occurrences. Pur. */
export const detecteBookNoChapter = (ln) => occurrences(BOOK_NO_CHAPTER_RE, ln)

/** (g) Abréviations de la ligne INCONNUES de `_lib.mjs` (`bookOf` → null) : une abréviation hors
 *  `books.json` est une citation qui ne mène nulle part — zéro tolérance, pas de baseline. Pur. */
export function detecteUnknownAbbr(ln) {
  const abbrs = []
  const re = UNKNOWN_ABBR_RE()
  let m
  while ((m = re.exec(ln))) {
    const abbr = m[0].replace(/ \d+ [lp]\.\d+$/, '')
    if (!bookOf(abbr)) abbrs.push(abbr)
  }
  return abbrs
}

/** (h) Multi-folios de la ligne dont un folio RÉSOUT dans un chapitre différent du chapitre écrit.
 *  Un folio NON RÉSOLVABLE (`folioRange` → `null`/`'ambiguous'`, ancre absente — résidus #522) est
 *  INDÉTERMINÉ, jamais une violation (silence, pas de faux positif sur les trous de la ré-extraction
 *  Marker). Retourne `{ folios }[]` — une entrée par multi-folio fautif, `folios` = les folios
 *  fautifs avec leur chapitre résolu. Pur. */
export function detecteMultiFolioSplit(ln) {
  const hits = []
  const re = MULTI_FOLIO_RE()
  let m
  while ((m = re.exec(ln))) {
    const [, abbr, chStr, folioStr, suffix] = m
    const ch = Number(chStr)
    const extraFolios = (suffix.match(/\d+/g) || []).map(Number)
    const folios = []
    for (const folio of [Number(folioStr), ...extraFolios]) {
      const res = folioRange(abbr, folio)
      if (!res || res === 'ambiguous') continue // indéterminé, jamais une violation
      if (res.ch !== ch) folios.push({ folio, ch: res.ch })
    }
    if (folios.length) hits.push({ folios })
  }
  return hits
}

/** (i) Folios SIMPLES de la ligne cités au DERNIER folio de leur chapitre alors que le chapitre
 *  suivant s'ouvre sur X ou X+1 (`chapterBoundaryRiskFor`, _lib.mjs). Retourne
 *  `{ abbr, ch, folio }[]`. Pur. */
export function detecteChapterBoundary(ln) {
  const hits = []
  const re = CHAPTER_BOUNDARY_FOLIO_RE()
  let m
  while ((m = re.exec(ln))) {
    const [, abbr, chStr, folioStr] = m
    const ch = Number(chStr)
    const folio = Number(folioStr)
    if (chapterBoundaryRiskFor(abbr, ch, folio)) hits.push({ abbr, ch, folio })
  }
  return hits
}

function fichiersSources(dir, exts) {
  return listerArbre(dir, {
    descendre: (rel) => !rel.split('/').includes('node_modules'),
    filtre: (rel) => exts.some((x) => rel.endsWith(x)),
  }).map((rel) => join(dir, rel))
}

/** Fiches SCANNÉES de `rawDir` (hors rapports générés et épreuves), lues : `prose` dit si la fiche
 *  entre aussi au scan (d) (fiches d'auteur exclues, `RAWDOC_AUTHOR_META`). */
function fichesScannees(rawDir) {
  return listerDossier(rawDir, { absent: 'vide' }).filter(isScannedFiche).map((nom) => ({
    file: join(rawDir, nom).replace(/\\/g, '/'),
    prose: isImplProseScanned(nom),
    lignes: readText(join(rawDir, nom)).split('\n'),
  }))
}

const FAMILLES = ['graphy', 'docsRaw', 'implProse', 'chDot', 'bareFolio', 'bookNoChapterSrc', 'unknownAbbr', 'multiFolioSplit', 'chapterBoundaryFolio']
const vide = () => Object.fromEntries(FAMILLES.map((f) => [f, []]))
/** Gèle les neuf familles et leur porteur : ce que rend une passe est IMMUABLE. */
const geler = (familles) => {
  for (const f of FAMILLES) Object.freeze(familles[f])
  return Object.freeze(familles)
}
const MEMO = new Map()
const memoise = (cle, calcul) => {
  const vu = MEMO.get(cle)
  if (vu) return vu
  const fait = calcul()
  MEMO.set(cle, fait)
  return fait
}

/** Passe unique sur `src/**` : chaque fichier lu UNE fois, chaque ligne offerte à tous les
 *  détecteurs dont la classe couvre ce corpus. Les classes (f)/(h)/(i) ne voient que les lignes en
 *  SCOPE (commentaire en `.ts`/`.tsx`, champ `"ref"` en `.json` — une citation dans un titre de test
 *  `describe`/`it` n'est pas un commentaire ; les champs `desc`/prose sont verbatim source, règle 5,
 *  et `source:{book,page}` est la convention folio-imprimé, hors périmètre, #585). Pur. */
function passeSrc(srcDir, exts) {
  return memoise(JSON.stringify(['src', resolve(srcDir), exts]), () => {
    const out = vide()
    for (const f of fichiersSources(srcDir, exts)) {
      const file = f.replace(/\\/g, '/')
      const isJson = f.endsWith('.json')
      readText(f).split('\n').forEach((ln, i) => {
        const row = i + 1
        const text = ln.trim().slice(0, 160)
        if (detecteGraphy(ln)) out.graphy.push({ file, row, text })
        for (let n = detecteChDot(ln); n > 0; n--) out.chDot.push({ file, row, text })
        for (let n = detecteBookNoChapter(ln); n > 0; n--) out.bookNoChapterSrc.push({ file, row, text })
        for (const abbr of detecteUnknownAbbr(ln)) out.unknownAbbr.push({ file, row, abbr, text })
        if (!(isJson ? isRefFieldLine(ln) : isCommentLine(ln))) return
        for (let n = detecteBareFolio(ln); n > 0; n--) out.bareFolio.push({ file, row, text })
        for (const { folios } of detecteMultiFolioSplit(ln)) out.multiFolioSplit.push({ file, row, folios, text })
        for (const { abbr, ch, folio } of detecteChapterBoundary(ln)) out.chapterBoundaryFolio.push({ file, row, abbr, ch, folio, text })
      })
    }
    return geler(out)
  })
}

/** Passe unique sur les fiches `docs/raw/*.md` : TOUTE ligne est en scope (prose de citation, pas
 *  de notion de « commentaire ») ; seul le scan (d) masque le bloc de champ généré. Pur. */
function passeFiches(rawDir) {
  return memoise(JSON.stringify(['fiches', resolve(rawDir)]), () => {
    const out = vide()
    for (const { file, prose, lignes } of fichesScannees(rawDir)) {
      const inFieldBlock = prose ? fieldBlockMask(lignes).inFieldBlock : null
      lignes.forEach((ln, i) => {
        const row = i + 1
        const text = ln.trim().slice(0, 160)
        for (const kind of detecteFiche(ln)) out.docsRaw.push({ file, row, kind, text })
        if (prose && !inFieldBlock[i] && detecteImplProse(ln)) out.implProse.push({ file, row, text })
        for (let n = detecteChDot(ln); n > 0; n--) out.chDot.push({ file, row, text })
        for (let n = detecteBareFolio(ln); n > 0; n--) out.bareFolio.push({ file, row, text })
        for (let n = detecteBookNoChapter(ln); n > 0; n--) out.bookNoChapterSrc.push({ file, row, text })
        for (const abbr of detecteUnknownAbbr(ln)) out.unknownAbbr.push({ file, row, abbr, text })
        for (const { abbr, ch, folio } of detecteChapterBoundary(ln)) out.chapterBoundaryFolio.push({ file, row, abbr, ch, folio, text })
      })
    }
    return geler(out)
  })
}

/** Les neuf familles du garde, corpus `src/**` PUIS fiches `docs/raw/*.md` (l'ordre des deux passes
 *  décide de l'ordre du rapport). Pur (aucune écriture). */
export function scanTout(srcDir = SRC_DIR, exts = EXTS, rawDir = RAWDIR) {
  const src = passeSrc(srcDir, exts)
  const fiches = passeFiches(rawDir)
  return geler(Object.fromEntries(FAMILLES.map((f) => [f, [...src[f], ...fiches[f]]])))
}

/** Scan (h) : multi-folios à cheval sur des chapitres différents (#522 juge adversarial) — `src/**`
 *  (.ts/.tsx/.json), lignes en scope (commentaire / champ `"ref"`). Forme canonique : deux réfs
 *  séparées (`ABRÉV NN p.X / ABRÉV MM p.Y`). Retourne `{ file, row, folios, text }[]`. */
export function scanMultiFolioSplitViolations(srcDir = SRC_DIR, exts = EXTS) {
  return passeSrc(srcDir, exts).multiFolioSplit
}

/** Scan (i) : folio simple `<ABRÉV> N p.X` au DERNIER folio du chapitre N, chapitre N+1 s'ouvrant
 *  sur X/X+1 (#454 juge adversarial). Même périmètre que (h) en `src/**`, ET `docs/raw/*.md` (fiches
 *  scannées, patron `chDot`/`bareFolio`). AVERTISSEMENT cliqueté (non bloquant sur le stock EXISTANT,
 *  cf. `main()`) — un candidat structurel n'est PAS une preuve verbatim.
 *  Retourne `{ file, row, abbr, ch, folio, text }[]`. */
export function scanChapterBoundaryFolioViolations(srcDir = SRC_DIR, exts = EXTS, rawDir = RAWDIR) {
  return scanTout(srcDir, exts, rawDir).chapterBoundaryFolio
}

/** Scan (a′) : graphie chapitre-relative de `srcDir` (défaut `src/`). Retourne `{ file, row, text }[]`
 *  — `text` = la ligne tronquée (160c) pour le diagnostic. */
export function scanGraphyViolations(srcDir = SRC_DIR, exts = EXTS) {
  return passeSrc(srcDir, exts).graphy
}

/** Scans (a)/(b)/(c) des fiches `docs/raw/*.md` (hors rapports/épreuves) : plage à tiret cadratin,
 *  réf de livre sans chapitre, nom de fichier de chapitre en backticks. Retourne
 *  `{ file, row, kind, text }[]` (`kind` ∈ `emdash-range` | `book-no-chapter` | `backtick-file`). */
export function scanDocsRawViolations(rawDir = RAWDIR) {
  return passeFiches(rawDir).docsRaw
}

/** Scan (d) : prose d'état d'implémentation des fiches (hors rapports/épreuves, hors fiches
 *  d'auteur), HORS bloc de champ généré `**Implémente**`. Retourne `{ file, row, text }[]`. */
export function scanImplProseViolations(rawDir = RAWDIR) {
  return passeFiches(rawDir).implProse
}

/** Scan (e) : `ch.` cosmétique — src/** (.ts/.tsx/.json) ET docs/raw/*.md (mêmes fiches que (b)/(c)).
 *  Retourne `{ file, row, text }[]`, UNE entrée par OCCURRENCE — cliquet par SITE (cf. `ecartDuVolet`). */
export function scanChDotViolations(srcDir = SRC_DIR, exts = EXTS, rawDir = RAWDIR) {
  return scanTout(srcDir, exts, rawDir).chDot
}

/** Scan (f) : folio NU `<ABRÉV> p.X` sans chapitre (chapitre absent → invérifiable contre les
 *  data-folio bakés) — lignes en scope de `src/**`, toute ligne des fiches scannées.
 *  Retourne `{ file, row, text }[]`. */
export function scanBareFolioViolations(srcDir = SRC_DIR, exts = EXTS, rawDir = RAWDIR) {
  return scanTout(srcDir, exts, rawDir).bareFolio
}

/** Scan (b) étendu à src/** ET docs/raw/*.md (fiches scannées, patron `chDot`) — réf de livre sans
 *  chapitre `<ABRÉV> l.<n>` (`BOOK_NO_CHAPTER_RE`). Retourne `{ file, row, text }[]`. */
export function scanBookNoChapterSrcViolations(srcDir = SRC_DIR, exts = EXTS, rawDir = RAWDIR) {
  return scanTout(srcDir, exts, rawDir).bookNoChapterSrc
}

/** Scan (g) : réf `ABRÉV NN l.X`/`ABRÉV NN p.X` dont l'abréviation est INCONNUE de `_lib.mjs`
 *  (`bookOf` retourne null). Zéro tolérance, PAS de baseline. Retourne `{ file, row, abbr, text }[]`. */
export function scanUnknownAbbrViolations(srcDir = SRC_DIR, exts = EXTS, rawDir = RAWDIR) {
  return scanTout(srcDir, exts, rawDir).unknownAbbr
}

/** Les ENTRÉES de `graphy-stock.json` (fichier absent, ou stock vide : aucune entrée). La FAMILLE
 *  est un champ de l'entrée, jamais une rubrique : un seul stock, une seule forme, et la porte de
 *  plage compte une ligne ajoutée où qu'elle tombe. */
export function readStock(path = STOCK_PATH) {
  return readStockFile(path)
}

/** RÉF NOMINATIVE d'un site, par famille : ce qui identifie la citation fautive indépendamment de sa
 *  ligne. Les familles de graphie n'ont que le TEXTE de la citation ; la famille folio-en-fin-de-
 *  chapitre porte la réf elle-même. */
const REF_DU_SITE = {
  chDot: (v) => v.text.trim(),
  bareFolio: (v) => v.text.trim(),
  bookNoChapterSrc: (v) => v.text.trim(),
  chapterBoundaryFolio: (v) => `${v.abbr} ${v.ch} p.${v.folio}`,
}

// Écart d'une famille à son stock — les deux sens échouent (site neuf, entrée soldée). Le stock est
// filtré sur la famille : la clé la porte, l'écart ne juge que les entrées qui la nomment.
function checkFamily(label, family, violations, stock) {
  const { neuves, perimees } = ecartDuVolet({
    sites: violations.map((v) => ({ file: v.file, ref: REF_DU_SITE[family](v) })),
    stock: stock.filter((e) => e.famille === family),
    famille: family,
    ou: 'graphy-stock.json',
  })
  return { label, family, violations, neuves, perimees }
}

function main() {
  const passe = scanTout()
  const src = passe.graphy
  const docs = passe.docsRaw
  const implProse = passe.implProse
  const stock = readStock()
  const chDot = checkFamily('ch. cosmétique', 'chDot', passe.chDot, stock)
  const bareFolio = checkFamily('folio nu', 'bareFolio', passe.bareFolio, stock)
  const bookNoChapterSrc = checkFamily('réf sans chapitre (src+docs/raw)', 'bookNoChapterSrc', passe.bookNoChapterSrc, stock)
  const unknownAbbr = passe.unknownAbbr
  const multiFolioSplit = passe.multiFolioSplit
  const chapterBoundaryFolio = checkFamily('folio en fin de chapitre (AVERTISSEMENT)', 'chapterBoundaryFolio', passe.chapterBoundaryFolio, stock)

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

  let stockFail = false
  for (const { label, violations, neuves, perimees } of [chDot, bareFolio, bookNoChapterSrc]) {
    console.log(`citation-graphy-guard (#585) : ${label} — ${violations.length} site(s) mesuré(s).`)
    if (neuves.length) {
      stockFail = true
      console.log(`  RÉGRESSION — site(s) hors du stock :`)
      for (const o of neuves) console.log(`    ${o}`)
    }
    if (perimees.length) {
      stockFail = true
      console.log(`  Entrée(s) SOLDÉE(s) :`)
      for (const s of perimees) console.log(`    ${s}`)
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
  // unique `LDB 48 p.255` sur 48 candidats structurels du repo). Stock = les sites ACTUELS exacts
  // (entrées `chapterBoundaryFolio` de `graphy-stock.json`) : un site NEUF ou une entrée SOLDÉE
  // échoue quand même (même mécanique de cliquet que chDot/bareFolio/bookNoChapterSrc), mais les
  // sites déjà déclarés ne font PAS échouer le run — seule une dérive future le ferait.
  console.log(`citation-graphy-guard (#454) : ${chapterBoundaryFolio.violations.length} candidat(s) folio-en-fin-de-chapitre (AVERTISSEMENT, cliqueté, non bloquant sur les sites déclarés) :`)
  for (const { file, row, abbr, ch, folio } of chapterBoundaryFolio.violations) {
    console.log(`  ${file}:${row}  [${abbr} ${ch} p.${folio}]`)
  }
  if (chapterBoundaryFolio.neuves.length) {
    stockFail = true
    console.log(`  RÉGRESSION — site(s) hors du stock :`)
    for (const o of chapterBoundaryFolio.neuves) console.log(`    ${o}`)
  }
  if (chapterBoundaryFolio.perimees.length) {
    stockFail = true
    console.log(`  Entrée(s) SOLDÉE(s) :`)
    for (const s of chapterBoundaryFolio.perimees) console.log(`    ${s}`)
  }

  if (src.length || docs.length || implProse.length || stockFail || unknownAbbr.length || multiFolioSplit.length) process.exitCode = 1
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isMain) main()
