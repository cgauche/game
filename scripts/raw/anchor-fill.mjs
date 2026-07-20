// Aligneur PDF↔MD CONSERVATEUR pour combler les ancres `data-folio` manquantes (#522). L'extraction
// Marker de masse est INTERDITE (docs/raw/00-index.md l.76-81 : ~3000 réfs code décaleraient) — cet
// outil pose des ancres CIBLÉES, sans toucher un seul numéro de ligne (insertion en TÊTE de ligne
// EXISTANTE, jamais de nouvelle ligne).
//
// Principe :
//   1. Livre → dossier `Source/<dir>/` (BOOKS de `_lib.mjs`) → PDF sibling `Source/<dir>.pdf`
//      (dérivé, PAS recopié de `reextract-all.sh` : vérifié — le nommage `dir + '.pdf'` couvre les
//      15 livres sans exception, cf. rapport de session).
//   2. Offset id↔folio PAR LIVRE : chaque ancre existante `id="page-K-0" data-folio="F"` donne
//      `offset = K - F` (K = index pypdf 0-based, identique au numéro d'id Marker). Vérifié CONSTANT
//      sur TOUTES les ancres du livre (tous chapitres confondus) — s'il varie, le livre est SKIPPÉ
//      et rapporté (jamais de pose au jugé sur un livre à offset instable).
//   3. Plage de folios attendue d'un chapitre = l'en-tête `*Pages PDF N[-M]*` (l.1, pages PDF
//      humaines 1-based) convertie en folios via l'offset : `folio = (page_humaine - 1) - offset`.
//      Manquants = plage attendue − folios déjà ancrés dans le fichier.
//   4. Extraction texte : `lib/pdf-extract.py` (pypdf) lit le PDF UNE fois par livre, extrait TOUTES
//      les pages manquantes du livre en un seul appel (indices K = folio + offset).
//   5. Alignement : la tête de page PDF (lignes de contenu, boilerplate écarté — titre de livre/
//      numéro de folio/code de chapitre courts/en-tête de caractéristiques SANS mot de 3+ minuscules)
//      sert de candidat à `headAnchor` de `reanchor.mjs` (RÉUTILISÉ tel quel, même normalisation
//      `_lib.mjs#normalize`) sur un index LOCAL (`buildTightIndex`, cf. plus bas — le texte PDF n'a
//      ni `|` de tableau ni `<br>`, un repli TABLEAU strippe ces symboles côté `.md` pour les pages
//      denses). Match UNIQUE → ancre posée en tête de la ligne trouvée. Absent/multiple/conflit avec
//      un autre chapitre → SKIP + raison, jamais de pose au jugé.
//   6. Idempotent : un folio déjà ancré dans le fichier n'est jamais retraité.
//
// Usage :
//   node scripts/raw/anchor-fill.mjs <ABBR> [--ch NN] [--dry|--apply]
//   --dry (défaut) : rapport seul. --apply : réécrit les .md.
import { readdirSync, readFileSync, writeFileSync, existsSync, mkdtempSync, rmSync } from 'node:fs'
import { join, resolve, dirname } from 'node:path'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'
import { execFileSync } from 'node:child_process'
import { BOOKS, normalize, readText } from './_lib.mjs'
import { offsetToLine, headAnchor } from './reanchor.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
export const PDF_EXTRACT_SCRIPT = join(HERE, 'lib', 'pdf-extract.py')
const CHAPTER_RE = /^(\d+) - .*\.md$/
const HEADER_RE = /^\*Pages PDF (\d+)(?:-(\d+))?\*/
const ANCHOR_RE = /id="page-(\d+)-0" data-folio="(-?\d+)"/g
const FOLIO_ONLY_RE = /data-folio="(-?\d+)"/g

// Index ligne/offset local (remplace reanchor.mjs#buildIndex) : buildIndex joint toujours les
// lignes par UN espace, MEME une ligne VIDE — deux lignes séparées par un saut markdown (fréquent
// juste avant/après un titre `#`) produisent alors un double-espace dans `joined`. Le candidat PDF
// (une seule ligne de mots filtrés, toujours simple-espace) échoue le match EXACT dès qu'il franchit
// une frontière de ligne vide côté `.md`. `buildTightIndex` ne pose PAS de séparateur pour une ligne
// normalisée vide — `offsetToLine` (réutilisé tel quel) reste correct : il n'a besoin que d'un
// `lineStartOffset` non-décroissant par index de ligne D'ORIGINE, pas d'un espacement fixe.
export function buildTightIndex(rawLines) {
  const lineStartOffset = []
  let joined = ''
  for (let i = 0; i < rawLines.length; i++) {
    lineStartOffset.push(joined.length)
    const n = normalize(rawLines[i])
    if (!n) continue
    if (joined && !joined.endsWith(' ')) joined += ' '
    joined += n
  }
  return { joined, lineStartOffset, count: rawLines.length }
}

