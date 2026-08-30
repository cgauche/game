// Générateur du champ `**Implémente :**` des fiches docs/raw/*.md (#487) : le champ est DÉRIVÉ du
// code (jamais écrit à la main — cf. game-doc-derivee-jamais-ecrite-a-la-main). Patron de
// build-systemes.mjs : manifest éditorial (src/data/raw.manifest.json) + calcul + mode --check qui
// régénère en mémoire, compare au committé, exit 1 sans écrire.
// Re-run : node scripts/raw/build-implemente.mjs (npm run raw:implemente).
import { readdirSync, readFileSync, writeFileSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { ldbRe, otherRe, span, bookOf, BOOKS, esc, folioRange, otherAbbrAlternation, readText, PIVOT_ABBR } from './_lib.mjs'
import { closureOf } from '../guards/lib/importGraph.mjs'

export const RAWDIR = 'docs/raw'
export const SRC_DIR = 'src'
export const EXCLUDE_SRC_PREFIX = 'src/gameIso/rig/parts/tenues/defs/' // art de couverture, pas une règle
export const MANIFEST_PATH = 'src/data/raw.manifest.json'
export const BOOKS_JSON_PATH = 'src/data/books.json'
export const APP_ROOT_MODULE = 'src/main.tsx'
// Fenêtre de match ligne (épreuve 2026-07-16). Recalibrage empirique 2026-07-16 (mesure `--dry` TOL
// 10/5/2/0 → implémentés 286/282/273/264) : TOL n'est PAS le levier des faux « implémenté » des
// pages-catalogues denses. Les faux `activites#dressage`/`entrainement`/`faites-moi-une-faveur`
// viennent d'une plage FOLIO large (`activities.json` craft/learn → `LDB 23 l.50-191`) qui CONTIENT
// déjà le topic → TOL-immune. À l'inverse TOL=0 casse de vrais folio-implémentés (colique : topic
// `MSRC 16 l.109-111` vs plage folio `l.65-105`, décalage folio↔fiche de 4 l. que TOL comble).
// Tenu à 10 : `renderBlock` accepte un override `ctx.tol` (mesure) ; le remède des pages denses est
// côté FOLIO (feature #434), pas TOL — écart rapporté à l'orchestrateur.
export const TOL = 10

const EXCLUDE_DOCS = new Set(['coverage.md', 'reconciliation.md', 'reanchor.md', '00-index.md', 'sources.md', 'code-map.md'])
export function isFicheDoc(name) {
  if (!name.endsWith('.md')) return false
  if (EXCLUDE_DOCS.has(name)) return false
  if (name.startsWith('epreuve-') || name.startsWith('catalogue-')) return false
  return true
}
export const isExcludedSrc = (rel) => rel.startsWith(EXCLUDE_SRC_PREFIX)
const BOOK_ORDER = new Map(BOOKS.map(([abbr], i) => [abbr, i]))

// --- regex héritées (graphies du libellé de champ) ---
export const HEADING_RE = /^(#{1,6})\s+(.*)$/
export const FIELD_START_RE = /^\*\*Impl[ée]ment[ée]?\s*[:.]?\*\*/
export const FIELD_ANYWHERE_RE = /\*\*Impl[ée]ment[ée]?\s*[:.]?\*\*/
export const DECL_RE = /^(?:export\s+)?(?:default\s+)?(?:async\s+)?(?:function|const|let|var|class|interface|type|enum)\s+([A-Za-z_$][\w$]*)/
const COMMENT_OR_BLANK = /^\s*(?:\/\/|\/\*|\*|$)/

// Marqueur généré (SEULE graphie du non-implémenté) — et sa contre-épreuve d'invisibilité des gardes.
export const GEN_TAG = '_(généré — `npm run raw:implemente`)_'
export const NOT_IMPL = '(non implémenté)'
// Alternation DÉRIVÉE de `_lib.mjs` (#434 défaut 10 : une alternation écrite à la main ici se
// désynchronisait dès qu'un livre s'ajoutait à BOOKS — cf. otherAbbrAlternation, source unique).
export const GUARD_LEAK_RE = new RegExp(`\\b(?:${esc(PIVOT_ABBR)}|${otherAbbrAlternation()}) ?\\d* l\\.`)

export function slugify(s) {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/** Réfs `{ book, ch, lo, hi }` d'une ligne (spans dépliés par `span`). */
export function refsWithSpans(line) {
  const out = []
  const ldb = ldbRe()
  let m
  while ((m = ldb.exec(line))) {
    const [lo, hi] = span(m[2], m[3])
    out.push({ book: PIVOT_ABBR, ch: Number(m[1]), lo, hi })
  }
  const other = otherRe()
  while ((m = other.exec(line))) {
    if (m[2] == null) continue
    const book = bookOf(m[1].replace(/\s+/g, ' ').trim())
    if (!book) continue
    const [lo, hi] = span(m[3], m[4])
    out.push({ book, ch: Number(m[2]), lo, hi })
  }
  return out
}

// --- Pont FOLIO : source:{book,page} des .json → citation {book, ch, lo, hi} (#434) ---
const BOOK_ABBRS = new Set(BOOKS.map(([a]) => a))

/** Map slug (`books.json.id`) → abbr canonique (`BOOKS`). Fail-fast : toute `abbr` de `books.json`
 *  absente de `BOOKS` = erreur (source unique du mapping, jamais une 2e table à la main). */
export function buildAbbrMap(books) {
  const bySlug = new Map()
  const knownIds = new Set()
  for (const b of books) {
    if (!b || typeof b.id !== 'string') continue
    knownIds.add(b.id)
    if (!b.dir) continue // seuls les livres EXTRAITS (avec dossier Source) portent le pont folio ; les 29 ont un abbr désormais
    if (!BOOK_ABBRS.has(b.abbr)) throw new Error(`books.json: abbr inconnue de BOOKS pour "${b.id}" → "${b.abbr}"`)
    bySlug.set(b.id, b.abbr)
  }
  return { abbrOf: bySlug, knownIds }
}
export function loadAbbrMap(path = BOOKS_JSON_PATH) {
  return buildAbbrMap(JSON.parse(readFileSync(path, 'utf8')))
}

const JSON_ID_RE = /"id"\s*:\s*"([^"]+)"/
const JSON_BOOK_RE = /"book"\s*:\s*"([^"]+)"/
const JSON_PAGE_RE = /"page"\s*:\s*(-?\d+)/

