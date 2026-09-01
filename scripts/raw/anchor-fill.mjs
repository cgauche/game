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
//   5. Candidats de tête (`extractContentHeads`) : la tête de contenu de la page PDF (boilerplate
//      écarté — titre de livre/numéro de folio/code de chapitre courts/en-tête de caractéristiques
//      SANS mot de 3+ minuscules), PUIS les mêmes fenêtres décalées d'une ligne (`SLIDE_MAX`) —
//      une page à colonnes entrelace parfois un fragment d'encadré avec le corps.
//   6. Alignement, trois index essayés dans l'ordre, match UNIQUE exigé à chaque fois :
//      `headAnchor` de `reanchor.mjs` (RÉUTILISÉ tel quel, même normalisation `_lib.mjs#normalize`)
//      sur `buildTightIndex` ; puis le même sur un repli TABLEAU (`|`/`<br>` strippés côté `.md`,
//      absents du texte PDF) ; puis `compactAnchor` sur `buildCompactIndex` (index SANS espace,
//      ancrage par préfixe de caractères — les petites capitales sortent du PDF avec des lettres
//      éclatées à l'intérieur des mots, ce qui interdit tout découpage en mots).
//   7. Bornage (`folioBounds`) : le candidat retenu doit tomber ENTRE la ligne du folio ancré
//      immédiatement inférieur et celle du folio ancré immédiatement supérieur (ancres existantes
//      du fichier ET ancres posées plus tôt dans le run). Hors bornes → candidat suivant.
//      Absent/multiple/hors bornes/conflit avec un autre chapitre → SKIP + raison, jamais de pose
//      au jugé. Ancre posée en tête de la ligne trouvée.
//   8. Idempotent : un folio déjà ancré dans le fichier n'est jamais retraité.
//
// Usage :
//   node scripts/raw/anchor-fill.mjs <ABBR> [--ch NN] [--pdf <chemin>] [--offset N] [--dry|--apply]
//   --dry (défaut) : rapport seul. --apply : réécrit les .md.
//   --pdf : PDF dont le nom diffère de `<dir>.pdf`. --offset : offset K−folio fourni par
//   l'appelant (livre VIERGE, aucune ancre à dériver — cf. `folio-bootstrap.mjs`).
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

