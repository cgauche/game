// Découpe une extraction Marker PAGINÉE (séparateurs `{N}----`, N = page 0-indexée) en chapitres
// `NN - Titre.md`, alignés sur la structure des ANCIENS .md (mêmes noms de fichier + page de début).
// Frontières : TITRE-d'abord (on trouve l'en-tête de chapitre dans le markdown Marker au/après sa page
// de début) avec REPLI sur l'offset de page → gère les chapitres qui partagent une page.
// Usage : node scripts/raw/marker-split.mjs "<ancien-book-dir>" "<marker-paginé.md>" "<out-dir>"
import { readdirSync, writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { readText } from './_lib.mjs'

const [bookDir, markerMd, outDir] = process.argv.slice(2)
if (!bookDir || !markerMd || !outDir) { console.error('args: <book-dir> <marker.md> <out-dir>'); process.exit(1) }

const norm = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[*_`#]/g, '').replace(/[^a-z0-9]+/g, ' ').trim()

// 1. chapitres depuis les anciens .md : nom de fichier + page de début (marqueur « Page PDF X »)
const chapters = readdirSync(bookDir)
  .filter((f) => /^\d+ - .+\.md$/.test(f) && f !== '00 - Index.md')
  .map((f) => {
    const nn = f.match(/^(\d+) - /)[1]
    const title = f.replace(/^\d+ - /, '').replace(/\.md$/, '')
    const m = readText(join(bookDir, f)).match(/[Pp]ages?\s+PDF\s+(\d+)/)
    return { nn, title, file: f, start: m ? Number(m[1]) : null, ntitle: norm(title) }
  })
  .filter((c) => c.start != null)
  .sort((a, b) => a.start - b.start || Number(a.nn) - Number(b.nn))

// 2. markdown Marker → pages (le nº du séparateur est 0-indexé → page PDF = N+1), concaténé + index d'offset
const segs = readText(markerMd).split(/^\{(\d+)\}-{5,}\s*$/m) // [pre, num, contenu, num, contenu, …]
const pageText = new Map()
for (let i = 1; i < segs.length; i += 2) { const pg = Number(segs[i]) + 1; pageText.set(pg, (pageText.get(pg) || '') + segs[i + 1]) }
const orderedPages = [...pageText.keys()].sort((a, b) => a - b)
const lastPage = orderedPages[orderedPages.length - 1] || 0
let concat = ''; const pageOff = new Map()
for (const pg of orderedPages) { pageOff.set(pg, concat.length); concat += pageText.get(pg) }
const offsetOfPage = (p) => { // offset du début de la 1re page ≥ p
  for (const pg of orderedPages) if (pg >= p) return pageOff.get(pg)
  return concat.length
}

// 3. tous les en-têtes du markdown Marker (offset + texte normalisé)
const heads = []
{ const re = /^#{1,6}\s+(.*\S)\s*$/gm; let m; while ((m = re.exec(concat))) heads.push({ off: m.index, h: norm(m[1]) }) }

// 4. offset de chaque chapitre : 1er en-tête (au/après sa page) qui matche son titre ; sinon repli page
for (const c of chapters) {
  const from = offsetOfPage(c.start) - 200 // petite marge (titre parfois en bas de page précédente)
  let best = null
  for (const hd of heads) {
    if (hd.off < from) continue
    if (hd.h === c.ntitle || (c.ntitle.length > 4 && (hd.h.includes(c.ntitle) || c.ntitle.includes(hd.h)))) { best = hd.off; break }
  }
  c.offset = best != null ? best : offsetOfPage(c.start)
  c.matched = best != null
}

// 5. fin de page (pour le marqueur) par ordre de page de début
for (let i = 0; i < chapters.length; i++) chapters[i].endPage = i + 1 < chapters.length ? chapters[i + 1].start - 1 : lastPage

// 6. découpe par offset croissant (gère même-page : chaque titre a son offset)
const byOff = [...chapters].sort((a, b) => a.offset - b.offset)
mkdirSync(outDir, { recursive: true })
const empties = []
for (let i = 0; i < byOff.length; i++) {
  const c = byOff[i], next = byOff[i + 1]
  let body = concat.slice(c.offset, next ? next.offset : undefined).trim()
  const span = c.endPage > c.start ? `${c.start}-${c.endPage}` : `${c.start}`
  if (body.replace(/[#*\s]/g, '').length < 80) { // vide réel (artefact ou chapitre même-page absorbé par le voisin)
    empties.push(c.nn)
    body = `# ${c.title}\n\n*(Page ${c.start} partagée avec un chapitre voisin — le contenu de cette section figure dans le chapitre adjacent de l'extraction Marker.)*`
  }
  writeFileSync(join(outDir, c.file), `*Pages PDF ${span}*\n\n${body}\n`)
}
const miss = chapters.filter((c) => !c.matched).map((c) => c.nn)
console.log(`${byOff.length} chapitres écrits dans ${outDir}`)
console.log(`repli-page (titre non trouvé) : ${miss.length} → ${miss.join(', ')}`)
console.log(`stubs vides (même-page/artefact) : ${empties.length} → ${empties.join(', ')}`)