/** Extrait de `content` (.json) les citations FOLIO : chaque `source:{book,page}` est rattachée à
 *  l'entité PORTEUSE — l'`id` de l'objet ENGLOBANT le plus proche par profondeur d'accolades, jamais
 *  un `id` de référence emboîtée (`skill:{id}`, `talent:{id}`…) dont la portée est déjà refermée.
 *  Sa citation = {book:abbr, ch, lo, hi} de la plage folio (via `resolve(slug, page)`). `stats` (par
 *  abbr : resolved/notFound/ambiguous ; globaux : noAtlas/noPage) est mut é en place. `slug` inconnu
 *  de `knownIds` = fail-fast. */
export function folioCitationsFromJson(rel, content, { abbrOf, knownIds, stats }) {
  const out = []
  const lines = content.split('\n')
  const idAt = []            // idAt[d] = id de l'objet ouvert à la profondeur d (portées refermées purgées)
  const ID_G = new RegExp(JSON_ID_RE.source, 'g')
  const BOOK_G = new RegExp(JSON_BOOK_RE.source, 'g')
  let depth = 0, inString = false, escaped = false
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const events = []
    let m
    ID_G.lastIndex = 0
    while ((m = ID_G.exec(line))) events.push({ at: m.index, kind: 'id', v: m[1] })
    BOOK_G.lastIndex = 0
    const bm = BOOK_G.exec(line)
    if (bm) events.push({ at: bm.index, kind: 'book', v: bm[1] })
    events.sort((a, b) => a.at - b.at)
    let e = 0
    for (let c = 0; c <= line.length; c++) {
      while (e < events.length && events[e].at === c) {
        const ev = events[e++]
        if (ev.kind === 'id') { idAt.length = depth; idAt[depth] = ev.v; continue }
        const slug = ev.v
        if (!knownIds.has(slug)) throw new Error(`${rel}:${i + 1} source.book inconnu de books.json : "${slug}"`)
        let page = null
        const pm = JSON_PAGE_RE.exec(line)
        if (pm) page = Number(pm[1])
        else for (let j = i + 1; j < Math.min(lines.length, i + 3); j++) { const p = JSON_PAGE_RE.exec(lines[j]); if (p) { page = Number(p[1]); break } }
        if (page == null) { stats.noPage++; continue }
        const abbr = abbrOf.get(slug)
        if (!abbr) { stats.noAtlas++; continue }
        const s = stats.byBook.get(abbr) || { resolved: 0, notFound: 0, ambiguous: 0 }
        stats.byBook.set(abbr, s)
        const r = folioRange(abbr, page)
        if (r === 'ambiguous') { s.ambiguous++; continue }
        if (r == null) { s.notFound++; continue }
        s.resolved++
        let porteur = null
        for (let d = Math.min(depth, idAt.length - 1); d >= 0; d--) if (idAt[d] != null) { porteur = idAt[d]; break }
        out.push({ book: abbr, ch: r.ch, lo: r.lo, hi: r.hi, file: rel, row: i + 1, isTs: false, sym: porteur, folio: true })
      }
      if (c === line.length) break
      const ch = line[c]
      if (inString) {
        if (escaped) escaped = false
        else if (ch === '\\') escaped = true
        else if (ch === '"') inString = false
      } else if (ch === '"') inString = true
      else if (ch === '{' || ch === '[') depth++
      else if (ch === '}' || ch === ']') { depth--; if (idAt.length > depth + 1) idAt.length = depth + 1 }
    }
  }
  return out
}

