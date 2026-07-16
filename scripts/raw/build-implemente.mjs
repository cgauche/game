// Générateur du champ `**Implémente :**` des fiches docs/raw/*.md (#487) : le champ est DÉRIVÉ du
// code (jamais écrit à la main — cf. game-doc-derivee-jamais-ecrite-a-la-main). Patron de
// build-systemes.mjs : manifest éditorial (src/data/raw.manifest.json) + calcul + mode --check qui
// régénère en mémoire, compare au committé, exit 1 sans écrire.
// Re-run : node scripts/raw/build-implemente.mjs (npm run raw:implemente).
import { readdirSync, readFileSync, writeFileSync, statSync, existsSync } from 'node:fs'
import { join, dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { ldbRe, otherRe, span, bookOf, BOOKS } from './_lib.mjs'
import { closureOf } from '../guards/lib/importGraph.mjs'

export const RAWDIR = 'docs/raw'
export const SRC_DIR = 'src'
export const EXCLUDE_SRC_PREFIX = 'src/gameIso/rig/parts/tenues/defs/' // art de couverture, pas une règle
export const MANIFEST_PATH = 'src/data/raw.manifest.json'
export const APP_ROOT_MODULE = 'src/main.tsx'
export const TOL = 10 // fenêtre de match ligne (épreuve 2026-07-16)

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
export const GUARD_LEAK_RE = /\b(?:LDB|MDG|AA|ZI|EDO|EDOC|T2C?|T3|ADE ?I{1,2}|Midd\w*|NAD\w+|Ald\w+|Alt\w+|Uber\w+|Middenheim) ?\d* l\./

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
    out.push({ book: 'LDB', ch: Number(m[1]), lo, hi })
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
 *  entre `[lo-TOL, hi+TOL]` de la réf et `[lo, hi]` de la citation. */
export function refMatches(topicRef, cit) {
  return (
    topicRef.book === cit.book &&
    topicRef.ch === cit.ch &&
    topicRef.lo - TOL <= cit.hi &&
    cit.lo <= topicRef.hi + TOL
  )
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

/** Parse une fiche : champs Implémente (topic, bloc, réfs collectées) + anomalies non-début-de-ligne. */
export function parseFiche(basename, content) {
  const lines = content.split('\n')
  const fields = []
  const anomalies = []
  const slugCount = new Map()
  const stem = basename.replace(/\.md$/, '')

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

  let nearestHeading = null
  let pending = []
  for (let i = 0; i < lines.length; i++) {
    const ln = lines[i]
    const h = HEADING_RE.exec(ln)
    if (h) {
      nearestHeading = h[2].trim()
      if (h[1].length === 2) pending = []
      continue
    }
    if (!isHeader[i] && FIELD_ANYWHERE_RE.test(ln)) {
      anomalies.push({ doc: basename, row: i + 1, text: ln.trim().slice(0, 160) })
    }
    if (isHeader[i]) {
      const slug = slugify(nearestHeading || stem)
      const n = (slugCount.get(slug) || 0) + 1
      slugCount.set(slug, n)
      const topic = `${stem}#${slug}${n > 1 ? '-' + n : ''}`
      fields.push({ topic, headerIdx: i, endIdx: endIdxOf[i], refs: pending })
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

/** Index du code : citations non-test / test, lignes des .ts(x) (symboles), textes non-test (appelants). */
export function indexCode(srcDir = SRC_DIR) {
  const impl = []
  const tests = []
  const fileLines = new Map()   // rel -> lines[]  (.ts/.tsx)
  const nonTestText = new Map() // rel -> texte  (non-test, pour détecter les appelants)
  for (const f of walkSrc(srcDir)) {
    const rel = f.replace(/\\/g, '/')
    if (isExcludedSrc(rel)) continue
    const isTest = /\.(test|spec)\./.test(rel)
    const content = readFileSync(f, 'utf8')
    const lines = content.split('\n')
    const isTs = /\.tsx?$/.test(rel)
    if (isTs) fileLines.set(rel, lines)
    if (!isTest) nonTestText.set(rel, content)
    lines.forEach((ln, i) => {
      for (const r of refsWithSpans(ln)) (isTest ? tests : impl).push({ ...r, file: rel, row: i + 1, isTs })
    })
  }
  return { impl, tests, fileLines, nonTestText }
}

/** Un symbole a-t-il une occurrence `\b<nom>\b` dans un autre fichier src non-test que sa définition ? */
function hasCaller(name, defFile, nonTestText) {
  const re = new RegExp(`\\b${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`)
  for (const [rel, text] of nonTestText) {
    if (rel === defFile) continue
    if (re.test(text)) return true
  }
  return false
}

/** Rend le bloc (lignes) d'un champ pour un topic. Déterministe. */
export function renderBlock(field, ctx) {
  const { index, closure, manifestByTopic } = ctx
  const { impl, tests, fileLines, nonTestText } = index
  const refs = field.refs

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
      const matched = impl.filter((c) => c.book === g.book && c.ch === g.ch && refMatches(ref, c))
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
    bullets.push(buildMatchBullet(g, matchedSpans, [...citMap.values()], { fileLines, nonTestText, closure }))
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
    for (const ref of refs) for (const c of tests) if (refMatches(ref, c)) testFiles.add(c.file)
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

function buildMatchBullet(g, matchedSpans, cits, { fileLines, nonTestText, closure }) {
  const spans = mergeSpans(matchedSpans)
  const symFirstRow = new Map()
  const files = new Set()
  for (const c of cits) {
    files.add(c.file)
    if (c.isTs) {
      const name = symbolFor(fileLines.get(c.file), c.row)
      if (name) {
        const cur = symFirstRow.get(name)
        if (cur == null || c.row < cur.row) symFirstRow.set(name, { row: c.row, defFile: c.file })
      }
    }
  }
  const symbols = [...symFirstRow.entries()]
    .sort((a, b) => a[1].row - b[1].row || a[0].localeCompare(b[0]))
    .map(([name, info]) => {
      const dead = !hasCaller(name, info.defFile, nonTestText)
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

/** Charge + valide le manifest éditorial (fail-fast). `knownTopics` = Set des topics des fiches. */
export function loadManifest(knownTopics, path = MANIFEST_PATH) {
  const arr = JSON.parse(readFileSync(path, 'utf8'))
  return validateManifest(arr, knownTopics)
}
export function validateManifest(arr, knownTopics) {
  const byTopic = new Map()
  const errors = []
  for (const e of arr) {
    if (!e.topic) { errors.push(`entrée manifest sans topic : ${JSON.stringify(e)}`); continue }
    if (byTopic.has(e.topic)) errors.push(`topic dupliqué dans le manifest : ${e.topic}`)
    if (!e.ticket && !e.bloque) errors.push(`entrée manifest sans ticket ni bloque : ${e.topic}`)
    if (knownTopics && !knownTopics.has(e.topic)) errors.push(`topic inconnu des fiches : ${e.topic}`)
    byTopic.set(e.topic, e)
  }
  if (errors.length) {
    const msg = `raw.manifest.json — ${errors.length} erreur(s) d'intégrité :\n  ${errors.join('\n  ')}`
    throw new Error(msg)
  }
  return byTopic
}

/** Contexte complet (index code + closure + manifest) + parse de toutes les fiches. */
export function buildContext({ rawDir = RAWDIR, srcDir = SRC_DIR, manifestPath = MANIFEST_PATH } = {}) {
  const index = indexCode(srcDir)
  const closure = closureOf([APP_ROOT_MODULE])
  const docs = readdirSync(rawDir).filter(isFicheDoc)
  const fiches = docs.map((doc) => {
    const content = readFileSync(join(rawDir, doc), 'utf8')
    return { doc, content, parsed: parseFiche(doc, content) }
  })
  const knownTopics = new Set()
  for (const fi of fiches) for (const f of fi.parsed.fields) knownTopics.add(f.topic)
  const manifestByTopic = loadManifest(knownTopics, manifestPath)
  return { index, closure, manifestByTopic, fiches, rawDir }
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

function printStats(ctx, { perTopic, anomalies }, touched) {
  const impl = perTopic.filter((t) => t.implemented).length
  const testsOnly = perTopic.filter((t) => !t.implemented && t.testsOnly).length
  const notImpl = perTopic.length - impl - testsOnly
  console.log(`fiches : ${touched}/${ctx.fiches.length} · champs : ${perTopic.length} · implémentés : ${impl} · non implémentés : ${notImpl} · tests seulement : ${testsOnly} · anomalies (non-début-de-ligne) : ${anomalies.length}`)
  for (const a of anomalies) console.log(`  anomalie ${a.doc}:${a.row} — ${a.text}`)
}

function main() {
  const args = process.argv.slice(2)
  const CHECK = args.includes('--check')
  const DRY = args.includes('--dry')
  const ctx = buildContext()

  const regenerated = ctx.fiches.map((fi) => ({ doc: fi.doc, content: regenerateFiche(fi.doc, fi.content, ctx), orig: fi.content }))
  const touched = regenerated.filter((r) => r.content !== r.orig)

  if (CHECK) {
    if (touched.length) {
      console.error(`raw:implemente — ${touched.length} fiche(s) PÉRIMÉE(s) (champ Implémente divergent du code) :`)
      for (const r of touched) console.error(`  docs/raw/${r.doc}`)
      console.error('  → relancer `npm run raw:implemente` et committer.')
      process.exit(1)
    }
    console.log('raw:implemente — OK (champs Implémente à jour)')
    return
  }

  const all = computeAll(ctx)
  if (DRY) {
    printStats(ctx, all, touched.length)
    console.log('--- topics ---')
    for (const t of all.perTopic) {
      const state = t.implemented ? `implémenté(${t.files} fichiers)` : t.testsOnly ? 'tests seulement' : 'non implémenté'
      console.log(`${t.topic} → ${state}`)
    }
    return
  }

  for (const r of touched) writeFileSync(join(ctx.rawDir, r.doc), r.content)
  printStats(ctx, all, touched.length)
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isMain) main()
