// Bibliothèque de DÉCOUPE des chapitres `Source/` (spike #découpe) : SOURCE UNIQUE du parsing.
// Une découpe = une adresse stable dans un chapitre — { book, ch, sec, secOcc, b0, b1 } — qui rend
// la prose VERBATIM du livre sans la dupliquer ailleurs. Deux consommateurs : la CLI ci-dessous et
// `derive-decoupes.mjs` (qui ne reparse RIEN par lui-même).
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
//  - RECOLLAGE DE FOLIO : un saut de folio coupe des paragraphes en plein milieu (`21 - Psychologie.md:45-48`,
//    `05 - _gjdgxs.md:44`). Deux blocs séparés par une coupure PORTEUSE DE FOLIO (bloc vide réduit à
//    son marqueur, ou bloc suivant ouvert par un marqueur) sont recollés par une espace quand le bloc
//    précédent ne finit pas par une ponctuation finale (`.!?»”:;`) et qu'aucun des deux n'est une
//    table ou une puce.
import { readdirSync } from 'node:fs'
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
const TABLE_LINE = /^\s*\|/
const BULLET = /^\s*(?:[-*•]|\d+[.)])\s/

/** Retire les balises `<span>` (le contenu textuel est conservé). @param {string} s @returns {string} */
export const stripSpans = (s) => s.replace(SPAN_TAG, '')

/** Folios (`data-folio`) portés par un fragment, dans l'ordre. @param {string} s @returns {number[]} */
export function foliosIn(s) {
  const out = []
  for (const m of s.matchAll(FOLIO_ATTR)) out.push(Number(m[1]))
  return out
}

