// Garde de continuité des folios extraits (#397, item conditionnel du DoD « garde de complétude
// d'ancres si exprimable »). Chaque fichier `.md` de `Source/**` porte des ancres
// `<span id="page-N-0" data-folio="M"></span>` posées par l'extraction Marker. Le défaut #397
// (folios 235-236 sans ancre dans LDB 46) était INVISIBLE : rien ne vérifiait la CONTINUITÉ de la
// séquence des `data-folio`. Dans un fichier donné, la séquence doit être STRICTEMENT CROISSANTE
// ET CONSÉCUTIVE (delta 1) — tout delta ≠ 1 est un saut : une ou plusieurs pages n'ont reçu aucune
// ancre lors de l'extraction. La séquence seule est AVEUGLE à ses extrémités : un folio manquant
// APRÈS la dernière ancre du fichier ne casse aucun delta (VDM 15, folio 224). Second volet donc
// (`kind:'fin'`, cf. `scanBookDir`) : la plage attendue vient de l'en-tête `*Pages PDF N[-M]*`, et
// le manque se mesure au niveau du LIVRE — un folio de fin ancré dans le chapitre suivant est une
// page partagée, pas un trou.
// SECONDE PASSE sur le même parcours (#1457) : une séquence peut être parfaitement consécutive et
// la page tout de même PERDUE — deux ancres adjacentes sans un octet utile entre elles (LDB 08,
// folios 88/89 collés : la carrière de Juriste manque). Cf. `emptyFolioAnchorsInText` et son stock
// nominatif trié au PDF `empty-folios-baseline.json` (généré par `lib/empty-folios-stock.mjs`).
// Cliquet PAR fichier-chapitre (`scripts/raw/folio-gaps-baseline.json`, patron `check-refs.mjs`/
// `dead-refs-baseline.json`) : le stock déjà présent (mesuré, pas 0) est GELÉ — toute HAUSSE
// échoue ; une baseline devenue trop haute (extraction réparée) doit être ABAISSÉE.
// Re-run : node scripts/raw/check-folio-continuity.mjs
import { readFileSync } from 'node:fs'
import { listerDossier } from '../guards/lib/lister.mjs'
import { join, dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { BOOKS, readText } from './_lib.mjs'
import { countsByChapterRef, assertAgainstBaseline } from './check-refs.mjs'

export const BASELINE_PATH = join(dirname(fileURLToPath(import.meta.url)), 'folio-gaps-baseline.json')
export const EMPTY_STOCK_PATH = join(dirname(fileURLToPath(import.meta.url)), 'empty-folios-baseline.json')
const CHAPTER_FILE_RE = /^(\d+) - .*\.md$/
const HEADER_RE = /^\*Pages PDF (\d+)(?:-(\d+))?\*/
const ANCHOR_RE = /id="page-(\d+)-0" data-folio="(-?\d+)"/g

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

// Plage de folios ATTENDUE d'un chapitre + son dernier folio ancré (PUR). L'en-tête `*Pages PDF
// N[-M]*` (pages humaines 1-based) se convertit en folios via l'offset K−folio lu sur les ancres du
// fichier LUI-MÊME. `null` = pas d'en-tête, pas d'ancre, ou offset non unique (rien à conclure).
export function chapterFolioSpan(text) {
  const m = HEADER_RE.exec(text.split('\n')[0] || '')
  if (!m) return null
  const anchors = [...text.matchAll(new RegExp(ANCHOR_RE))].map((a) => ({ k: Number(a[1]), folio: Number(a[2]) }))
  if (!anchors.length) return null
  const offsets = new Set(anchors.map((a) => a.k - a.folio))
  if (offsets.size !== 1) return null
  const offset = [...offsets][0]
  const expectedHi = (Number(m[2] ?? m[1]) - 1) - offset
  return { expectedHi, last: Math.max(...anchors.map((a) => a.folio)) }
}

// Fichiers-chapitre `NN - *.md` d'un dossier de livre, triés, avec leur texte. HELPER de lecture
// partagé par les deux passes de l'instrument (sauts de séquence ET ancres sans contenu) : chacune
// l'appelle pour son propre compte, le corpus est donc lu DEUX fois par exécution du CLI (312
// fichiers, coût mesuré négligeable devant la CI). Dossier introuvable → Map vide (hors sujet).
export function chapterTexts(dir) {
  const files = listerDossier(dir, { absent: 'vide' }).filter((f) => CHAPTER_FILE_RE.test(f))
  return new Map(files.map((f) => [f, readText(join(dir, f))]))
}

// Balaie un dossier de livre (fichiers `NN - *.md`) → `[{ abbr, nn, file, from, to, delta, kind, ref }]`.
// `ref` = clé du cliquet (`ABBR NN`, patron `check-refs.mjs`). Deux familles :
//   `kind:'saut'` — trou ENTRE deux ancres du fichier (`folioGapsInText`) ;
//   `kind:'fin'`  — folios attendus APRÈS la dernière ancre du fichier, et ancrés NULLE PART dans le
//                   livre. Un folio de fin ancré dans le fichier SUIVANT est une page partagée entre
//                   deux chapitres (le split Marker suit les titres, pas les pages), pas un trou :
//                   la mesure se fait donc au niveau du LIVRE. Sans ce volet, un folio manquant en
//                   fin de fichier échappait au cliquet (VDM 15, folio 224).
export function scanBookDir(abbr, dir) {
  const texts = chapterTexts(dir)
  const files = [...texts.keys()]
  const bookFolios = new Set()
  for (const text of texts.values()) for (const m of text.matchAll(/data-folio="(\d+)"/g)) bookFolios.add(Number(m[1]))
  const out = []
  for (const file of files) {
    const nn = Number(file.match(CHAPTER_FILE_RE)[1])
    const text = texts.get(file)
    const ref = `${abbr} ${nn}`
    for (const gap of folioGapsInText(text)) out.push({ abbr, nn, file, ...gap, kind: 'saut', ref })
    const span = chapterFolioSpan(text)
    if (!span) continue
    const orphans = []
    for (let f = span.last + 1; f <= span.expectedHi; f++) if (!bookFolios.has(f)) orphans.push(f)
    if (orphans.length) out.push({ abbr, nn, file, from: span.last, to: orphans[orphans.length - 1], delta: orphans.length, kind: 'fin', ref })
  }
  return out
}

/** Balaie tous les livres de `books` (BOOKS par défaut) → sauts de folios agrégés. */
export function scanAllBooks(books = BOOKS) {
  const out = []
  for (const [abbr, dir] of books) out.push(...scanBookDir(abbr, dir))
  return out
}

// ---------- passe 2 : ancre SANS CONTENU (#1457 lot A1) ----------
// La séquence peut être parfaitement consécutive et la PAGE tout de même perdue : deux ancres
// `data-folio` ADJACENTES sans un octet utile entre elles (87→88→89, delta 1 partout, mais la page
// 88 n'a aucun texte). C'est la vérité citable de `Source/` qui manque, invisible à la passe 1.
// Contenu UTILE = tout ce qui n'est ni une ancre, ni un blanc (espaces, sauts, insécables, largeur
// nulle) : le stock mesuré montre que la perte se présente aussi bien collée (LDB 08, 0 octet) que
// séparée par des blancs seuls.
// PÉRIMÈTRE : seules les PAIRES d'ancres d'un MÊME fichier sont jugées ; la dernière ancre d'un
// fichier est donc hors mesure. Mesuré sur le corpus (2026-09-01) : 86 folios vides-au-livre sont
// dans ce cas, 83 sont repris par la tête du chapitre suivant (page partagée, rien à signaler).
// ANGLE MORT vrai : les 3 restants sont la dernière ancre du DERNIER fichier de leur livre, sans
// repreneur possible — AA folio 144, ZI folio 144, MDG folio 160, mesurés SANS contenu utile au PDF
// (cf. le test qui les nomme). Toute fin de livre qui deviendrait porteuse échapperait à la garde.
// `\s` couvre deja insecables et BOM en JS ; la largeur nulle U+200B, non.
const BLANKS_RE = /[\s\u200B]+/g
const ANCHOR_SPAN_RE = /<span[^>]*data-folio="(-?\d+)"[^>]*>\s*<\/span>/g

/** `[{ folio, line }]` : folios dont la page n'a AUCUN contenu utile dans le texte (PUR). */
export function emptyFolioAnchorsInText(text) {
  const anchors = [...text.matchAll(new RegExp(ANCHOR_SPAN_RE))]
  const out = []
  for (let i = 1; i < anchors.length; i++) {
    const prev = anchors[i - 1]
    const between = text.slice(prev.index + prev[0].length, anchors[i].index)
    if (between.replace(BLANKS_RE, '') !== '') continue
    out.push({
      folio: Number(prev[1]),
      line: text.slice(0, prev.index).split('\n').length,
    })
  }
  return out
}

/** Balaie un dossier de livre → `[{ abbr, nn, file, ref, folio, line }]`. */
export function scanEmptyFoliosInBook(abbr, dir) {
  const out = []
  for (const [file, text] of chapterTexts(dir)) {
    const nn = Number(file.match(CHAPTER_FILE_RE)[1])
    for (const e of emptyFolioAnchorsInText(text)) out.push({ abbr, nn, file, ref: `${abbr} ${nn}`, ...e })
  }
  return out
}

/** Balaie tous les livres de `books` (BOOKS par défaut) → ancres sans contenu agrégées. */
export function scanAllEmptyFolios(books = BOOKS) {
  const out = []
  for (const [abbr, dir] of books) out.push(...scanEmptyFoliosInBook(abbr, dir))
  return out
}

/** Clé d'un FAIT du stock : livre-chapitre + fichier + folio (jamais la ligne, qui dérive). */
export const emptyFolioKey = (e) => `${e.ref}|${e.file}|${e.folio}`

// Confronte les ancres sans contenu MESURÉES au stock trié `empty-folios-baseline.json`
// (`{ seuil, perdues, benignes }`, tri fait par la mesure PDF de `lib/empty-folios-stock.mjs`,
// jamais à la main). Quatre anomalies : `inconnues` (mesurée, absente du stock — à trier au PDF),
// `restituees` (page perdue revenue au `.md` → l'entrée se SUPPRIME, le stock décroît),
// `benignesDisparues` (l'ancre bénigne n'est plus adjacente à du vide → entrée périmée), et
// `malClassees` : le `pdfChars` porté par l'entrée ne s'accorde pas à sa classe au regard de
// `stock.seuil` (perdue ⇔ `pdfChars > seuil`). Sans ce dernier volet, déplacer une entrée de
// `perdues` vers `benignes` — ou regarnir le stock avec un `--seuil` complaisant — faisait baisser
// le compte des PERDUES sans un mot : le seuil écrit dans le JSON n'était lu par personne.
// Une entrée dont le `pdfChars` (ou le `seuil` du stock) n'est pas un nombre est INAUDITABLE, donc
// mal classée : c'est le même contournement par une autre porte.
// La restitution des entrées encore au stock (les folios ≤ 1, tous dans `00 - Index.md` : pages de
// garde et sommaires) est prioritée à #1622.
export function assertEmptyFoliosAgainstStock(measured, stock) {
  const byKey = new Map(measured.map((e) => [emptyFolioKey(e), e]))
  const known = new Map()
  for (const cls of ['perdues', 'benignes']) for (const e of stock[cls] ?? []) known.set(emptyFolioKey(e), { cls, e })
  const inconnues = measured.filter((e) => !known.has(emptyFolioKey(e)))
  const restituees = []
  const benignesDisparues = []
  const malClassees = []
  const seuil = stock.seuil
  for (const [key, { cls, e }] of known) {
    const auditable = typeof seuil === 'number' && typeof e.pdfChars === 'number'
    if (!auditable || (e.pdfChars > seuil) !== (cls === 'perdues')) malClassees.push({ ...e, cls, seuil })
    if (byKey.has(key)) continue
    ;(cls === 'perdues' ? restituees : benignesDisparues).push(e)
  }
  return { inconnues, restituees, benignesDisparues, malClassees }
}

// Passe 1 — séquence de folios (cliquet par chapitre-réf). Retourne `true` si anomalie.
function reportGaps() {
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
    return false
  }
  console.log('Détail (fichier — saut de folio N→M, ou folios de fin sans ancre dans le livre) :')
  for (const g of gaps) {
    const what = g.kind === 'fin'
      ? `folios ${g.from + 1}–${g.to} attendus après la dernière ancre (folio ${g.from}), ancrés nulle part dans le livre`
      : `folio ${g.from} → ${g.to} (Δ${g.delta})`
    console.log(`${g.abbr} ${String(g.nn).padStart(2, '0')} (${g.file}) — ${what}`)
  }
  return true
}

