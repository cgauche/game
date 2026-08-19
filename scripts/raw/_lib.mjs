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

// Lecture CRLF-robuste (#604) -- SOURCE UNIQUE de lecture texte pour tout fichier Source/**/docs/raw/** :
// une reecriture Windows du 2026-07-07 a mutile 202 fichiers en CRLF/mixte (contenu identique, index git
// reste LF). sectionsOf (coverage.mjs) decoupe les headings avec une regex de fin de ligne ancree sans
// flag m -- or le '.' de regex exclut TOUT LineTerminator (dont \r, ECMA-262), donc le heading pattern
// echoue net des qu'une ligne se termine par \r (repro mesure : sectionsOf('# A\r\n## B\r\ntexte', 2)
// -> un seul '(integral)', la boundary H2 jamais vue). readText normalise \r\n/\r isole -> \n AU POINT
// DE LECTURE -- jamais dans les parseurs eux-memes (une seule couture, pas un remede par regex disperse).
// N'affecte pas JSON.parse (deja tolerant aux fins de ligne) ni les fichiers deja en LF (no-op).
export const readText = (path) => readFileSync(path, 'utf8').replace(/\r\n|\r/g, '\n')

// ABRÉV → dossier Source, DÉRIVÉ de `books.json` (SOURCE UNIQUE des acronymes, ref #585) : filtre
// les entrées porteuses d'un `dir` (les livres couverts par l'Atlas RAW), ordonnées par
// BOOK_ORDER (ordre d'affichage des rapports — books.json n'est pas trié dans cet ordre).
const BOOK_ORDER = [
  'livre-de-base', 'archives-de-l-empire-1', 'archives-de-l-empire-2', 'aux-armes', 'zoo-imperial',
  'middenheim', 'ennemi-dans-l-ombre', 'ennemi-dans-l-ombre-compagnon', 'mort-sur-le-reik',
  'mort-sur-le-reik-compagnon', 'pouvoir-derriere-le-trone', 'altdorf-couronne-de-l-empire',
  'aventures-a-ubersreik-1', 'nuits-agitees-et-dures-journees', 'mer-des-griffes',
  'vents-de-la-magie',
]
const _byId = new Map(booksData.map((b) => [b.id, b]))
export const BOOKS = BOOK_ORDER.map((id) => {
  const b = _byId.get(id)
  if (!b || !b.dir) throw new Error(`BOOKS: livre "${id}" introuvable ou sans dir dans books.json`)
  return [b.abbr, b.dir]
})

const BOOK_DIR = new Map(BOOKS)

// Sigle du livre PIVOT de l'Atlas (le LIVRE DE BASE : ses réfs sont indexées chapitre PAR chapitre,
// les 15 autres livres passent par la voie `other*`). Lu au registre `books.json` — jamais réécrit à
// la main dans les regex de réfs, dans les filtres « hors pivot », ni dans les `{book}`/`{abbr}` que
// les gardes de la MÊME chaîne produisent (`build-implemente`, `check-refs`, `check-code-refs`) et
// que `reconcile` consomme : producteur et consommateur tiennent le sigle du même endroit.
// L'ABSENCE du livre pivot est déjà fatale plus haut (`BOOKS` l.35, `BOOK_ORDER[0]`) ; le garde
// ci-dessous couvre le cas RESTANT — entrée présente mais SANS `abbr` (`PIVOT_ABBR` valant alors
// `undefined`, qui bâtirait des regex `\bundefined …` muettes).
const PIVOT_BOOK_ID = 'livre-de-base'
export const PIVOT_ABBR = _byId.get(PIVOT_BOOK_ID)?.abbr
if (!PIVOT_ABBR) throw new Error(`_lib: livre pivot "${PIVOT_BOOK_ID}" sans \`abbr\` dans books.json`)

// Échappe une chaîne pour l'insérer littéralement dans une RegExp.
export const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