/** Nom de la déclaration top-level d'une ligne, ou null. */
export function declNameOf(line) {
  const m = DECL_RE.exec(line)
  return m ? m[1] : null
}

/** Symbole englobant la ligne `row` (1-based) : déclaration précédente, SAUF si la citation est dans
 *  un bloc de commentaire contigu à la déclaration SUIVANTE (≤15 lignes) → JSDoc d'en-tête. */
export function symbolFor(lines, row) {
  for (let k = row + 1; k <= lines.length && k <= row + 15; k++) {
    const name = declNameOf(lines[k - 1])
    if (name) {
      let allComment = true
      for (let t = row; t < k; t++) if (!COMMENT_OR_BLANK.test(lines[t - 1])) { allComment = false; break }
      if (allComment) return name
      break
    }
    if (!COMMENT_OR_BLANK.test(lines[k - 1])) break
  }
  for (let k = row; k >= 1; k--) {
    const name = declNameOf(lines[k - 1])
    if (name) return name
  }
  return null
}

/** Une citation de code matche une réf de topic ssi même livre+chapitre ET intersection non vide
 *  entre `[lo-tol, hi+tol]` de la réf et `[lo, hi]` de la citation. `tol` par défaut = `TOL`. */
export function refMatches(topicRef, cit, tol = TOL) {
  return (
    topicRef.book === cit.book &&
    topicRef.ch === cit.ch &&
    topicRef.lo - tol <= cit.hi &&
    cit.lo <= topicRef.hi + tol
  )
}

/** Longueur d'intersection (en lignes) entre deux spans `[lo,hi]` (0 si disjoints). */
function spanOverlap(aLo, aHi, bLo, bHi) {
  const lo = Math.max(aLo, bLo), hi = Math.min(aHi, bHi)
  return hi >= lo ? hi - lo + 1 : 0
}

/** Règle folio-EXCLUSIVE (#434, EXPÉRIENCE — flag `--folio-exclusive`, JAMAIS par défaut) : une
 *  citation FOLIO n'est attribuée qu'au(x) topic(s) de MEILLEUR RECOUVREMENT — parmi les topics dont
 *  les réfs (avec `tol`) intersectent la plage folio, seul(s) le(s) recouvrement(s) MAXIMAL(aux)
 *  (longueur d'intersection brute réfs↔plage) la reçoivent ; égalité = tous les ex æquo la gardent.
 *  Retourne Map<cit, Set<topic>>. Citations de LIGNE (code) non concernées.
 *  MESURE 2026-07-16 (`--dry --folio-exclusive`) : NE SÉPARE PAS → non adopté. Le décalage folio↔fiche
 *  fait que colique (réf fiche `MSRC 16 l.109-111`, HORS de sa plage folio `l.65-105`) a un recouvrement
 *  NUL avec sa propre citation → volée par le voisin `vers-de-carie` (réf l.71-86, recouvre 16 l.) →
 *  colique RÉGRESSE en non implémenté ; et 2 dettes (dernieres-nouvelles/semer-la-dissension) restent
 *  implémentées. Gardé en expérience derrière le flag ; le vrai bruit est documenté à part. */
export function computeFolioWinners(fiches, index, tol = TOL) {
  const topics = []
  for (const fi of fiches) for (const f of fi.parsed.fields) topics.push({ topic: f.topic, refs: f.refs })
  const winners = new Map()
  for (const c of index.impl) {
    if (!c.folio) continue
    let best = -1
    const scored = []
    for (const t of topics) {
      let overlap = 0, matches = false
      for (const r of t.refs) {
        if (r.book !== c.book || r.ch !== c.ch) continue
        if (refMatches(r, c, tol)) matches = true
        overlap += spanOverlap(r.lo, r.hi, c.lo, c.hi)
      }
      if (matches) { scored.push({ topic: t.topic, overlap }); if (overlap > best) best = overlap }
    }
    winners.set(c, new Set(scored.filter((s) => s.overlap === best).map((s) => s.topic)))
  }
  return winners
}