/** Titre affichable d'un heading : markdown d'emphase et `#` de fermeture retirés. */
const cleanTitle = (s) => stripSpans(s).replace(/#+\s*$/, '').replace(/[*_`]/g, '').trim()

/** Slugifie un titre : minuscules, accents TRANSLITTÉRÉS, tout le reste en tirets. */
export function slugify(title) {
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

/** Deux blocs coupés par un saut de folio sont-ils recollables ? @returns {boolean} */
function recollable(prev, next) {
  if (TERMINAL.test(prev)) return false
  if (TABLE_LINE.test(prev.split('\n').pop()) || TABLE_LINE.test(next)) return false
  if (BULLET.test(next)) return false
  return true
}

/**
 * Découpe un corps de section en blocs d'affichage (spans retirés, folios collectés, recollage des
 * paragraphes coupés par un saut de folio).
 * @param {string[]} lines @returns {{ md: string, folios: number[] }[]}
 */
function toBlocks(lines) {
  const raw = []
  let cur = []
  for (const l of lines) {
    if (l.trim() === '') { if (cur.length) { raw.push(cur.join('\n')); cur = [] } } else cur.push(l)
  }
  if (cur.length) raw.push(cur.join('\n'))

  const out = []
  let carry = []
  let carryCut = false
  for (const text of raw) {
    const folios = foliosIn(text)
    const md = stripSpans(text).trim()
    if (!md) { carry.push(...folios); carryCut = true; continue }
    const cut = carryCut || OPENS_ON_FOLIO.test(text)
    const blockFolios = [...carry, ...folios]
    carry = []; carryCut = false
    const prev = out[out.length - 1]
    if (prev && cut && recollable(prev.md, md)) {
      prev.md = `${prev.md} ${md}`
      prev.folios.push(...blockFolios)
    } else {
      out.push({ md, folios: blockFolios })
    }
  }
  return out
}

/**
 * Parse un chapitre en sections adressables.
 * @param {string} text contenu markdown du chapitre (lu par `readText`, donc en LF)
 * @returns {{ sections: { slug: string, occ: number, title: string, level: number, line: number,
 *             folios: number[], blocks: { md: string, folios: number[] }[] }[] }}
 */
export function parseChapter(text) {
  const lines = text.split('\n')
  const sections = []
  const seen = new Map()
  let cur = { slug: '', occ: 1, title: '', level: 0, line: 1, folios: [], lines: [] }
  const push = () => {
    const { lines: body, ...rest } = cur
    sections.push({ ...rest, blocks: toBlocks(body) })
  }
  for (let i = 0; i < lines.length; i++) {
    const m = HEADING.exec(lines[i])
    if (!m) { cur.lines.push(lines[i]); continue }
    push()
    const title = cleanTitle(m[2])
    const slug = slugify(m[2]) || '-'
    const occ = (seen.get(slug) ?? 0) + 1
    seen.set(slug, occ)
    cur = { slug, occ, title, level: m[1].length, line: i + 1, folios: foliosIn(lines[i]), lines: [] }
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
 * @returns {{ path: string, file: string, sections: ReturnType<typeof parseChapter>['sections'] } | null}
 */
export function chapterIndex(book, ch) {
  const key = `${book}|${ch}`
  if (_chapterCache.has(key)) return _chapterCache.get(key)
  const abbr = ABBR_BY_BOOK_ID[book]
  const res = abbr ? chapterFile(abbr, ch) : null
  const out = res ? { path: res.path, file: res.file, sections: parseChapter(readText(res.path)).sections } : null
  _chapterCache.set(key, out)
  return out
}

/**
 * Résout une découpe.
 * @param {{ book: string, ch: string|number, sec: string, secOcc?: number, b0: number, b1: number }} ref
 * @returns {{ md: string, folios: number[] } | { error: string, detail: string }}
 */
export function resolveDecoupe(ref) {
  const { book, ch, sec = '', secOcc = 1, b0, b1 } = ref
  const chap = chapterIndex(book, ch)
  if (!chap) return { error: 'chapitre-introuvable', detail: `${book} ch.${ch}` }
  const section = chap.sections.find((s) => s.slug === sec && s.occ === secOcc)
  if (!section) return { error: 'section-inconnue', detail: `${book} ch.${ch} §${sec}#${secOcc}` }
  if (!Number.isInteger(b0) || !Number.isInteger(b1) || b0 < 0 || b1 < b0 || b1 >= section.blocks.length) {
    return {
      error: 'bornes-hors-limites',
      detail: `${book} ch.${ch} §${sec}#${secOcc} blocs ${b0}-${b1} (section : ${section.blocks.length} blocs)`,
    }
  }
  const blocks = section.blocks.slice(b0, b1 + 1)
  const folios = [...new Set([...(b0 === 0 ? section.folios : []), ...blocks.flatMap((b) => b.folios)])]
  return { md: blocks.map((b) => b.md).join('\n\n'), folios }
}

// --- CLI de démonstration ---------------------------------------------------------------------
if (import.meta.url === `file://${process.argv[1]}`) {
  const [book, ch, ...rest] = process.argv.slice(2)
  if (!book || !ch) {
    console.error('usage: node scripts/source/decoupe.mjs <book> <ch> [--sec <slug> [--occ N] [--blocks a-b]]')
    process.exit(2)
  }
  const arg = (name) => { const i = rest.indexOf(name); return i >= 0 ? rest[i + 1] : undefined }
  const chap = chapterIndex(book, ch)
  if (!chap) { console.error(`chapitre introuvable : ${book} ch.${ch}`); process.exit(1) }
  const sec = arg('--sec')
  if (sec === undefined) {
    console.log(`${chap.file}  (${chap.sections.length} sections)`)
    for (const s of chap.sections) {
      const folios = s.blocks.flatMap((b) => b.folios)
      console.log(
        `  l.${String(s.line).padStart(5)}  h${s.level}  ${s.slug || '(preambule)'}#${s.occ}` +
        `  blocs=${s.blocks.length}${folios.length ? `  folios=${[...new Set(folios)].join(',')}` : ''}` +
        `  « ${s.title} »`,
      )
    }
  } else {
    const occ = Number(arg('--occ') ?? 1)
    const blocks = arg('--blocks')
    const section = chap.sections.find((s) => s.slug === sec && s.occ === occ)
    if (!section) { console.error(`section inconnue : ${sec}#${occ}`); process.exit(1) }
    const [b0, b1] = blocks ? blocks.split('-').map(Number) : [0, section.blocks.length - 1]
    const out = resolveDecoupe({ book, ch, sec, secOcc: occ, b0, b1: Number.isFinite(b1) ? b1 : b0 })
    if (out.error) { console.error(`${out.error} : ${out.detail}`); process.exit(1) }
    console.error(`# folios: ${out.folios.join(',') || '-'}`)
    console.log(out.md)
  }
}
