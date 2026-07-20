// Ré-ancrage des citations de l'Atlas RAW — garde déterministe rejouable.
// Pour chaque réf `<ABRÉV> NN l.X[-Y]` ATTACHÉE à une citation verbatim « … », on relocalise la
// citation par MATCH EXACT (normalisé, accents conservés) dans le `.md` source courant, et on
// vérifie/répare le numéro de ligne (la ré-extraction Marker a fait dériver les anciennes lignes).
//   node scripts/raw/reanchor.mjs            → rapport + GATE (exit 1 sur dérive/ambigu/hausse ❌)
//   node scripts/raw/reanchor.mjs --apply    → réécrit en place les dérives HIGH (citation unique)
// ✅ ligne juste · 🔧 dérive HIGH (auto) · 🟡 ambigu (MEDIUM, manuel) · ❌ introuvable (LOW) ·
// ➖ synthèse (réf sans citation).
// GATE (#434 défaut 1 — « une réf verte peut pointer sur le mauvais texte ») : ce script ne se
// contente plus de MESURER, il BLOQUE sur ses propres verdicts :
//   - 🔧 DRIFT (hors --apply) : dérive réparable non appliquée → doc périmée, comme `docs:systemes
//     --check` — zéro tolérance, il suffit de lancer --apply.
//   - 🟡 MEDIUM : c'est CE verdict qui a produit le bug réel (ZI 13 l.954 auto-résolu vers le
//     candidat le plus proche, alors que le vrai texte vivait en ZI 2 l.68) — zéro tolérance
//     (baseline mesurée à 0 aujourd'hui), jamais d'auto-résolution.
//   - ❌ LOW : la réf MENT (citation introuvable à la ligne annoncée) — cliquet PAR chapitre-réf
//     (`scripts/raw/reanchor-low-baseline.json`, patron `check-refs.mjs`/`dead-refs-baseline.json`) :
//     toute HAUSSE échoue, toute baseline périmée (réfs réparées) doit être ABAISSÉE.
//   - ⛔ PAST-EOF (hors-fichier) : NE PAS doubler — déjà cliqueté par `check-refs.mjs`
//     (`dead-refs-baseline.json`), sur la borne HAUTE dépliée d'une plage (`span`), un sur-ensemble
//     de la borne de départ vérifiée ici.
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFileSync } from 'node:child_process'
import { BOOKS, esc, chapterFile, normalize, ELLIPSIS_SENTINEL as SENT, RAWDOC_META_GENERATED, RAWDOC_AUTHOR_META, isRawEpreuve, readText } from './_lib.mjs'
import { countsByChapterRef, assertAgainstBaseline } from './check-refs.mjs'

const APPLY = process.argv.includes('--apply')
// --remap : ré-ancre les réfs de SYNTHÈSE (sans citation) par alignement de contenu old↔new.
// L'ancienne extraction (celle contre laquelle l'Atlas a été bâti) = la Source de `git HEAD` ;
// la nouvelle (Marker) = l'arbre de travail. Migration ONE-SHOT à lancer APRÈS une ré-extraction,
// AVANT de committer la nouvelle Source (une fois committée, HEAD == arbre → carte identité → no-op).
const REMAP = process.argv.includes('--remap')
const MIN_QUOTE_LEN = 24   // ancre verbatim < 24 car. → trop générique, on n'ancre pas
export const RAWDIR = 'docs/raw'
export const LOW_BASELINE_PATH = join(dirname(fileURLToPath(import.meta.url)), 'reanchor-low-baseline.json')
// On ne traite que les fiches de DOMAINE + catalogues. On saute les rapports générés ET les fichiers
// MÉTA (index, conventions, rapports d'épreuve) dont les réfs sont ILLUSTRATIVES, pas des citations
// vivantes. Deux ensembles PARTAGÉS (#454 DoD, #585 lot A) : source unique `_lib.mjs`.
const isMeta = (f) => RAWDOC_META_GENERATED.has(f) || RAWDOC_AUTHOR_META.has(f) || isRawEpreuve(f)

// Réf unifiée (abrévs de BOOKS, plus longue d'abord ; capture chapitre + début + suffixe -Y/+n).
const ABBR_ALT = BOOKS.map(([a]) => esc(a)).sort((a, b) => b.length - a.length).join('|')
const refRe = () => new RegExp(`\\b(${ABBR_ALT}) (\\d+) l\\.(\\d+)((?:[-+]\\d+)*)`, 'g')