/** Fusionne des spans `[lo,hi]` qui se CHEVAUCHENT (pas les adjacents). */
export function mergeSpans(spans) {
  const sorted = [...spans].sort((a, b) => a[0] - b[0] || a[1] - b[1])
  const out = []
  for (const [lo, hi] of sorted) {
    const last = out[out.length - 1]
    if (last && lo <= last[1]) last[1] = Math.max(last[1], hi)
    else out.push([lo, hi])
  }
  return out
}
const fmtSpan = ([lo, hi]) => (lo === hi ? `l.${lo}` : `l.${lo}-${hi}`)

/** Masque des blocs du champ `**Implémente**` d'une fiche : pour `lines`, retourne `isHeader[i]`
 *  (ligne d'ouverture `FIELD_START_RE`), `inFieldBlock[i]` (dans un bloc), `endIdxOf[i]` (fin
 *  exclusive du bloc ouvert en `i`). Un bloc court de sa ligne d'en-tête à la première ligne VIDE ou
 *  HEADING (exclue). Frontière PARTAGÉE — la garde de prose d'état (citation-graphy-guard) l'importe. */
export function fieldBlockMask(lines) {
  const isHeader = lines.map((ln) => FIELD_START_RE.test(ln))
  const inFieldBlock = new Array(lines.length).fill(false)
  const endIdxOf = new Array(lines.length).fill(-1)
  for (let i = 0; i < lines.length; i++) {
    if (!isHeader[i]) continue
    let j = i + 1
    while (j < lines.length && lines[j].trim() !== '' && !HEADING_RE.test(lines[j])) j++
    endIdxOf[i] = j
    for (let k = i; k < j; k++) inFieldBlock[k] = true
  }
  return { isHeader, inFieldBlock, endIdxOf }
}

/** Parse une fiche : champs Implémente (topic, bloc, réfs collectées) + anomalies non-début-de-ligne. */
export function parseFiche(basename, content) {
  const lines = content.split('\n')
  const fields = []
  const anomalies = []
  const slugCount = new Map()
  const stem = basename.replace(/\.md$/, '')

  const { isHeader, inFieldBlock, endIdxOf } = fieldBlockMask(lines)

  let nearestHeading = null
  let pending = []
  for (let i = 0; i < lines.length; i++) {
    const ln = lines[i]
    const h = HEADING_RE.exec(ln)
    if (h) {
      nearestHeading = h[2].trim()
      if (h[1].length === 2) pending = []
      // Réfs portées par la ligne de heading (`### Racine des Tombes (MSRC 04 l.204-229)`) : rattachées
      // au segment que ce heading OUVRE (dans `pending`, consommé par le prochain champ) — jamais au
      // topic précédent (son champ a déjà vidé `pending`). Corrige les topics dont la SEULE réf vit
      // dans leur titre (sinon `refs = []`, « non implémenté » mécanique quel que soit le code).
      for (const r of refsWithSpans(ln)) pending.push(r)
      continue
    }
    if (!isHeader[i] && !/^\s*>/.test(ln) && FIELD_ANYWHERE_RE.test(ln)) {
      anomalies.push({ doc: basename, row: i + 1, text: ln.trim().slice(0, 160) })
    }
    if (isHeader[i]) {
      const slug = slugify(nearestHeading || stem)
      const n = (slugCount.get(slug) || 0) + 1
      slugCount.set(slug, n)
      const topic = `${stem}#${slug}${n > 1 ? '-' + n : ''}`
      // `heading` = le titre VERBATIM d'où le slug du topic est tiré, exposé ici pour que personne
      // n'ait à re-dériver l'appariement titre↔topic (cf. `headingForTopic`).
      fields.push({ topic, heading: nearestHeading || stem, headerIdx: i, endIdx: endIdxOf[i], refs: pending })
      pending = []
      continue
    }
    if (inFieldBlock[i]) continue
    for (const r of refsWithSpans(ln)) pending.push(r)
  }
  return { fields, anomalies }
}

function walkSrc(dir, acc = []) {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e)
    let s
    try { s = statSync(p) } catch { continue }
    if (s.isDirectory()) { if (e !== 'node_modules') walkSrc(p, acc) }
    else if (/\.(tsx?|json)$/.test(e)) acc.push(p)
  }
  return acc
}