// Passe 2 — ancres sans contenu (stock nominatif trié). Retourne `true` si anomalie.
function reportEmptyFolios() {
  const measured = scanAllEmptyFolios()
  const stock = JSON.parse(readFileSync(EMPTY_STOCK_PATH, 'utf8'))
  const { inconnues, restituees, benignesDisparues, malClassees } = assertEmptyFoliosAgainstStock(measured, stock)
  const perdues = stock.perdues ?? []

  console.log(`ancres sans contenu (page vide entre deux ancres) : ${measured.length} mesurée(s) — stock : ${perdues.length} PERDUE(s) au PDF, ${(stock.benignes ?? []).length} bénigne(s)`)
  const situe = (e) => `${e.ref} (${e.file}) — folio ${e.folio}${e.line ? ` l.${e.line}` : ''}`

  if (inconnues.length) {
    console.log('RÉGRESSION — ancre sans contenu ABSENTE du stock (à trier au PDF : node scripts/raw/lib/empty-folios-stock.mjs) :')
    for (const e of inconnues) console.log(`  ${situe(e)}`)
  }
  if (restituees.length) {
    console.log('Stock PÉRIMÉ — page restituée dans le .md : SUPPRIMER l\'entrée de empty-folios-baseline.json :')
    for (const e of restituees) console.log(`  ${situe(e)}`)
  }
  if (benignesDisparues.length) {
    console.log('Stock PÉRIMÉ — entrée bénigne sans mesure correspondante : SUPPRIMER de empty-folios-baseline.json :')
    for (const e of benignesDisparues) console.log(`  ${situe(e)}`)
  }
  if (malClassees.length) {
    console.log(`Stock INCOHÉRENT — classement démenti par le pdfChars mesuré (seuil ${stock.seuil}) :`)
    for (const e of malClassees) console.log(`  ${situe(e)} — classée ${e.cls}, ${e.pdfChars} car. utiles au PDF`)
  }
  if (!inconnues.length && !restituees.length && !benignesDisparues.length && !malClassees.length) {
    console.log('OK — stock aligné, aucune régression.')
    return false
  }
  return true
}

function main() {
  const koGaps = reportGaps()
  const koEmpty = reportEmptyFolios()
  if (koGaps || koEmpty) process.exitCode = 1
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isMain) main()
