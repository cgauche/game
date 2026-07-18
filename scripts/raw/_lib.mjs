// Helpers partagés des gardes Atlas RAW (coverage / reconcile / reanchor).
// Source UNIQUE de : map des livres (BOOKS), résolveur de fichier-chapitre, regex de réfs LDB
// (ldbRe, consommée par reconcile/check-refs) et « autres livres » (otherRe, dérivée de BOOKS,
// consommée par reconcile/check-refs), dépliage de plage, échappement regex, et normalisation de
// texte pour le match exact des citations. reanchor.mjs dérive sa PROPRE alternation de BOOKS
// (réfs SANS abréviation LDB séparée : LDB s'y traite comme les autres livres) — pas encore
// unifiée avec otherRe/ldbRe (#434 défaut 10, périmètre non couvert par ce fichier).
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import booksData from '../../src/data/books.json' with { type: 'json' }

// ABRÉV → dossier Source, DÉRIVÉ de `books.json` (SOURCE UNIQUE des acronymes, ref #585) : filtre
// les entrées porteuses d'un `dir` (les livres couverts par l'Atlas RAW), ordonnées par
// BOOK_ORDER (ordre d'affichage des rapports — books.json n'est pas trié dans cet ordre).
const BOOK_ORDER = [
  'livre-de-base', 'archives-de-l-empire-1', 'archives-de-l-empire-2', 'aux-armes', 'zoo-imperial',
  'middenheim', 'ennemi-dans-l-ombre', 'ennemi-dans-l-ombre-compagnon', 'mort-sur-le-reik',
  'mort-sur-le-reik-compagnon', 'pouvoir-derriere-le-trone', 'altdorf-couronne-de-l-empire',
  'aventures-a-ubersreik-1', 'nuits-agitees-et-dures-journees', 'mer-des-griffes',
]
const _byId = new Map(booksData.map((b) => [b.id, b]))
export const BOOKS = BOOK_ORDER.map((id) => {
  const b = _byId.get(id)
  if (!b || !b.dir) throw new Error(`BOOKS: livre "${id}" introuvable ou sans dir dans books.json`)
  return [b.abbr, b.dir]
})

const BOOK_DIR = new Map(BOOKS)

// Échappe une chaîne pour l'insérer littéralement dans une RegExp.
export const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

// Regex de réfs (factories : instances FRAÎCHES — l'état /g `lastIndex` n'est pas partagé entre appelants).
// `ch.` optionnel devant le numéro de chapitre (#434 défaut 3) : le code écrit indifféremment
// `LIVRE NN l.X` et `LIVRE ch.NN l.X` — le groupe livre reste OBLIGATOIRE dans les deux regex.
export const ldbRe = () => /\bLDB (?:ch\.)?(\d+) l\.(\d+)((?:[-+]\d+)*)/g       // LDB <ch> l.<line>[-end][+n…]

// otherRe DÉRIVE de BOOKS (#434 défaut 10 : une alternation écrite à la main avait oublié MDG).
// Plus de graphies tolérées (#585 lot B) : chaque livre a désormais UNE seule abréviation
// canonique (SOURCE UNIQUE `books.json`), l'identité stricte suffit — aucune variante à couvrir.
// Tri par longueur décroissante OBLIGATOIRE : sinon "MSR" matcherait avant "MSRC", "EDO" avant "EDOC".
const OTHER_ABBR_ALT = BOOKS.filter(([a]) => a !== 'LDB').map(([a]) => esc(a))
  .sort((a, b) => b.length - a.length).join('|')
// m[4] = suffixe de plage `((?:[-+]\d+)*)` (#487), miroir de ldbRe ; check-refs et reconcile.mjs
// (branche atlasOther) le lisent tous deux désormais (#586).
export const otherRe = () =>
  new RegExp(`\\b(${OTHER_ABBR_ALT})(?: (?:ch\\.)?(\\d+))? l\\.(\\d+)((?:[-+]\\d+)*)`, 'g')

// Expose l'alternation hors-LDB (triée par longueur décroissante, source unique) à tout consommateur
// qui a besoin de matcher un livre SANS composer le reste d'otherRe (#434 défaut 10 : citation-graphy-guard
// écrivait sa propre alternation à la main, désynchronisée si BOOKS gagne un livre).
export const otherAbbrAlternation = () => OTHER_ABBR_ALT

