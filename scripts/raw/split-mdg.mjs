// Découpe l'extraction Marker de « La Mer de Griffe » (livre NOUVEAU, sans structure ancienne à aligner)
// en 16 chapitres NN - Titre.md = les en-têtes majeurs du SOMMAIRE. Conserve `*Pages PDF X*` en tête,
// retire les séparateurs de page `{N}----`. Usage : node scripts/raw/split-mdg.mjs
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'

const SRC = 'Source/_marker/full/WH - V4 - La Mer de Griffe/WH - V4 - La Mer de Griffe/WH - V4 - La Mer de Griffe.md'
const OUT = 'Source/WH - V4 - La Mer de Griffe'

const norm = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[*_`#]/g, '').replace(/[^a-z0-9]+/g, ' ').trim()

// [titre de fichier, clé normalisée que l'en-tête de chapitre doit préfixer]
const CHAPTERS = [
  ['La Mer des Griffes', 'la mer des griffes'],
  ['La Bretonnie et le Wasteland', 'la bretonnie et le wasteland'],
  ['La côte du Nordland', 'la cote du nordland'],
  ["La côte de l'Ostland", 'la cote de l ostland'],
  ['Le Pays des Trolls', 'le pays des trolls'],
  ['Kraka Ravnsvake', 'kraka ravnsvake'],
  ['La côte des Skaelings', 'la cote des skaelings'],
  ['La côte des Bjornlings', 'la cote des bjornlings'],
  ['La classe Côtier', 'la classe cotier'],
  ['Le culte de Manann', 'le culte de manann'],
  ['Le culte de Stromfels', 'le culte de stromfels'],
  ['Navires et construction navale', 'navires et construction navale'],
  ['Navigation maritime', 'navigation maritime'],
  ['Navigation à bord de grands vaisseaux', 'navigation a bord de grands vaisseaux'],
  ['Longs voyages', 'longs voyages'],
  ['Bestiaire', 'bestiaire'],
]

const lines = readFileSync(SRC, 'utf8').split('\n')
const PAGE_RE = /^\{(\d+)\}-{4,}/

// 1. ligne de chaque chapitre (en-tête `#…` préfixant la clé), recherche SÉQUENTIELLE (gère les doublons)
const startIdx = []
let cur = 0
for (const [title, key] of CHAPTERS) {
  let found = -1
  for (let i = cur; i < lines.length; i++) {
    if (/^#{1,6}\s/.test(lines[i]) && norm(lines[i]).startsWith(key)) { found = i; break }
  }
  if (found < 0) { console.error('CHAPITRE INTROUVABLE:', title); process.exit(1) }
  startIdx.push(found); cur = found + 1
}

// 2. page PDF d'une ligne = (dernier {N} <= ligne) + 1
const pageAt = (idx) => { let pg = 1; for (let i = 0; i <= idx && i < lines.length; i++) { const m = lines[i].match(PAGE_RE); if (m) pg = Number(m[1]) + 1 } return pg }

mkdirSync(OUT, { recursive: true })
const idxRows = []
for (let c = 0; c < CHAPTERS.length; c++) {
  const [title] = CHAPTERS[c]
  const from = startIdx[c], to = c + 1 < CHAPTERS.length ? startIdx[c + 1] : lines.length
  const startPage = pageAt(from)
  let endPage = startPage
  for (let i = from; i < to; i++) { const m = lines[i].match(PAGE_RE); if (m) endPage = Number(m[1]) + 1 }
  const body = lines.slice(from, to).filter((l) => !PAGE_RE.test(l)).join('\n').trim()
  const span = endPage > startPage ? `${startPage}-${endPage}` : `${startPage}`
  const nn = String(c + 1).padStart(2, '0')
  writeFileSync(join(OUT, `${nn} - ${title}.md`), `*Pages PDF ${span}*\n\n${body}\n`)
  idxRows.push(`- [${nn} - ${title}](<${nn} - ${title}.md>) — p.${span}`)
  console.log(`${nn} - ${title}  (p.${span}, ${to - from} lignes)`)
}
writeFileSync(join(OUT, '00 - Index.md'), `# La Mer des Griffes — Index\n\n${idxRows.join('\n')}\n`)
console.log(`\n${CHAPTERS.length} chapitres + index écrits dans ${OUT}`)
