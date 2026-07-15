// Helpers partagés des gardes Atlas RAW (coverage / reconcile / reanchor).
// Source UNIQUE de : map des livres, résolveur de fichier-chapitre, regex de réfs, dépliage de plage,
// échappement regex, et normalisation de texte pour le match exact des citations.
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

// ABRÉV → dossier Source (les 14 livres autorisés). Ordre = ordre d'affichage des rapports.
export const BOOKS = [
  ['LDB', 'Source/Warhammer v4 - Livre de base version corrigée'],
  ['ADE I', "Source/Warhammer v4 - Les archives de l'Empire volume 1"],
  ['ADE II', "Source/Warhammer v4 - Les archives de l'Empire volume 2"],
  ['AA', 'Source/WH - V4 - Aux Armes'],
  ['ZI', 'Source/WH - V4 - Le zoo impérial'],
  ['Middenheim', 'Source/Warhammer v4 - Middenheim la cité du Loup Blanc'],
  ['EDO', "Source/Warhammer v4 - 1.0 L'ennemi dans l'Ombre"],
  ['EDOC', "Source/Warhammer v4 - 1.0 L'ennemi dans l'Ombre Compagnon"],
  ['T2', 'Source/Warhammer v4 - 2.0 Mort sur le Reik'],
  ['T2C', 'Source/Warhammer v4 - 2.0 Mort sur le Reik Compagnon'],
  ['T3', 'Source/Warhammer v4 - 3.0 Le Pouvoir Derriere le Trone'],
  ['Altdorf', "Source/Warhammer v4 - Aldorf la Couronne de l'Empire"],
  ['Ubersreik', 'Source/Warhammer v4 - Aventures a Ubersreik'],
  ['NADAJ', 'Source/Warhammer v4 - Nuits agitees & dures journées'],
  ['MDG', 'Source/WH - V4 - La Mer de Griffe'],
]

const BOOK_DIR = new Map(BOOKS)

// Échappe une chaîne pour l'insérer littéralement dans une RegExp.
export const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

// Regex de réfs (factories : instances FRAÎCHES — l'état /g `lastIndex` n'est pas partagé entre appelants).
// `ch.` optionnel devant le numéro de chapitre (#434 défaut 3) : le code écrit indifféremment
// `LIVRE NN l.X` et `LIVRE ch.NN l.X` — le groupe livre reste OBLIGATOIRE dans les deux regex.
export const ldbRe = () => /\bLDB (?:ch\.)?(\d+) l\.(\d+)((?:[-+]\d+)*)/g       // LDB <ch> l.<line>[-end][+n…]
export const otherRe = () =>
  /\b(ADE ?I{1,2}|ADE ?[12]|AA|ZI|EDOC|EDO|T2C|T2|T3|Midd\w*|NAD\w+|Ald\w+|Alt\w+|Uber\w+)(?: (?:ch\.)?(\d+))? l\.(\d+)/g

// Déplie un suffixe "-285" (intervalle) ou "+217+220" (points) → [lo, hi].
export function span(line, suffix) {
  const a = Number(line)
  if (!suffix) return [a, a]
  const range = suffix.match(/^-(\d+)/)
  if (range) return [a, Number(range[1])]
  const plus = (suffix.match(/\+(\d+)/g) || []).map((s) => Number(s.slice(1)))
  return [a, Math.max(a, ...plus)]
}

// Résout (ABRÉV, NN[, range]) → { path, file, dir } du `.md` chapitre, ou null. Lookup par préfixe `NN - `.
// `range` optionnel = { from, to? } route une SOUS-SECTION du chapitre (jamais un second mécanisme) : `from`/
// `to` sont chacun une ancre — texte de heading Markdown (n'importe quel niveau `#`, markup ignoré) OU
// `folio:NN` pour un `<span … data-folio="NN">` — bornant un extrait VERBATIM ajouté en `.text` (trim).
// `to` omis = jusqu'à la fin du fichier. Lève si une ancre est introuvable (fail-fast, jamais un extrait silencieux faux).
const _chapterCache = new Map()
export function chapterFile(abbr, nn, range) {
  const key = `${abbr}|${nn}`
  let res
  if (_chapterCache.has(key)) {
    res = _chapterCache.get(key)
  } else {
    const dir = BOOK_DIR.get(abbr)
    res = null
    if (dir) {
      const pad = String(Number(nn)).padStart(2, '0')
      let f
      try { f = readdirSync(dir).find((x) => x.startsWith(pad + ' - ') && x.endsWith('.md')) } catch { f = null }
      if (f) res = { path: join(dir, f), file: f, dir }
    }
    _chapterCache.set(key, res)
  }
  if (!res || !range) return res
  const lines = readFileSync(res.path, 'utf8').split('\n').map((l) => l.replace(/\r$/, ''))
  const startIdx = findAnchor(lines, range.from)
  if (startIdx == null) throw new Error(`chapterFile(${abbr} ${nn}) : ancre de départ "${range.from}" introuvable dans ${res.path}`)
  let endIdx = lines.length
  if (range.to) {
    endIdx = findAnchor(lines, range.to)
    if (endIdx == null) throw new Error(`chapterFile(${abbr} ${nn}) : ancre de fin "${range.to}" introuvable dans ${res.path}`)
  }
  return { ...res, text: lines.slice(startIdx, endIdx).join('\n').trim() }
}

// Trouve la ligne d'une ancre `from`/`to` de `chapterFile` (heading Markdown normalisé, ou `folio:NN`).
function findAnchor(lines, locator) {
  const folio = /^folio:(\d+)$/.exec(locator)
  if (folio) {
    const re = new RegExp(`data-folio="${folio[1]}"`)
    const idx = lines.findIndex((l) => re.test(l))
    return idx < 0 ? null : idx
  }
  const target = normalize(locator)
  const idx = lines.findIndex((l) => {
    const m = /^#+\s*(.*)$/.exec(l)
    return m ? normalize(m[1]) === target : false
  })
  return idx < 0 ? null : idx
}

// Normalisation pour le MATCH EXACT des citations : replie tout le cosmétique (espaces, guillemets,
// apostrophes, tirets, emphase markdown, casse) MAIS conserve les accents (le match français doit être
// exact : « blessure » ≠ « blessuré »). \s couvre les espaces insécables (U+00A0 / U+202F).
// Les ellipses (…, ..., [...], […]) → sentinelle U+2026, point de coupe pour le split des citations.
const SENT = '…'
export function normalize(s) {
  return s
    .replace(/[*_`]/g, '')                          // emphase / code markdown
    .replace(/[«»“”„]/g, '')         // guillemets (la frontière est gérée par le parser)
    .replace(/[’＇´]/g, "'")          // variantes d'apostrophe → '
    .replace(/\[\s*(?:…|\.\.\.)\s*\]/g, ` ${SENT} `) // [...] / […] (élision)
    .replace(/\.\.\./g, SENT)                       // ... → sentinelle
    .replace(/[–—−-]/g, '-')         // tirets (en/em/moins/trait) → -
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
}
export const ELLIPSIS_SENTINEL = SENT