// Canonicalise le texte brut matché par otherRe (m[1]) vers l'abréviation BOOKS (#434 défaut 11).
// Identité stricte (#585 lot B) — une seule graphie par livre, aucune variante à résoudre.
export function bookOf(text) {
  return BOOK_DIR.has(text) ? text : null
}

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

// --- Résolution FOLIO imprimé → (chapitre, plage de lignes) (#434) ---
// Le contenu data-driven de `src/data/*.json` cite sa source en FOLIO imprimé (`source:{book,page}`),
// invisible du matcher par ligne de build-implemente. La ré-extraction Marker a posé des ancres
// `<span … data-folio="NN">` : un folio se convertit donc en (chapitre, [ligne de l'ancre → ligne de
// la prochaine ancre `data-folio`, ou fin de fichier]). Un seul scan par livre (cache).
// PUR (testable, aucun disque) : `chapters` = [{ ch, lines:[] }] → Map(folio → [{ ch, lo, hi }]).
// Plage d'un folio = [ligne de l'ancre `data-folio` → ligne de la prochaine ancre, ou fin de fichier].
export function buildFolioMap(chapters) {
  const map = new Map()
  const anchorRe = /data-folio="(-?\d+)"/
  for (const { ch, lines } of chapters) {
    const anchors = []
    lines.forEach((l, i) => {
      const m = anchorRe.exec(l)
      if (m) anchors.push({ folio: Number(m[1]), line: i + 1 })
    })
    for (let k = 0; k < anchors.length; k++) {
      const lo = anchors[k].line
      const hi = k + 1 < anchors.length ? anchors[k + 1].line : lines.length
      const arr = map.get(anchors[k].folio)
      if (arr) arr.push({ ch, lo, hi })
      else map.set(anchors[k].folio, [{ ch, lo, hi }])
    }
  }
  return map
}

// (map, folio) → { ch, lo, hi } | null (folio absent) | 'ambiguous' (folio dans ≥2 chapitres).
export function folioRangeIn(map, folio) {
  const hits = map.get(folio)
  if (!hits || !hits.length) return null
  if (new Set(hits.map((h) => h.ch)).size > 1) return 'ambiguous'
  return hits[0]
}

const _folioCache = new Map() // abbr -> Map(folio -> [{ ch, lo, hi }])
export function folioIndexOf(abbr) {
  if (_folioCache.has(abbr)) return _folioCache.get(abbr)
  const dir = BOOK_DIR.get(abbr)
  const chapters = []
  if (dir) {
    let files
    try { files = readdirSync(dir).filter((x) => /^\d+ - .*\.md$/.test(x)).sort() } catch { files = [] }
    for (const file of files) {
      const ch = Number(/^(\d+) - /.exec(file)[1])
      const lines = readFileSync(join(dir, file), 'utf8').split('\n')
      chapters.push({ ch, lines })
    }
  }
  const map = buildFolioMap(chapters)
  _folioCache.set(abbr, map)
  return map
}

// (abbr, folio) → { ch, lo, hi } | null | 'ambiguous'.
export function folioRange(abbr, folio) {
  return folioRangeIn(folioIndexOf(abbr), folio)
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

// --- Exclusions PARTAGÉES de fiches docs/raw (#454 DoD, #585 lot A) ---
// Deux ensembles nommés (périmètres RÉELLEMENT différents, pas une fusion aveugle) :
// - RAWDOC_META_GENERATED : rapports RÉ-GÉNÉRÉS à chaque run (jamais des citations vivantes d'auteur)
//   — hors sujet pour TOUT scan (bornes de ligne comme prose de citation) : check-refs, check-code-refs
//   (src uniquement, sans objet), reconcile (Sens A/B), reanchor, citation-graphy-guard (a/b/c/d).
// - RAWDOC_AUTHOR_META : fiches d'auteur (index, conventions de sourcing) qui PEUVENT citer un chapitre
//   réel illustrativement (bornes de ligne restent vérifiables par check-refs) mais ne portent PAS de
//   citation verbatim vivante à ré-ancrer ni de prose d'état à juger — hors sujet pour reanchor et pour
//   citation-graphy-guard scan (d) seulement, PAS pour check-refs/check-code-refs/reconcile.
export const RAWDOC_META_GENERATED = new Set(['coverage.md', 'reconciliation.md', 'reanchor.md'])
export const RAWDOC_AUTHOR_META = new Set(['00-index.md', 'sources.md', 'code-map.md'])
export const isRawEpreuve = (name) => /^epreuve-/.test(name)