/** Index du code : citations non-test / test, lignes des .ts(x) (symboles), textes non-test (appelants).
 *  `abbrMap` (optionnel, `loadAbbrMap()`) active le pont FOLIO des `.json` : chaque `source:{book,page}`
 *  devient une citation `impl` (id = symbole), stats folio accumulées dans `folioStats`. */
export function indexCode(srcDir = SRC_DIR, abbrMap = null) {
  const impl = []
  const tests = []
  const fileLines = new Map()       // rel -> lines[]  (.ts/.tsx)
  const nonCommentText = new Map()  // rel -> lignes NON-commentaires jointes (non-test, pour les appelants)
  const folioStats = { byBook: new Map(), noAtlas: 0, noPage: 0 }
  for (const f of walkSrc(srcDir)) {
    const rel = f.replace(/\\/g, '/')
    if (isExcludedSrc(rel)) continue
    const isTest = /\.(test|spec)\./.test(rel)
    const content = readFileSync(f, 'utf8')
    const lines = content.split('\n')
    const isTs = /\.tsx?$/.test(rel)
    if (isTs) fileLines.set(rel, lines)
    if (!isTest) nonCommentText.set(rel, lines.filter((ln) => !COMMENT_OR_BLANK.test(ln)).join('\n'))
    lines.forEach((ln, i) => {
      for (const r of refsWithSpans(ln)) (isTest ? tests : impl).push({ ...r, file: rel, row: i + 1, isTs })
    })
    if (abbrMap && !isTest && rel.endsWith('.json')) {
      for (const c of folioCitationsFromJson(rel, content, { ...abbrMap, stats: folioStats })) impl.push(c)
    }
  }
  return { impl, tests, fileLines, nonCommentText, folioStats }
}

/** Un symbole EXPORTÉ est « sans appelant » ssi aucune occurrence `\b<nom>\b` HORS commentaire dans
 *  un autre fichier src non-test, NI dans son propre fichier en dehors de sa déclaration. Un symbole
 *  non exporté (usage local uniquement) n'est JAMAIS flagué. */
export function isDeadExport(name, defFile, index) {
  const defLines = index.fileLines.get(defFile)
  if (!defLines) return false
  let declIdx = -1
  let exported = false
  for (let i = 0; i < defLines.length; i++) {
    const dn = declNameOf(defLines[i])
    if (dn === name) { declIdx = i; exported = /^export\b/.test(defLines[i]); break }
  }
  if (declIdx < 0 || !exported) return false
  const re = new RegExp(`\\b${esc(name)}\\b`)
  for (let i = 0; i < defLines.length; i++) {
    if (i === declIdx || COMMENT_OR_BLANK.test(defLines[i])) continue
    if (re.test(defLines[i])) return false // appelant local (hors commentaire, hors déclaration)
  }
  for (const [rel, text] of index.nonCommentText) {
    if (rel === defFile) continue
    if (re.test(text)) return false // appelant dans un autre fichier non-test (hors commentaire)
  }
  return true
}