// Index COMPACT (aucun espace) + ancrage par préfixe de caractères. Motif : les petites capitales
// de la maquette sortent de l'extraction PDF avec des lettres éclatées À L'INTÉRIEUR des mots
// (« 3. L ors de chaque Round », « TesT de FocalisaT ion ») ; le découpage en MOTS de `headAnchor`
// ne peut alors rien matcher, alors que le texte `.md` est intact. Espaces retirés des deux côtés,
// la coupure disparaît. Le match UNIQUE reste exigé, et l'offset retenu est celui du DÉBUT du
// préfixe — le raccourcissement caractère par caractère ne déplace donc jamais la ligne trouvée.
const COMPACT_MIN = 40
export function buildCompactIndex(rawLines) {
  const lineStartOffset = []
  let joined = ''
  for (const line of rawLines) {
    lineStartOffset.push(joined.length)
    joined += normalize(line).replace(/ /g, '')
  }
  return { joined, lineStartOffset, count: rawLines.length }
}
export function compactAnchor(joined, head, min = COMPACT_MIN) {
  const compact = head.replace(/ /g, '')
  for (let len = compact.length; len >= min; len--) {
    const needle = compact.slice(0, len)
    const occ = []
    let i = joined.indexOf(needle)
    while (i !== -1) { occ.push(i); i = joined.indexOf(needle, i + 1) }
    if (occ.length >= 1) return { occ, anchor: needle }
  }
  return { occ: [], anchor: null }
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

// Ancres déjà présentes AVEC leur ligne (1-based) : Map(folio -> ligne). Un folio réancré plus bas
// dans le fichier ne remplace pas sa première occurrence — c'est la tête de page qui borne.
export function existingFolioLines(text) {
  const map = new Map()
  const lines = text.split('\n')
  for (let i = 0; i < lines.length; i++) {
    const re = new RegExp(FOLIO_ONLY_RE)
    let m
    while ((m = re.exec(lines[i]))) { const f = Number(m[1]); if (!map.has(f)) map.set(f, i + 1) }
  }
  return map
}

// Intervalle de lignes admissible pour un folio manquant : la ligne du folio ancré immédiatement
// INFÉRIEUR et celle du folio ancré immédiatement SUPÉRIEUR. Sans voisin d'un côté, la borne est
// ouverte (`0` / `Infinity`) — jamais une borne inventée. `known` = Map(folio -> ligne).
export function folioBounds(known, folio) {
  let lo = 0, hi = Infinity, loFolio = null, hiFolio = null
  for (const [f, line] of known) {
    if (f < folio && (loFolio == null || f > loFolio)) { loFolio = f; lo = line }
    if (f > folio && (hiFolio == null || f < hiFolio)) { hiFolio = f; hi = line }
  }
  return { lo, hi, loFolio, hiFolio }
}

export function boundsLabel(b) {
  const lo = b.loFolio == null ? 'début de fichier' : `l.${b.lo} (folio ${b.loFolio})`
  const hi = b.hiFolio == null ? 'fin de fichier' : `l.${b.hi} (folio ${b.hiFolio})`
  return `${lo} → ${hi}`
}

// ---------- tête de contenu exploitable d'une page PDF (écarte titre/folio/code de chapitre) ----------
// Boilerplate = ligne sans un MOT réel (3 minuscules consécutives) — titre courant, numéro de folio,
// code de chapitre court, OU en-tête de tableau de caractéristiques (« CC CT F E I Ag Dex Int FM
// Soc » : quelques abréviations portent 1-2 minuscules isolées, insuffisant pour un mot) — ou ligne
// vide. Le premier bloc de prose française contient forcément un mot de 3+ minuscules consécutives.
export const HAS_LOWER_RE = /[a-zàâäéèêëïîôöùûüÿœæç]{3,}/

// Candidats de tête d'une page : la tête de contenu, puis les mêmes fenêtres DÉCALÉES d'une ligne
// (jusqu'à `SLIDE_MAX`). Motif : la lecture linéaire d'une page à colonnes entrelace parfois un
// fragment d'encadré (titre de carrière, mention d'espèce) avec le corps — cette séquence-là
// n'existe nulle part dans le `.md`, alors que le paragraphe qui la SUIT s'y retrouve mot pour mot,
// quelques lignes plus bas. Les candidats sont essayés dans l'ordre, le premier à match UNIQUE
// gagne, et le décalage retenu est rapporté (`slide` dans `placed`).
const SLIDE_MAX = 8
export function extractContentHeads(pageText, { maxLines = 6, maxChars = 400, slideMax = SLIDE_MAX } = {}) {
  if (!pageText) return []
  const lines = pageText.split('\n').map((l) => l.trim()).filter(Boolean)
  let start = 0
  while (start < lines.length && !HAS_LOWER_RE.test(lines[start])) start++
  const heads = []
  for (let s = start; s <= start + slideMax && s < lines.length; s++) {
    const take = lines.slice(s, s + maxLines).join(' ').slice(0, maxChars)
    if (take) heads.push({ slide: s - start, head: take })
  }
  return heads
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
  const liCompact = buildCompactIndex(lines.map((l) => l.replace(/\|/g, ' ').replace(/<br\s*\/?>/gi, ' ')))
  // Bornage à DEUX CÔTÉS (cf. `folioBounds`) : les ancres VOISINES du folio manquant — existantes
  // dans le fichier ET posées plus tôt dans le run — encadrent la ligne recherchée. Un candidat qui
  // sort de cet intervalle est un faux positif : page dont la tête est une ligne générique (« Nain,
  // Halfling, Humain » d'un tableau de carrière), présente une seule fois dans le `.md` donc
  // « unique » sans être la bonne, ou filigrane de personnalisation du PDF, qui se répète hors de
  // toute page. Refusé : on essaie le candidat suivant, sinon la page est sautée et rapportée.
  const known = existingFolioLines(text)
  for (const folio of missing) {
    const K = folio + offset
    const pageText = pageTextOf(K)
    if (pageText === undefined || pageText === null) { skipped.push({ folio, reason: 'page hors PDF ou introuvable' }); continue }
    const heads = extractContentHeads(pageText)
    if (!heads.length) { skipped.push({ folio, reason: 'page sans texte exploitable (illustration probable)' }); continue }
    const bounds = folioBounds(known, folio)
    let lineNo = null
    let slide = 0
    let ambiguous = 0
    let outOfBounds = null
    for (const cand of heads) {
      const normHead = normalize(cand.head)
      for (const [index, offsets] of [[li, li.lineStartOffset], [liTable, liTable.lineStartOffset], [liCompact, liCompact.lineStartOffset]]) {
        const hit = index === liCompact ? compactAnchor(index.joined, normHead) : headAnchor(index.joined, normHead)
        if (hit.occ.length > 1) { ambiguous = Math.max(ambiguous, hit.occ.length); continue }
        if (hit.occ.length !== 1) continue
        const candLine = offsetToLine(hit.occ[0], offsets)   // 1-based
        if (candLine < bounds.lo || candLine > bounds.hi) { outOfBounds = outOfBounds ?? candLine; continue }
        lineNo = candLine
        slide = cand.slide
        break
      }
      if (lineNo != null) break
    }
    if (lineNo == null && outOfBounds != null) { skipped.push({ folio, reason: `hors bornes (l.${outOfBounds} hors ${boundsLabel(bounds)})` }); continue }
    if (lineNo == null && ambiguous) { skipped.push({ folio, reason: `ambigu (${ambiguous} candidats)` }); continue }
    if (lineNo == null) { skipped.push({ folio, reason: 'aucune occurrence' }); continue }
    const owner = conflict(folio)
    if (owner) { skipped.push({ folio, reason: `conflit : folio déjà ancré dans ${owner}` }); continue }
    const span = `<span id="page-${K}-0" data-folio="${folio}"></span>`
    const idx0 = lineNo - 1
    if (!edits.has(idx0)) edits.set(idx0, [])
    edits.get(idx0).push({ folio, span })
    placed.push({ folio, line: lineNo, slide })
    known.set(folio, lineNo)
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
// `offset` : amorce d'un livre VIERGE (aucune ancre → `resolveBookOffset` n'a rien à dériver) ;
// l'appelant fournit alors l'offset qu'il a LU au pied/en-tête des pages du PDF
// (`folio-bootstrap.mjs`). Absent → offset dérivé des ancres existantes, comme d'habitude.
export function runBook(abbr, { chapter = null, apply = false, dir: dirOverride, pdfPath: pdfOverride, offset: offsetOverride = null } = {}) {
  const dir = dirOverride ?? new Map(BOOKS).get(abbr)
  if (!dir) return { abbr, ok: false, reason: `abréviation inconnue de BOOKS : ${abbr}` }
  const off = offsetOverride == null ? resolveBookOffset(dir) : { ok: true, offset: offsetOverride }
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
  const pdfIdx = args.indexOf('--pdf')
  const offIdx = args.indexOf('--offset')
  const apply = args.includes('--apply')
  if (!abbr) {
    console.log('Usage: node scripts/raw/anchor-fill.mjs <ABBR> [--ch NN] [--pdf <chemin>] [--offset N] [--dry|--apply]')
    process.exitCode = 1
    return
  }
  const pdfPath = pdfIdx >= 0 ? args[pdfIdx + 1] : undefined
  const offset = offIdx >= 0 ? Number(args[offIdx + 1]) : null
  if (offIdx >= 0 && !Number.isInteger(offset)) {
    console.log(`--offset attend un entier, reçu : ${args[offIdx + 1]}`)
    process.exitCode = 1
    return
  }
  const result = runBook(abbr, { chapter, apply, pdfPath, offset })
  console.log(report(result))
  if (!apply) console.log('(--dry : relancer avec --apply pour écrire)')
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isMain) main()
