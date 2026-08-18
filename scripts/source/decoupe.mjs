// Bibliothèque de DÉCOUPE des chapitres `Source/` (spike #découpe) : SOURCE UNIQUE du parsing.
// Une découpe = une adresse stable dans un chapitre — { book, ch, sec, secOcc, b0, b1 } — qui rend
// la prose VERBATIM du livre sans la dupliquer ailleurs. Sa sœur, l'adresse de CELLULE —
// { book, ch, sec, secOcc, row, col } — rend une case de table par CLÉ (jamais par indice).
// Deux consommateurs : la CLI ci-dessous et `derive-decoupes.mjs` (qui ne reparse RIEN par lui-même).
//
// CONVENTIONS DE PARSING, mesurées sur l'extraction Marker réelle :
//  - HEADINGS : seuls les headings ATX (`#`..`######`) ouvrent une section. Les lignes en gras seul
//    (`**Agitateur – Bronze 2**`) NE sont PAS traitées comme des headings : mesure sur le livre de
//    base — `16 - États.md`, `21 - Psychologie.md`, `10 - Talents.md` en comptent 0 ; `08 - Statut.md`
//    en compte 44 pour 282 headings ATX, et il s'agit de noms de niveau de carrière ouvrant un
//    paragraphe, pas de titres de rubrique. Les prendre pour des headings fragmenterait les sections
//    sans gain d'adressage (les blocs, eux, restent identiques).
//  - Un heading peut être précédé sur SA ligne d'un marqueur de folio
//    (`<span id="page-169-0" data-folio="168"></span>### **Brisé**`, `16 - États.md:59`).
//  - SLUG : translittéré ASCII (accents retirés) — un slug se tape en ligne de commande et se pose
//    dans un JSON ; `occ` (rang 1-based parmi les slugs identiques du chapitre) lève l'ambiguïté des
//    titres répétés (« Évolution de Carrière » ×31 dans `08 - Statut.md`).
//  - BLOCS : segments séparés par une ou plusieurs lignes vides ; le heading lui-même n'est pas un
//    bloc. Les balises `<span …>` sont retirées du texte rendu, leur `data-folio` est collecté.
//  - FOLIO COURANT : les marqueurs `data-folio` sont rares et arbitrairement placés dans le flux ; un
//    état ROULANT sur le chapitre donne à chaque section et à chaque bloc le dernier folio rencontré
//    à ou avant son ouverture (`folio`), en plus des marqueurs INTERNES au bloc (`folios`).
//  - RECOLLAGE DE FOLIO : un saut de folio coupe des paragraphes en plein milieu (`21 - Psychologie.md:45-48`,
//    `05 - _gjdgxs.md:44`). Deux blocs séparés par une coupure PORTEUSE DE FOLIO (bloc vide réduit à
//    son marqueur, ou bloc suivant ouvert par un marqueur) sont recollés par une espace quand le bloc
//    précédent ne finit pas par une ponctuation finale (`.!?»”:;`) — testée SOUS l'habillage markdown,
//    un `…une autre.*` fermant une emphase étant bel et bien terminé (`05 - _gjdgxs.md:438`) — et que
//    le bloc suivant n'ouvre pas un paragraphe logique (emphase `*`/`**`, puce, table).
import { readdirSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { BOOKS, chapterFile, readText, normalize as normalizeCitation } from '../raw/_lib.mjs'
import booksData from '../../src/data/books.json' with { type: 'json' }

/** `books.json.id` → sigle Atlas, restreint aux livres porteurs d'un `dir` (extraction FR présente). */
export const ABBR_BY_BOOK_ID = Object.fromEntries(
  booksData.filter((b) => b.dir).map((b) => [b.id, b.abbr]),
)
const DIR_BY_ABBR = new Map(BOOKS)

const SPAN_TAG = /<\/?span[^>]*>/g
const FOLIO_ATTR = /data-folio="(\d+)"/g
const HEADING = /^(?:<span[^>]*>\s*<\/span>\s*)*(#{1,6})\s+(.*)$/
const OPENS_ON_FOLIO = /^\s*<span[^>]*data-folio=/
const TERMINAL = /[.!?»”:;]$/
const TRAILING_DECOR = /[*_`~\s]+$/
const OPENS_EMPHASIS = /^\s*\*/
const TABLE_LINE = /^\s*\|/
const BULLET = /^\s*(?:[-*•]|\d+[.)])\s/
/** Clé de ligne de table trop positionnelle pour adresser (fourchette d100, numéro nu). */
const RANGE_KEY = /^\d+\s*[-–—]?\s*\d*$/

/** Retire les balises `<span>` (le contenu textuel est conservé). @param {string} s @returns {string} */
const stripSpans = (s) => s.replace(SPAN_TAG, '')

/** Folios (`data-folio`) portés par un fragment, dans l'ordre. @param {string} s @returns {number[]} */
function foliosIn(s) {
  const out = []
  for (const m of s.matchAll(FOLIO_ATTR)) out.push(Number(m[1]))
  return out
}

/** Titre affichable d'un heading : markdown d'emphase et `#` de fermeture retirés. */
const cleanTitle = (s) => stripSpans(s).replace(/#+\s*$/, '').replace(/[*_`]/g, '').trim()

/** Slugifie un titre : minuscules, accents TRANSLITTÉRÉS, tout le reste en tirets. */
function slugify(title) {
  return cleanTitle(title)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/**
 * Normalisation de COMPARAISON (verbatim tolérant à l'habillage) : délègue au normaliseur de
 * citations de l'Atlas (`_lib.normalize` : emphase, guillemets, apostrophes, tirets, casse, espaces
 * insécables, accents CONSERVÉS) après retrait des balises `<span>`, puis aplatit la ponctuation de
 * table (espaces autour des `|`, tirets de la ligne de séparation).
 * @param {string} s @returns {string}
 */
export function normText(s) {
  return normalizeCitation(stripSpans(s))
    .replace(/\s*\|\s*/g, '|')
    .replace(/-{2,}/g, '-')
    .trim()
}

/**
 * Joint des fragments DÉJÀ normalisés en une chaîne comparable : l'espace de jointure est réabsorbé
 * autour des `|` de table (`normText` colle déjà les cellules, un bloc-table recollé à la prose qui
 * le précède ne doit pas rouvrir cet espace).
 * @param {string[]} parts @returns {string}
 */
export const joinNorm = (parts) => parts.filter(Boolean).join(' ').replace(/\s*\|\s*/g, '|')

/**
 * Empreinte d'un texte résolu — helper UNIQUE : sha1 du texte NORMALISÉ, tronqué à 12 hex. Portée par
 * chaque ref émise (`sum`), vérifiée à la résolution : une source ré-extraite qui bouge sous une
 * adresse se signale au lieu de rendre un autre texte.
 * @param {string} md @returns {string}
 */
export const sumOf = (md) => createHash('sha1').update(normText(md)).digest('hex').slice(0, 12)

/** Deux blocs coupés par un saut de folio sont-ils recollables ? @returns {boolean} */
function recollable(prev, next) {
  if (TERMINAL.test(prev.replace(TRAILING_DECOR, ''))) return false
  if (TABLE_LINE.test(prev.split('\n').pop())) return false
  if (TABLE_LINE.test(next) || OPENS_EMPHASIS.test(next) || BULLET.test(next)) return false
  return true
}

/**
 * Découpe un corps de section en blocs d'affichage (spans retirés, folios collectés, recollage des
 * paragraphes coupés par un saut de folio).
 * @param {string[]} lines @param {number|null} folioIn folio courant à l'ouverture de la section
 * @returns {{ blocks: { md: string, folio: number|null, folios: number[] }[], folioOut: number|null }}
 */
function toBlocks(lines, folioIn) {
  const raw = []
  let cur = []
  for (const l of lines) {
    if (l.trim() === '') { if (cur.length) { raw.push(cur.join('\n')); cur = [] } } else cur.push(l)
  }
  if (cur.length) raw.push(cur.join('\n'))

  const out = []
  let running = folioIn
  let carry = []
  let carryCut = false
  for (const text of raw) {
    const folios = foliosIn(text)
    const md = stripSpans(text).trim()
    const at = carry.length ? carry[carry.length - 1]
      : (OPENS_ON_FOLIO.test(text) && folios.length ? folios[0] : running)
    if (folios.length) running = folios[folios.length - 1]
    if (!md) { carry.push(...folios); carryCut = true; continue }
    const cut = carryCut || OPENS_ON_FOLIO.test(text)
    const blockFolios = [...carry, ...folios]
    carry = []; carryCut = false
    const prev = out[out.length - 1]
    if (prev && cut && recollable(prev.md, md)) {
      prev.md = `${prev.md} ${md}`
      prev.folios.push(...blockFolios)
    } else {
      out.push({ md, folio: at ?? null, folios: blockFolios })
    }
  }
  return { blocks: out, folioOut: running }
}

/**
 * Parse un chapitre en sections adressables, folio courant roulant compris.
 * @param {string} text contenu markdown du chapitre (lu par `readText`, donc en LF)
 * @returns {{ sections: { slug: string, occ: number, title: string, level: number, line: number,
 *             folio: number|null, blocks: { md: string, folio: number|null, folios: number[] }[] }[] }}
 */
function parseChapter(text) {
  const lines = text.split('\n')
  const sections = []
  const seen = new Map()
  let running = null
  let cur = { slug: '', occ: 1, title: '', level: 0, line: 1, folio: null, lines: [] }
  const push = () => {
    const { lines: body, ...rest } = cur
    const { blocks, folioOut } = toBlocks(body, cur.folio)
    sections.push({ ...rest, blocks })
    running = folioOut
  }
  for (let i = 0; i < lines.length; i++) {
    const m = HEADING.exec(lines[i])
    if (!m) { cur.lines.push(lines[i]); continue }
    push()
    const title = cleanTitle(m[2])
    const slug = slugify(m[2]) || '-'
    const occ = (seen.get(slug) ?? 0) + 1
    seen.set(slug, occ)
    const head = foliosIn(lines[i])
    if (head.length) running = head[head.length - 1]
    cur = { slug, occ, title, level: m[1].length, line: i + 1, folio: running, lines: [] }
  }
  push()
  return { sections }
}

const _chapterCache = new Map()

/** Numéros de chapitre (`NN`) d'un livre, triés. @param {string} book id `books.json` @returns {string[]} */
export function chaptersOf(book) {
  const dir = DIR_BY_ABBR.get(ABBR_BY_BOOK_ID[book])
  if (!dir) return []
  return readdirSync(dir)
    .map((f) => /^(\d{2}) - .+\.md$/.exec(f))
    .filter(Boolean)
    .map((m) => m[1])
    .sort()
}

/**
 * Chapitre parsé (avec cache) — ou `null` si le livre ou le fichier n'existe pas.
 * @param {string} book @param {string|number} ch
 * @returns {{ file: string, sections: ReturnType<typeof parseChapter>['sections'] } | null}
 */
export function chapterIndex(book, ch) {
  const key = `${book}|${ch}`
  if (_chapterCache.has(key)) return _chapterCache.get(key)
  const abbr = ABBR_BY_BOOK_ID[book]
  const res = abbr ? chapterFile(abbr, ch) : null
  const out = res ? { file: res.file, sections: parseChapter(readText(res.path)).sections } : null
  _chapterCache.set(key, out)
  return out
}

/** Section visée par une adresse, ou l'erreur structurée qui l'en empêche. */
function locate({ book, ch, sec = '', secOcc = 1 }) {
  const chap = chapterIndex(book, ch)
  if (!chap) return { error: 'chapitre-introuvable', detail: `${book} ch.${ch}` }
  const section = chap.sections.find((s) => s.slug === sec && s.occ === secOcc)
  if (!section) return { error: 'section-inconnue', detail: `${book} ch.${ch} §${sec}#${secOcc}` }
  return { section }
}

/** Plage de folios couverte par des blocs : courant du premier, plus tous les marqueurs internes. */
const foliosOf = (blocks) => [
  ...new Set([blocks[0]?.folio, ...blocks.flatMap((b) => b.folios)].filter((f) => f != null)),
]

/** Contrôle d'empreinte d'une ref porteuse de `sum`. @returns {object|null} erreur structurée */
function checkSum(ref, md, where) {
  if (!ref.sum) return null
  const got = sumOf(md)
  if (got === ref.sum) return null
  return { error: 'empreinte-divergente', detail: `${where} : sum=${ref.sum} attendu, texte résolu=${got}` }
}

/**
 * Résout une découpe (suite contiguë de blocs d'une section).
 * @param {{ book: string, ch: string|number, sec: string, secOcc?: number, b0: number, b1: number,
 *           sum?: string }} ref
 * @returns {{ md: string, folios: number[] } | { error: string, detail: string }}
 */
export function resolveDecoupe(ref) {
  const { book, ch, sec = '', secOcc = 1, b0, b1 } = ref
  const found = locate(ref)
  if (found.error) return found
  const { section } = found
  const where = `${book} ch.${ch} §${sec}#${secOcc}`
  if (!Number.isInteger(b0) || !Number.isInteger(b1) || b0 < 0 || b1 < b0 || b1 >= section.blocks.length) {
    return {
      error: 'bornes-hors-limites',
      detail: `${where} blocs ${b0}-${b1} (section : ${section.blocks.length} blocs)`,
    }
  }
  const blocks = section.blocks.slice(b0, b1 + 1)
  const md = blocks.map((b) => b.md).join('\n\n')
  return checkSum(ref, md, `${where} blocs ${b0}-${b1}`) ?? { md, folios: foliosOf(blocks) }
}

/**
 * Parse un bloc-table markdown. Rend `null` si le bloc n'est pas une table.
 * @param {string} md @returns {{ headers: string[], rows: string[][] } | null}
 */
function parseTable(md) {
  const lines = md.split('\n').filter((l) => TABLE_LINE.test(l))
  if (lines.length < 2) return null
  const cells = (l) => l.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => c.trim())
  const isSeparator = (l) => cells(l).every((c) => /^:?-{2,}:?$/.test(c))
  const headers = cells(lines[0])
  const rows = lines.slice(1).filter((l) => !isSeparator(l)).map(cells)
  return { headers, rows }
}

/** Tables d'une section, dans l'ordre du document. */
const tablesOf = (section) =>
  section.blocks.map((b) => ({ block: b, table: parseTable(b.md) })).filter((t) => t.table)

/**
 * Lignes d'une section dont une cellule vaut `target` (déjà normalisé). Une ligne qui répond dans
 * plusieurs de ses colonnes ne compte qu'une fois.
 * @returns {{ block: object, headers: string[], row: string[], cols: number[] }[]}
 */
function rowsMatching(section, target) {
  const out = []
  for (const { block, table } of tablesOf(section)) {
    for (const row of table.rows) {
      const cols = row.map((c, i) => (normText(c) === target ? i : -1)).filter((i) => i >= 0)
      if (cols.length) out.push({ block, headers: table.headers, row, cols })
    }
  }
  return out
}

/**
 * Résout une adresse de CELLULE : la ligne dont une cellule vaut `row` (recherche dans TOUTES les
 * colonnes de la section), croisée avec l'en-tête `col`.
 * @param {{ book: string, ch: string|number, sec: string, secOcc?: number, row: string, col: string,
 *           sum?: string }} ref
 * @returns {{ md: string, folios: number[] } | { error: string, detail: string }}
 */
export function resolveCell(ref) {
  const { book, ch, sec = '', secOcc = 1, row, col } = ref
  const found = locate(ref)
  if (found.error) return found
  const where = `${book} ch.${ch} §${sec}#${secOcc} [${row}]×[${col}]`
  const hits = rowsMatching(found.section, normText(String(row ?? '')))
  if (hits.length === 0) return { error: 'ligne-introuvable', detail: where }
  if (hits.length > 1) return { error: 'ligne-ambigue', detail: `${where} : ${hits.length} lignes` }
  const hit = hits[0]
  if (!hit.headers.some((h) => normText(h))) return { error: 'table-sans-en-tetes', detail: where }
  const want = normText(String(col ?? ''))
  const c = hit.headers.findIndex((h) => normText(h) === want)
  if (c < 0) {
    return { error: 'colonne-inconnue', detail: `${where} : en-têtes = ${hit.headers.join(' / ')}` }
  }
  const md = (hit.row[c] ?? '').trim()
  return checkSum(ref, md, where) ?? { md, folios: foliosOf([hit.block]) }
}

/**
 * Cellules d'un livre entier dont le texte normalisé vaut `target`.
 * @param {string} book @param {string} target texte DÉJÀ normalisé
 * @returns {{ ch: string, sec: string, secOcc: number, headers: string[], row: string[], col: number }[]}
 */
export function findCells(book, target) {
  const out = []
  for (const ch of chaptersOf(book)) {
    const chap = chapterIndex(book, ch)
    if (!chap) continue
    for (const s of chap.sections) {
      for (const hit of rowsMatching(s, target)) {
        for (const col of hit.cols) {
          out.push({ ch, sec: s.slug, secOcc: s.occ, headers: hit.headers, row: hit.row, col })
        }
      }
    }
  }
  return out
}

/**
 * Bâtit l'adresse de cellule d'un `findCells` : clé de ligne = première cellule de la ligne qui la
 * désigne SANS AMBIGUÏTÉ dans sa section, les clés positionnelles (fourchette d100) passant en
 * dernier recours. Rend `null` si la ligne n'a pas de clé sûre ou la table pas d'en-têtes.
 * @param {string} book @param {ReturnType<typeof findCells>[number]} hit
 * @returns {{ book: string, ch: string, sec: string, secOcc: number, row: string, col: string, sum: string } | null}
 */
export function cellRefFor(book, hit) {
  const col = hit.headers[hit.col]
  if (!col || !normText(col)) return null
  const found = locate({ book, ch: hit.ch, sec: hit.sec, secOcc: hit.secOcc })
  if (found.error) return null
  const candidates = hit.row
    .map((c, i) => ({ c: c.trim(), i }))
    .filter(({ c, i }) => c && i !== hit.col)
    .sort((a, b) => Number(RANGE_KEY.test(a.c)) - Number(RANGE_KEY.test(b.c)))
  for (const { c } of candidates) {
    if (rowsMatching(found.section, normText(c)).length !== 1) continue
    const ref = { book, ch: hit.ch, sec: hit.sec, secOcc: hit.secOcc, row: c, col }
    const res = resolveCell(ref)
    if (res.error || normText(res.md) !== normText(hit.row[hit.col])) continue
    return { ...ref, sum: sumOf(res.md) }
  }
  return null
}

// --- CLI de démonstration ---------------------------------------------------------------------
if (import.meta.url === `file://${process.argv[1]}`) {
  const [book, ch, ...rest] = process.argv.slice(2)
  if (!book || !ch) {
    console.error(
      'usage: node scripts/source/decoupe.mjs <book> <ch> [--sec <slug> [--occ N]' +
      ' [--blocks a-b | --row <clé> --col <en-tête>]]',
    )
    process.exit(2)
  }
  const arg = (name) => { const i = rest.indexOf(name); return i >= 0 ? rest[i + 1] : undefined }
  const chap = chapterIndex(book, ch)
  if (!chap) { console.error(`chapitre introuvable : ${book} ch.${ch}`); process.exit(1) }
  const sec = arg('--sec')
  if (sec === undefined) {
    console.log(`${chap.file}  (${chap.sections.length} sections)`)
    for (const s of chap.sections) {
      const folios = [...new Set([s.folio, ...s.blocks.flatMap((b) => b.folios)].filter((f) => f != null))]
      console.log(
        `  l.${String(s.line).padStart(5)}  h${s.level}  ${s.slug || '(preambule)'}#${s.occ}` +
        `  blocs=${s.blocks.length}${folios.length ? `  folios=${folios.join(',')}` : ''}` +
        `  « ${s.title} »`,
      )
    }
  } else {
    const occ = Number(arg('--occ') ?? 1)
    const row = arg('--row')
    const section = chap.sections.find((s) => s.slug === sec && s.occ === occ)
    if (!section) { console.error(`section inconnue : ${sec}#${occ}`); process.exit(1) }
    let out
    if (row !== undefined) {
      out = resolveCell({ book, ch, sec, secOcc: occ, row, col: arg('--col') ?? '' })
    } else {
      const blocks = arg('--blocks')
      const [b0, b1] = blocks ? blocks.split('-').map(Number) : [0, section.blocks.length - 1]
      out = resolveDecoupe({ book, ch, sec, secOcc: occ, b0, b1: Number.isFinite(b1) ? b1 : b0 })
    }
    if (out.error) { console.error(`${out.error} : ${out.detail}`); process.exit(1) }
    console.error(`# folios: ${out.folios.join(',') || '-'}  sum: ${sumOf(out.md)}`)
    console.log(out.md)
  }
}