// ---------- offset (id pypdf 0-based) - (folio imprimé), constant par livre ----------
export function resolveBookOffset(dir) {
  let files
  try { files = readdirSync(dir).filter((f) => CHAPTER_RE.test(f)) } catch { return { ok: false, reason: 'dossier introuvable' } }
  const offsets = new Set()
  let count = 0
  for (const file of files) {
    const text = readText(join(dir, file))
    const re = new RegExp(ANCHOR_RE)
    let m
    while ((m = re.exec(text))) {
      offsets.add(Number(m[1]) - Number(m[2]))
      count++
    }
  }
  if (count === 0) return { ok: false, reason: 'aucune ancre existante dans le livre' }
  if (offsets.size > 1) return { ok: false, reason: `offset instable : ${[...offsets].sort((a, b) => a - b).join(', ')}` }
  return { ok: true, offset: [...offsets][0], sampleCount: count }
}

// ---------- plage de folios attendue d'un chapitre (en-tête *Pages PDF N[-M]*) ----------
export function chapterFolioRange(firstLine, offset) {
  const m = HEADER_RE.exec(firstLine)
  if (!m) return null
  const pdfLo = Number(m[1])
  const pdfHi = m[2] ? Number(m[2]) : pdfLo
  return { folioLo: (pdfLo - 1) - offset, folioHi: (pdfHi - 1) - offset }
}

export function existingFolios(text) {
  const set = new Set()
  const re = new RegExp(FOLIO_ONLY_RE)
  let m
  while ((m = re.exec(text))) set.add(Number(m[1]))
  return set
}

// ---------- tête de contenu exploitable d'une page PDF (écarte titre/folio/code de chapitre) ----------
// Boilerplate = ligne sans un MOT réel (3 minuscules consécutives) — titre courant, numéro de folio,
// code de chapitre court, OU en-tête de tableau de caractéristiques (« CC CT F E I Ag Dex Int FM
// Soc » : quelques abréviations portent 1-2 minuscules isolées, insuffisant pour un mot) — ou ligne
// vide. Le premier bloc de prose française contient forcément un mot de 3+ minuscules consécutives.
const HAS_LOWER_RE = /[a-zàâäéèêëïîôöùûüÿœæç]{3,}/
export function extractContentHead(pageText, { maxLines = 6, maxChars = 400 } = {}) {
  if (!pageText) return null
  const lines = pageText.split('\n').map((l) => l.trim())
  let start = 0
  while (start < lines.length && (!lines[start] || !HAS_LOWER_RE.test(lines[start]))) start++
  if (start >= lines.length) return null
  const take = lines.slice(start, start + maxLines).filter(Boolean).join(' ')
  return take.slice(0, maxChars) || null
}