// ---------- index ligne↔offset d'un chapitre source ----------
// `buildIndex` est PUR (aucun accès fichier) — testable en fixture. `lineIndex` l'enrobe de la
// résolution réelle (`chapterFile`) + d'un cache par chapitre.
export function buildIndex(rawLines) {
  const lineStartOffset = []
  let joined = ''
  for (let i = 0; i < rawLines.length; i++) {
    lineStartOffset.push(joined.length)
    joined += normalize(rawLines[i])
    if (i < rawLines.length - 1) joined += ' '   // le saut de ligne se replie en un espace
  }
  return { joined, lineStartOffset, count: rawLines.length }
}
const idxCache = new Map()
function lineIndex(abbr, ch) {
  const cf = chapterFile(abbr, ch)
  if (!cf) return null
  if (idxCache.has(cf.path)) return idxCache.get(cf.path)
  const res = { ...buildIndex(readText(cf.path).split('\n')), file: cf.file }
  idxCache.set(cf.path, res)
  return res
}
export function offsetToLine(off, lso) {
  let lo = 0, hi = lso.length - 1, ans = 0
  while (lo <= hi) { const mid = (lo + hi) >> 1; if (lso[mid] <= off) { ans = mid; lo = mid + 1 } else hi = mid - 1 }
  return ans + 1   // 1-based : rawLines[X-1] est cité l.X
}
function allOccurrences(hay, needle) {
  const out = []; if (!needle) return out
  let i = hay.indexOf(needle)
  while (i !== -1) { out.push(i); i = hay.indexOf(needle, i + 1) }
  return out
}

// ---------- carte de lignes old→new (diff de contenu HEAD ↔ arbre, pour --remap) ----------
// Ancres = lignes normalisées UNIQUES communes aux deux versions ; LIS pour garder la monotonie ;
// interpolation linéaire entre ancres (les lignes ajoutées/supprimées se répartissent proportionnellement).
const mapCache = new Map()
function lineMap(abbr, ch) {
  const cf = chapterFile(abbr, ch)
  if (!cf) return null
  if (mapCache.has(cf.path)) return mapCache.get(cf.path)
  let oldText
  try { oldText = execFileSync('git', ['show', `HEAD:${cf.dir}/${cf.file}`], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }) }
  catch { mapCache.set(cf.path, null); return null }   // absent de HEAD (fichier neuf) → pas de carte
  const fn = buildLineMap(oldText.split('\n'), readText(cf.path).split('\n'))
  mapCache.set(cf.path, fn)
  return fn
}
function buildLineMap(oldLines, newLines) {
  const oldN = oldLines.map(normalize), newN = newLines.map(normalize)
  const tally = (arr) => { const m = new Map(); for (const s of arr) if (s.length >= 8) m.set(s, (m.get(s) || 0) + 1); return m }
  const oc = tally(oldN), nc = tally(newN)
  const newPos = new Map(); newN.forEach((s, j) => { if (nc.get(s) === 1) newPos.set(s, j) })
  const pairs = []   // [oldIdx, newIdx] des lignes uniques communes
  oldN.forEach((s, i) => { if (oc.get(s) === 1 && newPos.has(s)) pairs.push([i, newPos.get(s)]) })
  pairs.sort((a, b) => a[0] - b[0])
  const A = longestIncreasingBySecond(pairs).map(([oi, nj]) => [oi + 1, nj + 1])  // 1-based
  if (A.length < 3) return null   // trop peu d'ancres → on ne remappe pas ce chapitre
  const newCount = newLines.length
  return (X) => {
    if (!(X >= 1)) return null
    let lo = null, hi = null
    for (const a of A) { if (a[0] <= X) lo = a; if (a[0] >= X) { hi = a; break } }
    let y
    if (lo && hi) y = lo[0] === hi[0] ? lo[1] : Math.round(lo[1] + (X - lo[0]) * (hi[1] - lo[1]) / (hi[0] - lo[0]))
    else if (lo) y = X + (lo[1] - lo[0])
    else if (hi) y = X + (hi[1] - hi[0])
    else return null
    return Math.min(Math.max(1, y), newCount)
  }
}
// Plus longue sous-suite croissante par pairs[k][1] (pairs déjà triées par [0]) — patience sort + reconstruction.
function longestIncreasingBySecond(pairs) {
  if (!pairs.length) return []
  const tails = [], tailIdx = [], prev = new Array(pairs.length).fill(-1)
  for (let k = 0; k < pairs.length; k++) {
    const v = pairs[k][1]
    let lo = 0, hi = tails.length
    while (lo < hi) { const mid = (lo + hi) >> 1; if (tails[mid] < v) lo = mid + 1; else hi = mid }
    if (lo > 0) prev[k] = tailIdx[lo - 1]
    tails[lo] = v; tailIdx[lo] = k
  }
  let k = tailIdx[tailIdx.length - 1]; const out = []
  while (k !== -1) { out.push(pairs[k]); k = prev[k] }
  return out.reverse()
}
// Plus longue séquence de mots EN TÊTE de la citation présente dans le texte source. Tolère les
// retouches du build (parenthèse inline supprimée, ponctuation finale ajoutée, préfixe « Note : »
// retiré) qui font échouer le match exact intégral — l'ancre reste un fragment VERBATIM ≥ MIN_QUOTE_LEN.
export function headAnchor(joined, head) {
  const words = head.split(' ').filter(Boolean)
  for (let len = words.length; len >= 1; len--) {
    const a = words.slice(0, len).join(' ')
    if (a.length < MIN_QUOTE_LEN) break
    const occ = allOccurrences(joined, a)
    if (occ.length >= 1) return { occ, anchor: a, full: len === words.length }
  }
  return { occ: [], anchor: null, full: false }
}

