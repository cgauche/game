// Amorce l'ancrage folio d'un livre VIERGE — aucun `<span … data-folio>` (#833, cas VDM).
// `anchor-fill.mjs` DÉRIVE l'offset id↔folio des ancres déjà posées : sur un livre sans la moindre
// ancre il n'a rien à dériver. Ce script fournit l'amorce manquante :
//   1. il LIT le folio imprimé sur chaque page du PDF (pypdf via `lib/pdf-extract.py`) — le folio
//      est un nombre nu isolé en tête ou en pied de la page ;
//   2. il en déduit `offset = K − folio` (K = index pypdf 0-based = numéro d'id Marker) et EXIGE
//      qu'il soit constant sur toutes les pages folioées (une seule valeur, sinon abandon) ;
//   3. il délègue la pose à `runBook()` d'`anchor-fill.mjs` — même convention d'ancre
//      `<span id="page-K-0" data-folio="F"></span>`, même alignement conservateur (match unique
//      exigé, sinon skip rapporté), aucune ancre nue ;
//   4. il régénère `00 - Index.md` en TOC à folios (`— folio N`, format des livres déjà bakés).
//
// Entrée  : <ABBR> de `books.json` (dossier `Source/…` associé) + le PDF du livre — `--pdf <chemin>`
//           quand le nom du PDF diffère de `<dir>.pdf`.
// Sortie  : table des folios lus (K → folio, en runs) + rapport de pose d'`anchor-fill` ; `--apply`
//           écrit les `.md` et l'index, sinon rapport seul.
// Usage   : node scripts/raw/folio-bootstrap.mjs VDM --pdf "Source/les Vents de Magie.pdf" [--apply]
import { writeFileSync, existsSync } from 'node:fs'
import { listerDossier } from '../guards/lib/lister.mjs'
import { join, resolve, basename } from 'node:path'
import { fileURLToPath } from 'node:url'
import { BOOKS, readText } from './_lib.mjs'
import { extractPages, runBook } from './anchor-fill.mjs'

const CHAPTER_RE = /^(\d+) - .*\.md$/
const INDEX_FILE = '00 - Index.md'
const MAX_PROBE = 600            // borne de sondage : au-delà, pypdf renvoie null (page hors PDF)
const FOLIO_LINE_RE = /^(\d{1,4})$/
const EDGE_LINES = 4             // profondeur de recherche du folio en tête et en pied de page
const HEADER_RE = /^\*Pages PDF (\d+)(?:-(\d+))?\*/

// Plage de pages (K, index pypdf 0-based) réellement couverte par les chapitres du livre, lue dans
// leurs en-têtes `*Pages PDF N[-M]*`. Les pages HORS de cette plage (couverture, gardes, cartes de
// fin) ne portent pas la pagination du corps — leurs nombres nus (légendes de carte) sont du bruit.
export function corpusRange(dir) {
  let lo = Infinity
  let hi = -Infinity
  for (const file of listerDossier(dir).filter((f) => CHAPTER_RE.test(f))) {
    const m = HEADER_RE.exec(readText(join(dir, file)).split('\n')[0] || '')
    if (!m) continue
    lo = Math.min(lo, Number(m[1]) - 1)
    hi = Math.max(hi, (m[2] ? Number(m[2]) : Number(m[1])) - 1)
  }
  return lo <= hi ? { lo, hi } : null
}

// Folio IMPRIMÉ d'une page : nombre nu isolé sur sa ligne, dans les `EDGE_LINES` premières ou
// dernières lignes non vides. `null` = page sans numéro lisible (planche pleine page, ouverture de
// chapitre non foliotée) — jamais une valeur devinée.
export function readPrintedFolio(pageText) {
  if (!pageText) return null
  const lines = pageText.split('\n').map((l) => l.trim()).filter(Boolean)
  const head = lines.slice(0, EDGE_LINES)
  const tail = lines.slice(-EDGE_LINES)
  for (const l of [...head, ...tail]) {
    const m = FOLIO_LINE_RE.exec(l)
    if (m) return Number(m[1])
  }
  return null
}

// Offset K−folio du livre. `ok:false` si aucune page folioée, ou si l'offset n'est pas unique
// (livre à pagination composite : la pose au jugé est refusée, jamais rattrapée par une majorité).
export function resolveOffsetFromPdf(pages) {
  const reads = []
  for (const [k, text] of pages) {
    const folio = readPrintedFolio(text)
    if (folio != null) reads.push({ k, folio, offset: k - folio })
  }
  if (!reads.length) return { ok: false, reason: 'aucun folio imprimé lisible dans le PDF' }
  const byOffset = new Map()
  for (const r of reads) byOffset.set(r.offset, (byOffset.get(r.offset) ?? 0) + 1)
  const sorted = [...byOffset.entries()].sort((a, b) => b[1] - a[1])
  if (sorted.length > 1) {
    const detail = sorted.map(([o, n]) => `${o} (${n} page(s))`).join(', ')
    return { ok: false, reason: `offset K−folio non unique : ${detail}`, reads }
  }
  return { ok: true, offset: sorted[0][0], reads }
}