/** Rend le bloc (lignes) d'un champ pour un topic. Déterministe. */
export function renderBlock(field, ctx) {
  const { index, closure, manifestByTopic } = ctx
  const { impl, tests } = index
  const tol = ctx.tol ?? TOL
  const refs = field.refs
  // Règle folio-exclusive (expérience) : une citation FOLIO ne compte pour CE topic que s'il fait
  // partie de ses gagnants au meilleur recouvrement (`computeFolioWinners`). OFF → comportement d'origine.
  const folioOk = (c) =>
    !c.folio || !ctx.folioExclusive || (ctx.folioWinners && ctx.folioWinners.get(c)?.has(field.topic))

  const refGroups = new Map() // 'BOOK|CH' -> { book, ch, refs:[] }
  for (const ref of refs) {
    const key = ref.book + '|' + ref.ch
    if (!refGroups.has(key)) refGroups.set(key, { book: ref.book, ch: ref.ch, refs: [] })
    refGroups.get(key).refs.push(ref)
  }

  const bullets = []       // { book, ch, order, text }
  const sansCodeGroups = new Map() // 'BOOK|CH' -> { book, ch, spans:[] }
  for (const g of refGroups.values()) {
    const matchedSpans = []
    const citMap = new Map() // file:row -> cit
    for (const ref of g.refs) {
      const matched = impl.filter((c) => c.book === g.book && c.ch === g.ch && refMatches(ref, c, tol) && folioOk(c))
      if (matched.length) {
        matchedSpans.push([ref.lo, ref.hi])
        for (const c of matched) citMap.set(c.file + ':' + c.row, c)
      } else {
        const k = ref.book + '|' + ref.ch
        if (!sansCodeGroups.has(k)) sansCodeGroups.set(k, { book: ref.book, ch: ref.ch, spans: [] })
        sansCodeGroups.get(k).spans.push([ref.lo, ref.hi])
      }
    }
    if (!matchedSpans.length) continue
    bullets.push(buildMatchBullet(g, matchedSpans, [...citMap.values()], { index, closure }))
  }
  bullets.sort((a, b) => (BOOK_ORDER.get(a.book) ?? 99) - (BOOK_ORDER.get(b.book) ?? 99) || a.ch - b.ch)

  const manifest = manifestByTopic.get(field.topic)
  const manifestBullets = []
  if (manifest) {
    if (manifest.ticket) manifestBullets.push(`- dette : ${manifest.ticket}`)
    if (manifest.bloque) manifestBullets.push(`- bloqué : ${manifest.bloque}`)
  }

  const out = []
  if (bullets.length) {
    out.push(`**Implémente :** ${GEN_TAG}`)
    for (const b of bullets) out.push(b.text)
    const sansCode = renderSansCode([...sansCodeGroups.values()])
    if (sansCode) out.push(sansCode)
  } else {
    out.push(`**Implémente :** ${NOT_IMPL}`)
    const testFiles = new Set()
    for (const ref of refs) for (const c of tests) if (refMatches(ref, c, tol)) testFiles.add(c.file)
    if (testFiles.size) {
      const list = [...testFiles].sort()
      const shown = list.slice(0, 4).map((f) => `\`${f}\``)
      if (list.length > 4) shown.push(`+${list.length - 4}`)
      out.push(`- cité par tests seulement : ${shown.join(', ')}`)
    }
  }
  out.push(...manifestBullets)
  return out
}

function buildMatchBullet(g, matchedSpans, cits, { index, closure }) {
  const spans = mergeSpans(matchedSpans)
  const symFirstRow = new Map()
  const files = new Set()
  for (const c of cits) {
    files.add(c.file)
    // Symbole : déclaration englobante pour les .ts(x) ; id d'entrée porté par la citation FOLIO des .json.
    const name = c.isTs ? symbolFor(index.fileLines.get(c.file), c.row) : c.sym
    if (name) {
      const cur = symFirstRow.get(name)
      // Départage TOTAL : à `row` égal entre deux fichiers, le chemin lexicographiquement plus petit
      // fixe `defFile` — sinon le premier VU gagne, et `defFile` alimente `isDeadExport` (⚠sans-appelant).
      if (cur == null || c.row < cur.row || (c.row === cur.row && c.file < cur.defFile)) symFirstRow.set(name, { row: c.row, defFile: c.file })
    }
  }
  const symbols = [...symFirstRow.entries()]
    .sort((a, b) => a[1].row - b[1].row || a[0].localeCompare(b[0]))
    .map(([name, info]) => {
      const dead = isDeadExport(name, info.defFile, index)
      return `\`${name}\`${dead ? ' ⚠sans-appelant' : ''}`
    })
  const fileToks = [...files].sort().map((f) => `\`${f}\`${closure.has(f) ? '' : ' ⚠hors-app'}`)

  const symShown = symbols.slice(0, 10)
  if (symbols.length > 10) symShown.push(`+${symbols.length - 10}`)
  const fileShown = fileToks.slice(0, 6)
  if (fileToks.length > 6) fileShown.push(`+${fileToks.length - 6} fichiers`)

  const after = symShown.length ? `${symShown.join(', ')} — ${fileShown.join(', ')}` : fileShown.join(', ')
  return { book: g.book, ch: g.ch, text: `- \`${g.book} ${g.ch}\` (${spans.map(fmtSpan).join(', ')}) → ${after}` }
}

function renderSansCode(groups) {
  if (!groups.length) return null
  groups.sort((a, b) => (BOOK_ORDER.get(a.book) ?? 99) - (BOOK_ORDER.get(b.book) ?? 99) || a.ch - b.ch)
  const parts = []
  let count = 0
  let overflow = 0
  for (const g of groups) {
    const merged = mergeSpans(g.spans)
    const take = merged.slice(0, Math.max(0, 8 - count))
    if (take.length) {
      parts.push(`\`${g.book} ${g.ch}\` (${take.map(fmtSpan).join(', ')})`)
      count += take.length
    }
    overflow += merged.length - take.length
  }
  let line = `- sans code : ${parts.join(', ')}`
  if (overflow > 0) line += ` +${overflow}`
  return line
}