// ---------- extraction de la citation précédant une réf ----------
const isBQ = (line) => /^\s*>/.test(line)
const stripBQ = (line) => line.replace(/^\s*>\s?/, '')
// `preceding` = texte (bloc replié) avant le token de réf ; renvoie la citation brute ou null.
function extractQuote(preceding) {
  const close = preceding.lastIndexOf('»')
  if (close === -1) return null
  const gap = preceding.slice(close + 1)                 // entre » et la réf : seulement un séparateur
  if (!/^[\s—–(`'":-]*$/.test(gap)) return null
  const open = preceding.indexOf('«')                    // guillemets imbriqués : 1er « / dernier »
  if (open === -1 || open > close) return null
  return preceding.slice(open + 1, close)
}

// ---------- recherche cross-chapitre (suggestion manuelle sur LOW, jamais auto) ----------
const BOOK_DIR = new Map(BOOKS)
function crossChapter(abbr, head, excludeCh) {
  const dir = BOOK_DIR.get(abbr); if (!dir) return null
  let files
  try { files = readdirSync(dir).filter((f) => /^\d+ - .*\.md$/.test(f)) } catch { return null }
  const hits = []
  for (const f of files) {
    const nn = f.match(/^(\d+) - /)[1]
    if (Number(nn) === Number(excludeCh)) continue
    const li = lineIndex(abbr, nn); if (!li) continue
    const { occ } = headAnchor(li.joined, head)
    if (occ.length === 1) hits.push({ ch: Number(nn), line: offsetToLine(occ[0], li.lineStartOffset) })
  }
  return hits.length === 1 ? hits[0] : null
}

// ---------- classification d'une réf à citation ----------
// PURE : ne prend QUE l'index déjà construit (`li`) et un résolveur cross-chapitre injectable
// (`findCross`) — aucun accès fichier ni à `BOOKS`/`chapterFile`. Testable en fixture (reproduit
// le bug réel « citation absente ici, présente ailleurs » sans toucher Source/).
export function classifyQuote(li, citedStart, rawQuote, findCross) {
  if (!li) return { status: 'NO-SOURCE' }
  const norm = normalize(rawQuote)
  const head = norm.split(SENT)[0].trim()          // 1er segment (avant toute ellipse)
  const { occ, anchor, full } = headAnchor(li.joined, head)
  if (!anchor) {
    const xc = findCross ? findCross(head) : null
    return { status: 'LOW', reason: xc ? `texte trouvé en ${xc.label}` : 'aucune occurrence', li, norm, wrongChapter: xc }
  }
  if (occ.length === 1) {
    const foundStart = offsetToLine(occ[0], li.lineStartOffset)
    return { status: foundStart === citedStart ? 'OK' : 'DRIFT', conf: 'HIGH', foundStart, li, norm, edited: !full }
  }
  // plusieurs occurrences → MEDIUM, candidat le plus proche de la ligne citée
  const cands = occ.map((o) => offsetToLine(o, li.lineStartOffset))
  const nearest = cands.reduce((a, b) => (Math.abs(b - citedStart) < Math.abs(a - citedStart) ? b : a))
  return { status: 'MEDIUM', conf: 'MEDIUM', foundStart: nearest, li, norm, candidates: cands }
}

// ---------- balayage de l'Atlas ----------
// `scan` est le cœur RÉUTILISABLE (CLI ET tests) : parcourt `rawDir`, classe chaque réf, applique
// les réécritures --apply/--remap sur DISQUE (seul effet de bord — pas d'écriture de rapport ici,
// à charge de l'appelant), et renvoie tally + lignes de rapport + les réfs LOW (pour le cliquet).
export function scan(rawDir = RAWDIR, { apply = false, remap = false } = {}) {
  const DOCS = readdirSync(rawDir).filter((f) => f.endsWith('.md') && !isMeta(f))
  const tally = { OK: 0, DRIFT: 0, MEDIUM: 0, LOW: 0, RANGE: 0, 'PAST-EOF': 0, 'NO-SOURCE': 0 }
  let totalRefs = 0, totalQuotes = 0, appliedTotal = 0, remappedTotal = 0
  const lowRows = []   // [{ ref: 'ABBR NN', full, detail }] — unité du cliquet (patron check-refs.mjs)
  const sections = []  // [{ file, rows }] pour le rapport

  for (const file of DOCS.sort()) {
    const path = join(rawDir, file)
    const lines = readText(path).split('\n')
    const rows = []
    const edits = new Map()   // lineIdx -> [{start,end,replacement}]
    const consumed = new Set()  // lignes (index i) dont la citation a déjà été prise (cf. clé ci-dessous)

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      const re = refRe(); let m
      while ((m = re.exec(line))) {
        const [full, abbr, ch, startStr, suffix] = m
        const citedStart = Number(startStr)
        totalRefs++
        // texte précédant la réf (bloc blockquote replié, ou ligne courante)
        let preceding
        if (isBQ(line)) {
          let j = i; while (j - 1 >= 0 && isBQ(lines[j - 1])) j--
          const prefixText = lines.slice(j, i).map(stripBQ).join(' ')
          const prefixLen = line.length - stripBQ(line).length
          preceding = (prefixText ? prefixText + ' ' : '') + stripBQ(line).slice(0, Math.max(0, m.index - prefixLen))
        } else {
          preceding = line.slice(0, m.index)
        }
        // Clé de consommation = la LIGNE de la réf (le `»` de fermeture est toujours sur cette ligne) :
        // une 2ᵉ réf sur la MÊME ligne ne re-prend pas la citation, mais deux lignes-citations empilées
        // dans un même bloc sont vérifiées chacune.
        const rawQuote = consumed.has(i) ? null : extractQuote(preceding)

        if (!rawQuote) {
          // réf de synthèse (sans citation à ancrer) : vérifier la plage + ré-ancrer par diff (--remap)
          const li = lineIndex(abbr, ch)
          if (!li) { rows.push({ full, status: 'NO-SOURCE', detail: 'chapitre source introuvable' }); tally['NO-SOURCE']++; continue }
          const eof = citedStart > li.count
          if (eof) tally['PAST-EOF']++; else tally.RANGE++
          if (remap) {
            const mp = lineMap(abbr, ch)
            const ns = mp ? mp(citedStart) : null
            if (ns && ns !== citedStart) {
              let newSuffix = suffix || ''
              const rg = (suffix || '').match(/^-(\d+)/)
              if (rg) { const ne = mp(Number(rg[1])); newSuffix = `-${ne && ne >= ns ? ne : ns + (Number(rg[1]) - citedStart)}` + suffix.slice(rg[0].length) }
              const newFull = full.replace(`l.${startStr}${suffix || ''}`, `l.${ns}${newSuffix}`)
              if (!edits.has(i)) edits.set(i, [])
              edits.get(i).push({ start: m.index, end: m.index + full.length, replacement: newFull })
              remappedTotal++
              if (eof) rows.push({ full, status: 'PAST-EOF', detail: `→ l.${ns} (ré-ancré par diff)` })
            } else if (eof) rows.push({ full, status: 'PAST-EOF', detail: `l.${citedStart} > ${li.count} lignes (non ré-ancré)` })
          } else if (eof) rows.push({ full, status: 'PAST-EOF', detail: `l.${citedStart} > ${li.count} lignes` })
          continue
        }
        consumed.add(i)
        totalQuotes++
        const li = lineIndex(abbr, ch)
        const findCross = (head) => {
          const xc = crossChapter(abbr, head, ch)
          return xc ? { label: `${abbr} ${xc.ch} l.${xc.line}` } : null
        }
        const r = li ? classifyQuote(li, citedStart, rawQuote, findCross) : { status: 'NO-SOURCE' }
        const snippet = (r.norm || normalize(rawQuote)).slice(0, 46)
        if (r.status === 'OK') { tally.OK++; continue }
        tally[r.status]++
        if (r.status === 'DRIFT') {
          const detail = `« ${snippet}… » → l.${r.foundStart}` + (r.edited ? ' (ancre partielle)' : '')
          rows.push({ full, status: 'DRIFT', cited: citedStart, found: r.foundStart, detail })
          if (apply) {
            // réécrit l.X→l.found ; plage -Y : largeur préservée (translatée du même décalage)
            let newSuffix = suffix || ''
            const rg = (suffix || '').match(/^-(\d+)/)
            if (rg) newSuffix = `-${r.foundStart + (Number(rg[1]) - citedStart)}` + suffix.slice(rg[0].length)
            const newFull = full.replace(`l.${startStr}${suffix || ''}`, `l.${r.foundStart}${newSuffix}`)
            if (!edits.has(i)) edits.set(i, [])
            edits.get(i).push({ start: m.index, end: m.index + full.length, replacement: newFull })
            appliedTotal++
          }
        } else if (r.status === 'MEDIUM') {
          rows.push({ full, status: 'MEDIUM', cited: citedStart, found: r.foundStart, detail: `« ${snippet}… » candidats l.${r.candidates.join('/')} → plus proche l.${r.foundStart}` })
        } else if (r.status === 'LOW') {
          const detail = `« ${snippet}… » — ${r.reason}`
          rows.push({ full, status: 'LOW', cited: citedStart, detail })
          lowRows.push({ ref: `${abbr} ${Number(ch)}`, full, detail })
        } else if (r.status === 'NO-SOURCE') {
          rows.push({ full, status: 'NO-SOURCE', detail: 'chapitre source introuvable' })
        }
      }
    }

    // applique les réécritures (droite→gauche par ligne pour ne pas décaler les offsets)
    if ((apply || remap) && edits.size) {
      for (const [li, es] of edits) {
        es.sort((a, b) => b.start - a.start)
        let s = lines[li]
        for (const e of es) s = s.slice(0, e.start) + e.replacement + s.slice(e.end)
        lines[li] = s
      }
      writeFileSync(path, lines.join('\n'))
    }

    if (rows.length) sections.push({ file, rows })
  }

  return { DOCS, tally, sections, lowRows, totalRefs, totalQuotes, appliedTotal, remappedTotal }
}

// ---------- rapport Markdown (aucun effet de bord de `scan` — écrit ici uniquement) ----------
function buildReport(result, { apply, remap }) {
  const { DOCS, tally, sections, totalRefs, totalQuotes, appliedTotal, remappedTotal } = result
  const out = ['# Atlas RAW — Ré-ancrage des citations', '',
    '> Déterministe (`node scripts/raw/reanchor.mjs` ; `--apply` réécrit les dérives HIGH). GATE (#434) :',
    '> exit 1 sur dérive non appliquée, ambiguïté, ou hausse de réf FAUSSE (❌) — voir en-tête du script.',
    '> Pour chaque citation verbatim « … » d\'une fiche, on relocalise le texte dans le `.md` source',
    '> courant et on vérifie le n° de ligne cité. ✅ juste · 🔧 dérive corrigée (HIGH, unique) · 🟡 ambigu',
    '> (MEDIUM, manuel) · ❌ introuvable (LOW, paraphrase/mauvais chapitre) · ➖ synthèse (réf sans citation).', '']
  const MARK = { OK: '✅', DRIFT: '🔧', MEDIUM: '🟡', LOW: '❌', RANGE: '➖', 'PAST-EOF': '⛔', 'NO-SOURCE': '⚠️' }
  for (const { file, rows } of sections) {
    out.push(`## ${file}`, '', '| Réf | Statut | Détail |', '|---|---|---|')
    for (const r of rows) out.push(`| \`${r.full}\` | ${MARK[r.status]} ${r.status} | ${r.detail} |`)
    out.push('')
  }
  const driftLabel = apply ? `🔧 ${appliedTotal} corrigées` : `🔧 ${tally.DRIFT} dérives (relancer --apply)`
  const remapLabel = remap ? ` · 🧭 ${remappedTotal} synthèses ré-ancrées (diff)` : ''
  out.splice(6, 0,
    `**Bilan : ✅ ${tally.OK} · ${driftLabel} · 🟡 ${tally.MEDIUM} ambigus · ❌ ${tally.LOW} introuvables · ➖ ${tally.RANGE} synthèses${remapLabel}** ` +
    `(⛔ ${tally['PAST-EOF']} hors-fichier · ⚠️ ${tally['NO-SOURCE']} sans source) sur ${totalRefs} réfs · ${totalQuotes} citations · ${DOCS.length} fiches.`, '')
  return out.join('\n')
}

function main() {
  const result = scan(RAWDIR, { apply: APPLY, remap: REMAP })
  const { tally, totalRefs, totalQuotes, appliedTotal, remappedTotal, DOCS, lowRows } = result
  writeFileSync(join(RAWDIR, 'reanchor.md'), buildReport(result, { apply: APPLY, remap: REMAP }))

  const driftLabel = APPLY ? `🔧 ${appliedTotal} corrigées` : `🔧 ${tally.DRIFT} dérives (relancer --apply)`
  const remapLabel = REMAP ? ` · 🧭 ${remappedTotal} synthèses ré-ancrées (diff)` : ''
  console.log(`ré-ancrage : ✅ ${tally.OK} · ${driftLabel} · 🟡 ${tally.MEDIUM} · ❌ ${tally.LOW} · ➖ ${tally.RANGE}${remapLabel} (⛔${tally['PAST-EOF']} ⚠️${tally['NO-SOURCE']})`)
  console.log(`${totalQuotes} citations vérifiées sur ${totalRefs} réfs (${DOCS.length} fiches)` + (REMAP ? ` — ${remappedTotal} synthèses ré-ancrées par diff` : APPLY ? ` — ${appliedTotal} réécrites` : tally.DRIFT ? ` — relancer avec --apply pour corriger ${tally.DRIFT} dérives` : ''))

  // ---------- GATE (#434 défaut 1) ----------
  let fail = false
  if (!APPLY && tally.DRIFT > 0) {
    console.log(`RÉGRESSION — ${tally.DRIFT} dérive(s) 🔧 non appliquée(s) : relancer --apply avant de committer.`)
    fail = true
  }
  if (tally.MEDIUM > 0) {
    console.log(`RÉGRESSION — ${tally.MEDIUM} réf(s) ambiguë(s) 🟡 : trancher manuellement (jamais d'auto-résolution, cf. #434 défaut 1).`)
    fail = true
  }
  const lowCounts = countsByChapterRef(lowRows)
  const baseline = JSON.parse(readFileSync(LOW_BASELINE_PATH, 'utf8'))
  const { over, stale } = assertAgainstBaseline(lowCounts, baseline)
  if (over.length) {
    console.log('RÉGRESSION — hausse de réfs FAUSSES (❌ LOW) par chapitre-réf :')
    for (const o of over) console.log(`  ${o}`)
    fail = true
  }
  if (stale.length) {
    console.log('Baseline(s) LOW PÉRIMÉE(s) (réfs réparées) — à ABAISSER dans reanchor-low-baseline.json :')
    for (const s of stale) console.log(`  ${s}`)
    fail = true
  }
  if (fail) process.exitCode = 1
}

import { resolve } from 'node:path'
const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isMain) main()