// ---------- extraction batch (un seul process python par livre) ----------
export function extractPages(pdfPath, indices) {
  if (!indices.length) return new Map()
  const dir = mkdtempSync(join(tmpdir(), 'anchor-fill-'))
  const outPath = join(dir, 'pages.json')
  try {
    execFileSync('python', [PDF_EXTRACT_SCRIPT, pdfPath, indices.join(','), outPath], { maxBuffer: 128 * 1024 * 1024 })
    const raw = JSON.parse(readFileSync(outPath, 'utf8'))
    const map = new Map()
    for (const [k, v] of Object.entries(raw)) map.set(Number(k), v)
    return map
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

// ---------- traitement d'un chapitre (pur sur les données déjà en mémoire — pageTextOf injectable) ----------
// Retourne { file, range, missing, placed:[{folio,line}], skipped:[{folio,reason}], alreadyCount, edits }
// `edits` = Map(lineIdx0based -> [span,...]) à appliquer côté disque par l'appelant (jamais ici).
// `folioOwner` optionnel : Map(folio -> nom de fichier) DÉJÀ ancré ailleurs dans le LIVRE (autres
// chapitres). Un chapitre se termine parfois à mi-page (le split Marker suit les TITRES, pas les
// pages) : la même page PDF peut légitimement porter du contenu dans 2 fichiers adjacents, mais elle
// n'a qu'UN SEUL folio imprimé — vu sur LDB 40/41 (folio 220) et 66/67 (folio 303) en session #522.
// Conflit avec un AUTRE chapitre → skip (jamais 2 fichiers avec le même `data-folio`, ambiguïté
// détectée par `_lib.mjs#folioRangeIn`). `folioOwner` est MIS À JOUR par l'appelant après chaque
// chapitre planifié (conflits intra-run aussi couverts, chapitres traités dans l'ordre).
export function planChapter(file, text, offset, pageTextOf, folioOwner = new Map()) {
  const lines = text.split('\n')
  const range = chapterFolioRange(lines[0] || '', offset)
  if (!range) return { file, range: null, missing: [], placed: [], skipped: [], alreadyCount: 0, edits: new Map() }
  const already = existingFolios(text)
  const missing = []
  for (let f = range.folioLo; f <= range.folioHi; f++) if (!already.has(f)) missing.push(f)
  const alreadyCount = (range.folioHi - range.folioLo + 1) - missing.length

  const placed = []
  const skipped = []
  const edits = new Map()
  if (!missing.length) return { file, range, missing, placed, skipped, alreadyCount, edits }

  const conflict = (f) => { const owner = folioOwner.get(f); return owner && owner !== file ? owner : null }
  const li = buildTightIndex(lines)
  // Repli TABLEAU : le texte PDF n'a jamais de `|`/`<br>` (mise en page Marker) — une page de
  // tableau dense échoue au 1er passage (strict) faute de ces symboles côté PDF. On retente alors
  // sur une copie des lignes DÉBARRASSÉE de `|`/`<br>` (mêmes lignes, même longueur de tableau, donc
  // `offsetToLine` retombe sur la BONNE ligne réelle) — toujours match UNIQUE exigé, jamais deviné.
  const liTable = buildTightIndex(lines.map((l) => l.replace(/\|/g, ' ').replace(/<br\s*\/?>/gi, ' ')))
  for (const folio of missing) {
    const K = folio + offset
    const pageText = pageTextOf(K)
    if (pageText === undefined || pageText === null) { skipped.push({ folio, reason: 'page hors PDF ou introuvable' }); continue }
    const head = extractContentHead(pageText)
    if (!head) { skipped.push({ folio, reason: 'page sans texte exploitable (illustration probable)' }); continue }
    const normHead = normalize(head)
    let { occ, anchor } = headAnchor(li.joined, normHead)
    let lso = li.lineStartOffset
    if (occ.length !== 1) {
      const alt = headAnchor(liTable.joined, normHead)
      if (alt.occ.length === 1) { occ = alt.occ; anchor = alt.anchor; lso = liTable.lineStartOffset }
    }
    if (!anchor) { skipped.push({ folio, reason: 'aucune occurrence' }); continue }
    if (occ.length > 1) { skipped.push({ folio, reason: `ambigu (${occ.length} candidats)` }); continue }
    const owner = conflict(folio)
    if (owner) { skipped.push({ folio, reason: `conflit : folio déjà ancré dans ${owner}` }); continue }
    const lineNo = offsetToLine(occ[0], lso)   // 1-based
    const span = `<span id="page-${K}-0" data-folio="${folio}"></span>`
    const idx0 = lineNo - 1
    if (!edits.has(idx0)) edits.set(idx0, [])
    edits.get(idx0).push({ folio, span })
    placed.push({ folio, line: lineNo })
    folioOwner.set(folio, file)
  }
  // spans multiples sur une même ligne : ordre croissant de folio (ordre de page réel)
  for (const arr of edits.values()) arr.sort((a, b) => a.folio - b.folio)
  return { file, range, missing, placed, skipped, alreadyCount, edits }
}

export function applyEdits(text, edits) {
  const lines = text.split('\n')
  for (const [idx0, arr] of edits) {
    lines[idx0] = arr.map((e) => e.span).join('') + lines[idx0]
  }
  return lines.join('\n')
}

// ---------- pilote un livre ----------
export function runBook(abbr, { chapter = null, apply = false, dir: dirOverride, pdfPath: pdfOverride } = {}) {
  const dir = dirOverride ?? new Map(BOOKS).get(abbr)
  if (!dir) return { abbr, ok: false, reason: `abréviation inconnue de BOOKS : ${abbr}` }
  const off = resolveBookOffset(dir)
  if (!off.ok) return { abbr, ok: false, reason: off.reason }
  const pdfPath = pdfOverride ?? `${dir}.pdf`
  if (!existsSync(pdfPath)) return { abbr, ok: false, reason: `PDF introuvable : ${pdfPath}` }

  let files
  try { files = readdirSync(dir).filter((f) => CHAPTER_RE.test(f)) } catch { return { abbr, ok: false, reason: 'dossier introuvable' } }
  files = files.sort()
  if (chapter != null) files = files.filter((f) => Number(f.match(CHAPTER_RE)[1]) === Number(chapter))

  // Passe 1 (à sec) : détermine les folios manquants de chaque chapitre → K à extraire.
  const texts = new Map()
  const perFileMissingK = new Map()
  const allK = new Set()
  for (const file of files) {
    const text = readText(join(dir, file))
    texts.set(file, text)
    const lines = text.split('\n')
    const range = chapterFolioRange(lines[0] || '', off.offset)
    if (!range) { perFileMissingK.set(file, []); continue }
    const already = existingFolios(text)
    const ks = []
    for (let f = range.folioLo; f <= range.folioHi; f++) if (!already.has(f)) { ks.push(f + off.offset); allK.add(f + off.offset) }
    perFileMissingK.set(file, ks)
  }

  const pageMap = extractPages(pdfPath, [...allK])

  // Propriétaire de chaque folio DÉJÀ ancré (tous chapitres) — cf. `planChapter` : conflit inter-
  // chapitre (page PDF partagée entre 2 fichiers adjacents, un seul folio imprimé).
  const folioOwner = new Map()
  for (const file of files) for (const f of existingFolios(texts.get(file))) folioOwner.set(f, file)

  // Passe 2 : plan + application par chapitre.
  const chapters = []
  for (const file of files) {
    const text = texts.get(file)
    const plan = planChapter(file, text, off.offset, (K) => pageMap.get(K), folioOwner)
    chapters.push(plan)
    if (apply && plan.edits.size) {
      const newText = applyEdits(text, plan.edits)
      writeFileSync(join(dir, file), newText)
    }
  }
  return { abbr, ok: true, offset: off.offset, dir, pdfPath, chapters }
}

// ---------- rapport ----------
function report(result) {
  const out = []
  if (!result.ok) { out.push(`## ${result.abbr} — SKIPPÉ (${result.reason})`); return out.join('\n') }
  out.push(`## ${result.abbr} (offset ${result.offset})`)
  let totalPlaced = 0, totalSkipped = 0, totalAlready = 0
  for (const c of result.chapters) {
    if (c.range == null) { out.push(`- ${c.file} : pas d'en-tête \`*Pages PDF N[-M]*\` — ignoré`); continue }
    totalPlaced += c.placed.length; totalSkipped += c.skipped.length; totalAlready += c.alreadyCount
    if (!c.missing.length) { continue }
    out.push(`- ${c.file} : ✅ ${c.placed.length} posée(s) · ⏭️ ${c.skipped.length} sautée(s) · déjà là ${c.alreadyCount}`)
    for (const s of c.skipped) out.push(`    ❌ folio ${s.folio} — ${s.reason}`)
  }
  out.push(`**Bilan ${result.abbr} : ✅ ${totalPlaced} posées · ⏭️ ${totalSkipped} sautées · déjà là ${totalAlready}**`)
  return out.join('\n')
}

function main() {
  const args = process.argv.slice(2)
  const abbr = args.find((a) => !a.startsWith('--'))
  const chIdx = args.indexOf('--ch')
  const chapter = chIdx >= 0 ? args[chIdx + 1] : null
  const apply = args.includes('--apply')
  if (!abbr) {
    console.log('Usage: node scripts/raw/anchor-fill.mjs <ABBR> [--ch NN] [--dry|--apply]')
    process.exitCode = 1
    return
  }
  const result = runBook(abbr, { chapter, apply })
  console.log(report(result))
  if (!apply) console.log('(--dry : relancer avec --apply pour écrire)')
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isMain) main()