/** Régénère le contenu d'une fiche (SEULS les blocs de champs changent). */
export function regenerateFiche(basename, content, ctx) {
  const { fields } = parseFiche(basename, content)
  if (!fields.length) return content
  const lines = content.split('\n')
  const reps = fields.map((f) => ({ f, block: renderBlock(f, ctx) })).sort((a, b) => b.f.headerIdx - a.f.headerIdx)
  for (const { f, block } of reps) lines.splice(f.headerIdx, f.endIdx - f.headerIdx, ...block)
  return lines.join('\n')
}

/**
 * Titre (heading VERBATIM) de la fiche qui porte un topic `<fiche>#<slug>`. Passe par `parseFiche` —
 * donc par la MÊME dérivation de topic que le générateur, disambiguation `-N` comprise : aucun second
 * slugify parallèle ne peut diverger. Fail-fast si la fiche ou le topic n'existe pas.
 * Consommé par la migration `2026-08-28-l1b-10b-rawmanifest-label.mjs` et par sa garde.
 */
export function headingForTopic(topic, rawDir = RAWDIR) {
  const stem = String(topic).split('#')[0]
  const { fields } = parseFiche(stem, readFileSync(join(rawDir, `${stem}.md`), 'utf8'))
  const hit = fields.filter((f) => f.topic === topic)
  if (hit.length !== 1) throw new Error(`topic « ${topic} » : ${hit.length} champ(s) dans ${stem}.md (1 attendu)`)
  return hit[0].heading
}

/** Charge + valide le manifest éditorial (fail-fast). `knownTopics` = Set des topics des fiches. */
export function loadManifest(knownTopics, path = MANIFEST_PATH) {
  const arr = JSON.parse(readFileSync(path, 'utf8'))
  return validateManifest(arr, knownTopics)
}
export function validateManifest(arr, knownTopics) {
  const byTopic = new Map()
  const errors = []
  // L'entrée de manifest porte son identité en `id` ; sa VALEUR vit dans l'espace des topics de
  // fiches (`domaine#sujet`), d'où la confrontation à `knownTopics` ci-dessous.
  for (const e of arr) {
    if (!e.id) { errors.push(`entrée manifest sans id : ${JSON.stringify(e)}`); continue }
    if (byTopic.has(e.id)) errors.push(`id dupliqué dans le manifest : ${e.id}`)
    if (!e.ticket && !e.bloque) errors.push(`entrée manifest sans ticket ni bloque : ${e.id}`)
    if (knownTopics && !knownTopics.has(e.id)) errors.push(`id inconnu des fiches : ${e.id}`)
    byTopic.set(e.id, e)
  }
  if (errors.length) {
    const msg = `raw.manifest.json — ${errors.length} erreur(s) d'intégrité :\n  ${errors.join('\n  ')}`
    throw new Error(msg)
  }
  return byTopic
}

/** Contexte complet (index code + closure + manifest) + parse de toutes les fiches. */
export function buildContext({ rawDir = RAWDIR, srcDir = SRC_DIR, manifestPath = MANIFEST_PATH, booksPath = BOOKS_JSON_PATH } = {}) {
  const index = indexCode(srcDir, loadAbbrMap(booksPath))
  const closure = closureOf([APP_ROOT_MODULE])
  const docs = readdirSync(rawDir).filter(isFicheDoc)
  const fiches = docs.map((doc) => {
    const content = readText(join(rawDir, doc))
    return { doc, content, parsed: parseFiche(doc, content) }
  })
  const knownTopics = new Set()
  for (const fi of fiches) for (const f of fi.parsed.fields) knownTopics.add(f.topic)
  const manifestByTopic = loadManifest(knownTopics, manifestPath)
  const folioWinners = computeFolioWinners(fiches, index)
  return { index, closure, manifestByTopic, fiches, rawDir, folioWinners }
}