// Compacte une suite de lectures en runs `K a→b = folio c→d` (rapport lisible sur 200+ pages).
export function folioRuns(reads) {
  const runs = []
  for (const r of reads) {
    const last = runs[runs.length - 1]
    if (last && r.k === last.kTo + 1 && r.folio === last.folioTo + 1) { last.kTo = r.k; last.folioTo = r.folio; continue }
    runs.push({ kFrom: r.k, kTo: r.k, folioFrom: r.folio, folioTo: r.folio })
  }
  return runs
}

// TOC à folios : un chapitre → son PREMIER `data-folio` (format des livres déjà bakés, `— folio N`).
// Nom distinct de `reanchor.mjs#buildIndex` (index ligne/offset d'un texte) : même famille de
// fichiers, sens sans rapport.
export function buildFolioToc(dir, title) {
  const files = listerDossier(dir).filter((f) => CHAPTER_RE.test(f) && f !== INDEX_FILE)
  const rows = []
  for (const file of files) {
    const m = /data-folio="(\d+)"/.exec(readText(join(dir, file)))
    const label = file.replace(/^\d+ - /, '').replace(/\.md$/, '')
    rows.push(`- [${label}](<${file}>)${m ? ` — folio ${m[1]}` : ''}`)
  }
  return `# ${title} — Index\n\n${rows.join('\n')}\n`
}

function main() {
  const args = process.argv.slice(2)
  const abbr = args.find((a) => !a.startsWith('--'))
  const pdfIdx = args.indexOf('--pdf')
  const apply = args.includes('--apply')
  if (!abbr) {
    console.log('Usage: node scripts/raw/folio-bootstrap.mjs <ABBR> [--pdf <chemin>] [--apply]')
    process.exitCode = 1
    return
  }
  const dir = new Map(BOOKS).get(abbr)
  if (!dir) { console.log(`abréviation inconnue de books.json : ${abbr}`); process.exitCode = 1; return }
  const pdfPath = pdfIdx >= 0 ? args[pdfIdx + 1] : `${dir}.pdf`
  if (!existsSync(pdfPath)) { console.log(`PDF introuvable : ${pdfPath}`); process.exitCode = 1; return }

  const corpus = corpusRange(dir)
  if (!corpus) { console.log(`aucun en-tête \`*Pages PDF N[-M]*\` dans ${dir}`); process.exitCode = 1; return }
  if (corpus.hi >= MAX_PROBE) console.log(`AVERTISSEMENT — corpus jusqu'à K ${corpus.hi}, sonde bornée à K ${MAX_PROBE - 1} : les pages au-delà ne seront ni lues ni ancrées (relever MAX_PROBE)`)
  const pages = extractPages(pdfPath, Array.from({ length: MAX_PROBE }, (_, i) => i))
  const all = [...pages.entries()].filter(([, t]) => t != null).sort((a, b) => a[0] - b[0])
  const present = all.filter(([k]) => k >= corpus.lo && k <= corpus.hi)
  console.log(`## ${abbr} — ${basename(pdfPath)} : ${all.length} pages, corpus K ${corpus.lo}–${corpus.hi} (${present.length} pages)`)

  const off = resolveOffsetFromPdf(present)
  if (!off.ok) { console.log(`ABANDON — ${off.reason}`); process.exitCode = 1; return }
  const unread = present.filter(([k]) => !off.reads.some((r) => r.k === k)).map(([k]) => k)
  console.log(`offset K−folio = ${off.offset} (LU sur ${off.reads.length}/${present.length} pages)`)
  console.log('folios lus :')
  for (const r of folioRuns(off.reads)) {
    console.log(`  K ${r.kFrom}${r.kTo > r.kFrom ? `–${r.kTo}` : ''} → folio ${r.folioFrom}${r.folioTo > r.folioFrom ? `–${r.folioTo}` : ''}`)
  }
  if (unread.length) console.log(`pages sans folio imprimé lisible (K) : ${unread.join(', ')}`)

  const result = runBook(abbr, { apply, pdfPath, offset: off.offset })
  if (!result.ok) { console.log(`ABANDON — ${result.reason}`); process.exitCode = 1; return }
  let placed = 0, skipped = 0
  for (const c of result.chapters) {
    if (!c.range) { console.log(`- ${c.file} : pas d'en-tête \`*Pages PDF N[-M]*\``); continue }
    placed += c.placed.length; skipped += c.skipped.length
    const slid = c.placed.filter((p) => p.slide > 0)
    console.log(`- ${c.file} : ✅ ${c.placed.length} · ⏭️ ${c.skipped.length} · déjà là ${c.alreadyCount}`)
    for (const p of slid) console.log(`    ↘️ folio ${p.folio} (l.${p.line}) — ancré sur le candidat décalé de ${p.slide} ligne(s) de tête`)
    for (const s of c.skipped) console.log(`    ❌ folio ${s.folio} — ${s.reason}`)
  }
  console.log(`**Bilan ${abbr} : ✅ ${placed} posées · ⏭️ ${skipped} sautées**`)

  if (apply) {
    const title = basename(dir).replace(/^Warhammer v4 - |^WH - V4 - /, '')
    writeFileSync(join(dir, '00 - Index.md'), buildFolioToc(dir, title))
    console.log(`index réécrit : ${join(dir, '00 - Index.md')}`)
  } else {
    console.log('(--dry par défaut : relancer avec --apply pour écrire)')
  }
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isMain) main()