// Regex de réfs (factories : instances FRAÎCHES — l'état /g `lastIndex` n'est pas partagé entre appelants).
// `ch.` optionnel devant le numéro de chapitre (#434 défaut 3) : le code écrit indifféremment
// `LIVRE NN l.X` et `LIVRE ch.NN l.X` — le groupe livre reste OBLIGATOIRE dans les deux regex.
// Suffixe : `-fin` (plage) · `+n…` (points) · `/n…` (forme COMPACTE `l.298/315/369`, #1318 E3-L4 —
// jusque-là seul le PREMIER numéro était vu, les suivants échappaient à toute garde : `l.222/999`
// passait vert). Le `(?!\d)(?!\s*l\.)` (nombre ENTIER, puis pas de ` l.` derrière — sans le garde
// de chiffre la regex se rabattrait sur `/2` de `/20 l.72`) distingue `/315` (ligne du MÊME chapitre) de `/20 l.72` (réf
// MULTI-CHAPITRES `LDB 18 l.298/20 l.72`, où `20` est un CHAPITRE — jamais une ligne du 18).
export const ldbRe = () => new RegExp(`\\b${esc(PIVOT_ABBR)} (?:ch\\.)?(\\d+) l\\.(\\d+)((?:[-+]\\d+|/\\d+(?!\\d)(?!\\s*l\\.))*)`, 'g') // <pivot> <ch> l.<line>[-end][+n…][/n…]

// otherRe DÉRIVE de BOOKS (#434 défaut 10 : une alternation écrite à la main avait oublié MDG).
// Plus de graphies tolérées (#585 lot B) : chaque livre a désormais UNE seule abréviation
// canonique (SOURCE UNIQUE `books.json`), l'identité stricte suffit — aucune variante à couvrir.
// Tri par longueur décroissante OBLIGATOIRE : sinon "MSR" matcherait avant "MSRC", "EDO" avant "EDOC".
const OTHER_ABBR_ALT = BOOKS.filter(([a]) => a !== PIVOT_ABBR).map(([a]) => esc(a))
  .sort((a, b) => b.length - a.length).join('|')
// m[4] = suffixe de plage `((?:[-+]\d+)*)` (#487), miroir de ldbRe ; check-refs et reconcile.mjs
// (branche atlasOther) le lisent tous deux désormais (#586).
export const otherRe = () =>
  new RegExp(`\\b(${OTHER_ABBR_ALT})(?: (?:ch\\.)?(\\d+))? l\\.(\\d+)((?:[-+]\\d+|/\\d+(?!\\d)(?!\\s*l\\.))*)`, 'g')

// Miroir FOLIO de `ldbRe`/`otherRe` (#606) : la graphie canonique `ABBR NN p.<folio>[-fin][+pts]`
// (gelee par #585) est aussi une ref de chapitre valide -- jamais captee par les regex ` l.` ci-dessus.
// Memes groupes de capture que leur pendant ` l.`, pour rester des substituts directs cote appelant.
export const ldbFolioRe = () => new RegExp(`\\b${esc(PIVOT_ABBR)} (?:ch\\.)?(\\d+) p\\.(\\d+)((?:[-+]\\d+)*)`, 'g')
export const otherFolioRe = () =>
  new RegExp(`\\b(${OTHER_ABBR_ALT})(?: (?:ch\\.)?(\\d+))? p\\.(\\d+)((?:[-+]\\d+)*)`, 'g')

// Expose l'alternation hors-LDB (triée par longueur décroissante, source unique) à tout consommateur
// qui a besoin de matcher un livre SANS composer le reste d'otherRe (#434 défaut 10 : citation-graphy-guard
// écrivait sa propre alternation à la main, désynchronisée si BOOKS gagne un livre).
export const otherAbbrAlternation = () => OTHER_ABBR_ALT

// Canonicalise le texte brut matché par otherRe (m[1]) vers l'abréviation BOOKS (#434 défaut 11).
// Identité stricte (#585 lot B) — une seule graphie par livre, aucune variante à résoudre.
export function bookOf(text) {
  return BOOK_DIR.has(text) ? text : null
}

// Un suffixe est-il une PLAGE (`-fin`) ? Les autres formes (`+pts`, `/compacte`) sont des ancres
// DISTINCTES, jamais un intervalle : un consommateur qui juge « toutes les lignes citées sont vides »
// doit les traiter une à une (sans quoi `l.202/213` se lit comme 202→213, lignes pleines comprises).
export const isRangeSuffix = (suffix) => !!suffix && /^-\d+/.test(suffix)