/** Stats + rendu par topic (pour --dry / stdout). */
export function computeAll(ctx) {
  const perTopic = []
  const anomalies = []
  for (const fi of ctx.fiches) {
    for (const a of fi.parsed.anomalies) anomalies.push(a)
    for (const f of fi.parsed.fields) {
      const block = renderBlock(f, ctx)
      const implemented = block[0].includes(GEN_TAG)
      const testsOnly = block.some((l) => l.startsWith('- cité par tests seulement'))
      let files = 0
      if (implemented) {
        const set = new Set()
        for (const l of block) for (const m of l.matchAll(/`(src\/[^`]+)`/g)) set.add(m[1])
        files = set.size
      }
      perTopic.push({ topic: f.topic, implemented, testsOnly, files })
    }
  }
  return { perTopic, anomalies }
}

/** Garde #434 (Sens B) : tout topic rendu `(non implémenté)` (dette ou blocage RÉEL) DOIT porter une
 *  entrée de manifest (`ticket` ou `bloque`, garanti par `validateManifest`). Retourne les topics
 *  ORPHELINS (non implémenté SANS entrée) — un topic implémenté n'est jamais orphelin. */
export function findManifestOrphans(ctx, all = computeAll(ctx)) {
  return all.perTopic.filter((t) => !t.implemented && !ctx.manifestByTopic.has(t.topic)).map((t) => t.topic)
}

function printOrphans(orphans) {
  console.error(`raw:implemente — ${orphans.length} topic(s) NON IMPLÉMENTÉ(s) sans entrée de manifest :`)
  for (const t of orphans) console.error(`  ${t}`)
  console.error('  → ticketer la dette (entrée `ticket`) ou consigner le blocage (entrée `bloque`) dans src/data/raw.manifest.json.')
}

function printStats(ctx, { perTopic, anomalies }, touched) {
  const impl = perTopic.filter((t) => t.implemented).length
  const testsOnly = perTopic.filter((t) => !t.implemented && t.testsOnly).length
  const notImpl = perTopic.length - impl - testsOnly
  console.log(`fiches : ${touched}/${ctx.fiches.length} · champs : ${perTopic.length} · implémentés : ${impl} · non implémentés : ${notImpl} · tests seulement : ${testsOnly} · anomalies (non-début-de-ligne) : ${anomalies.length}`)
  for (const a of anomalies) console.log(`  anomalie ${a.doc}:${a.row} — ${a.text}`)
  printFolioStats(ctx.index.folioStats)
}

function printFolioStats(fs) {
  if (!fs) return
  const rows = [...fs.byBook.entries()].sort((a, b) => a[0].localeCompare(b[0]))
  let R = 0, N = 0, A = 0
  for (const [, s] of rows) { R += s.resolved; N += s.notFound; A += s.ambiguous }
  console.log(`folio : ${R} résolus · ${N} introuvables · ${A} ambigus · ${fs.noAtlas} hors-Atlas (slug sans abbr) · ${fs.noPage} sans page`)
  for (const [book, s] of rows) console.log(`  ${book} : ${s.resolved} résolus · ${s.notFound} introuvables · ${s.ambiguous} ambigus`)
}

function main() {
  const args = process.argv.slice(2)
  const CHECK = args.includes('--check')
  const DRY = args.includes('--dry')
  const ctx = buildContext()
  ctx.folioExclusive = args.includes('--folio-exclusive') // expérience #434 (mesure avant adoption)

  const all = computeAll(ctx)
  const orphans = findManifestOrphans(ctx, all)

  const regenerated = ctx.fiches.map((fi) => ({ doc: fi.doc, content: regenerateFiche(fi.doc, fi.content, ctx), orig: fi.content }))
  const touched = regenerated.filter((r) => r.content !== r.orig)

  if (DRY) {
    printStats(ctx, all, touched.length)
    if (orphans.length) printOrphans(orphans)
    console.log('--- topics ---')
    for (const t of all.perTopic) {
      const state = t.implemented ? `implémenté(${t.files} fichiers)` : t.testsOnly ? 'tests seulement' : 'non implémenté'
      console.log(`${t.topic} → ${state}`)
    }
    return
  }

  if (CHECK) {
    let failed = false
    if (touched.length) {
      console.error(`raw:implemente — ${touched.length} fiche(s) PÉRIMÉE(s) (champ Implémente divergent du code) :`)
      for (const r of touched) console.error(`  docs/raw/${r.doc}`)
      console.error('  → relancer `npm run raw:implemente` et committer.')
      failed = true
    }
    if (orphans.length) { printOrphans(orphans); failed = true }
    if (failed) process.exit(1)
    console.log('raw:implemente — OK (champs Implémente à jour · tout non-implémenté ticketé)')
    return
  }

  for (const r of touched) writeFileSync(join(ctx.rawDir, r.doc), r.content)
  printStats(ctx, all, touched.length)
  if (orphans.length) { printOrphans(orphans); process.exit(1) }
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isMain) main()