// Tous les numéros de ligne EXPLICITEMENT cités par une réf : `l.10` → [10] · `l.10-25` → [10,25]
// (bornes) · `l.10+17` → [10,17] · `l.298/315/369` → [298,315,369] (forme COMPACTE, #1318 E3-L4).
export function refNums(line, suffix) {
  const a = Number(line)
  if (!suffix) return [a]
  const extra = (suffix.match(/[-+/](\d+)/g) || []).map((s) => Number(s.slice(1)))
  return [a, ...extra.filter((n) => n !== a)]
}

// Déplie un suffixe "-285" (intervalle), "+217+220" (points) ou "/315/369" (compacte) → [lo, hi].
// `hi` = borne HAUTE de tout ce qui est cité : c'est elle que borne `check-code-refs`.
export function span(line, suffix) {
  const nums = refNums(line, suffix)
  return [nums[0], Math.max(...nums)]
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
  const lines = readText(res.path).split('\n')
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
      const lines = readText(join(dir, file)).split('\n')
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

// (abbr, nn, folioStr, suffix) -> [lo, hi] LIGNES dans le fichier-chapitre `nn`, ou `null` (#606).
// Convertit une ref folio `ABBR NN p.folio[-fin][+pts]` en plage de LIGNES du MEME chapitre via
// `folioRange` (ancres `data-folio`). Ignore proprement (`null`, jamais un throw) : ancre absente
// (residu #522), folio ambigu (present dans plusieurs chapitres), ou folio resolu vers un AUTRE
// chapitre que `nn` (frontiere de chapitre) -- on ne cherche PAS a re-ancrer, juste a ne pas
// crediter un mauvais chapitre. Un `-fin`/`+pts` dont le second folio est irresolu degrade sur
// la seule plage du premier folio (jamais un throw ni une plage bancale).
export function folioSpan(abbr, nn, folioStr, suffix) {
  const wantCh = Number(nn)
  const resolveInCh = (folio) => {
    const r = folioRange(abbr, folio)
    if (!r || r === 'ambiguous' || r.ch !== wantCh) return null
    return r
  }
  const start = resolveInCh(Number(folioStr))
  if (!start) return null
  if (!suffix) return [start.lo, start.hi]
  const range = suffix.match(/^-(\d+)/)
  if (range) {
    const end = resolveInCh(Number(range[1]))
    return end ? [start.lo, end.hi] : [start.lo, start.hi]
  }
  let hi = start.hi
  for (const p of (suffix.match(/\+(\d+)/g) || [])) {
    const end = resolveInCh(Number(p.slice(1)))
    if (end && end.hi > hi) hi = end.hi
  }
  return [start.lo, hi]
}

// (#454 juge adversarial) Un folio SIMPLE `ABBR N p.X` cité au DERNIER folio du chapitre N, alors que
// le chapitre N+1 s'ouvre sur X ou X+1, est un CANDIDAT à contenu-en-fin-de-chapitre-qui-a-débordé
// (cas prouvé : `LDB 48 p.255` — le sujet cité vivait en réalité au tout début de `49 - Sorcellerie.md`,
// AVANT sa propre première ancre `data-folio`). Détection STRUCTURELLE PURE (aucun accès disque ici) :
// ne tranche PAS si le sujet cité vit réellement en N ou en N+1 (vérification verbatim, non triviale,
// hors scope) — seulement que la POSITION rend les deux plausibles. `map` = `folioIndexOf(abbr)`.
export function chapterBoundaryRisk(map, ch, folio) {
  let lastOfCh = null
  let firstOfNext = null
  for (const [f, hits] of map) {
    if (hits.some((h) => h.ch === ch)) { if (lastOfCh === null || f > lastOfCh) lastOfCh = f }
    if (hits.some((h) => h.ch === ch + 1)) { if (firstOfNext === null || f < firstOfNext) firstOfNext = f }
  }
  if (lastOfCh === null || firstOfNext === null || folio !== lastOfCh) return false
  return firstOfNext === folio || firstOfNext === folio + 1
}

// (abbr, ch, folio) → bool, enrobe `chapterBoundaryRisk` avec `folioIndexOf` (accès disque + cache).
export function chapterBoundaryRiskFor(abbr, ch, folio) {
  return chapterBoundaryRisk(folioIndexOf(abbr), ch, folio)
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
