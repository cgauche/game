// Découpe l'extraction Marker du « Warhammer Fantasy Roleplay 5e Core Rulebook » (Cubicle 7, VO — livre
// NOUVEAU, sans structure ancienne à aligner ; dépôt `.md` HORS périmètre des règles, comme `Source/Winds
// of Magic`) en chapitres NN - Titre.md. Frontières = PAGES PDF de début lues dans les signets du PDF (chaque
// chapitre ouvre sur une page neuve) ; conserve `*Pages PDF X-Y*` en tête, retire les séparateurs `{N}----`
// et déballe le HTML `<sup>` (lib partagée `lib/marker-pages.mjs`, CONSIGNE de `deballerSup`).
// Usage : node scripts/raw/split-wfrp5.mjs [--dry]  (`--dry` : aucune écriture, imprime le plan)
import { writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { mdsDeMarker, mdsDeRestitutions, pagesDeMarker, deballerSup, verifierExtraction, commandeRestitution } from './lib/marker-pages.mjs'
import { nomAscii } from '../source/nom-ascii.mjs'
import { graphieDeChapitre, largeurDeChapitre } from '../../src/data/source/decoupe.ts'

const DRY = process.argv.slice(2).includes('--dry')

// Extraction par TRANCHES de pages (`--page_range a-b`, une sous-arborescence `slices/<a>-<b>/` par
// tranche) : l'extraction d'un tenant est tuée par le harnais faute de mémoire, et le nom long du
// PDF officiel dépasse MAX_PATH sous Windows — le PDF est copié en `Source/_marker/wfrp5.pdf`.
const MARKER_DIR = 'Source/_marker/full/wfrp5/slices'
// PDF de référence des VÉRIFICATIONS (`verifierExtraction` : couche texte pypdf des pages que Marker
// a rendues vides) et des commandes de restitution imprimées.
const PDF = 'Source/_marker/wfrp5.pdf'
// Tout nom ÉCRIT sous `Source/` passe par `nomAscii` (#1699) : un chemin non ASCII ne naît pas ici.
const OUT = nomAscii('Source/Warhammer Fantasy Roleplay 5e Core Rulebook')
const BOOK_TITLE = 'Warhammer Fantasy Roleplay 5e Core Rulebook'

// [titre de fichier, page PDF de début (1-based)] — signets du PDF + sommaire (p.2-4) ; la fin d'un
// chapitre = page précédant le début du suivant, le dernier court jusqu'à la dernière page extraite.
const CHAPTERS = [
  ['Cover', 1],
  ['Contents', 2],
  ['Credits', 5],
  ['Introduction', 6],
  ['Character Building', 22],
  ['Class and Careers', 43],
  ['Skills and Talents', 109],
  ['Rules', 129],
  ['Between Adventures', 190],
  ['Religion and Belief', 202],
  ['Magic', 230],
  ['The Gamemaster', 261],
  ['Glorious Reikland', 272],
  ['Consumer Guide', 296],
  ['Bestiary', 318],
  ['Appendices', 364],
  ['Index', 370],
  ['Character Sheet', 376],
]

// Marker paginé → texte PAR PAGE PDF, par la lib partagée `lib/marker-pages.mjs` (parseur UNIQUE,
// aussi consommé par `marker-split.mjs`).
let pageText
try {
  const mds = mdsDeMarker(MARKER_DIR)
  if (!mds.length) { console.error('EXTRACTION MARKER INTROUVABLE sous', MARKER_DIR); process.exit(1) }
  pageText = pagesDeMarker(mds)
} catch (e) { console.error(e.message); process.exit(1) }
if (!pageText.size) { console.error('AUCUNE PAGE PAGINÉE sous', MARKER_DIR); process.exit(1) }

// VÉRIFICATIONS de l'extraction (bloc partagé avec `marker-split.mjs`) : les restitutions ciblées
// sont fusionnées, les pages manquantes averties, et une page PERDUE (vide chez Marker, pleine chez
// pypdf) ARRÊTE le découpage — une planche muette ne se découvre pas après coup dans `Source/`.
let verif
try {
  verif = verifierExtraction(pageText, { pdfPath: PDF, restitutions: pagesDeMarker(mdsDeRestitutions(MARKER_DIR)) })
} catch (e) { console.error(e.message); process.exit(1) }
pageText = verif.pages
const lastPage = Math.max(...pageText.keys())
for (const pg of verif.manquantes) console.warn(`page ${pg} absente de l'extraction (page sans texte ?)`)
if (verif.perdues.length) {
  console.error(`PAGES PERDUES : ${verif.perdues.length} page(s) vide(s) chez Marker alors que le PDF en porte du texte — ré-extraire CHACUNE avant de découper :`)
  for (const { page, pypdf } of verif.perdues) {
    console.error(`  page ${page} (pypdf : ${pypdf} caractères)`)
    console.error(`    ${commandeRestitution(PDF, MARKER_DIR, page)}`)
  }
  process.exit(1)
}

// Vérification : les débuts de chapitre sont croissants et dans l'extraction.
for (let c = 1; c < CHAPTERS.length; c++) {
  if (CHAPTERS[c][1] <= CHAPTERS[c - 1][1]) { console.error('CHAPITRES NON CROISSANTS :', CHAPTERS[c][0]); process.exit(1) }
}
if (CHAPTERS[CHAPTERS.length - 1][1] > lastPage) { console.error(`DERNIER CHAPITRE HORS EXTRACTION (${lastPage} pages)`); process.exit(1) }

if (!DRY) mkdirSync(OUT, { recursive: true })
// LARGEUR du dossier, arrêtée AVANT le premier fichier : tous les préfixes d'un livre la partagent.
const LARGEUR = largeurDeChapitre(CHAPTERS.length)
const idxRows = []
for (let c = 0; c < CHAPTERS.length; c++) {
  const [title, startPage] = CHAPTERS[c]
  const endPage = c + 1 < CHAPTERS.length ? CHAPTERS[c + 1][1] - 1 : lastPage
  const parts = []
  for (let pg = startPage; pg <= endPage; pg++) if (pageText.has(pg)) parts.push(pageText.get(pg))
  const brut = parts.join('\n').replace(/\n{3,}/g, '\n\n').trim()
  const body = deballerSup(brut)
  const sups = (brut.match(/<sup>/g) || []).length
  const span = endPage > startPage ? `${startPage}-${endPage}` : `${startPage}`
  const nn = graphieDeChapitre(c + 1, LARGEUR)
  const nom = nomAscii(`${nn} - ${title}.md`)
  if (!DRY) writeFileSync(join(OUT, nom), `*Pages PDF ${span}*\n\n${body}\n`)
  idxRows.push(`- [${nn} - ${title}](<${nom}>) — p.${span}`)
  const firstHeading = body.split('\n').find((l) => /^#{1,6}\s/.test(l)) || '(aucun en-tête)'
  console.log(`${nn} - ${title}  (p.${span}, ${body.split('\n').length} lignes, ${Math.round(body.length / 1024)} Ko, ${sups} <sup> déballés) — 1er en-tête : ${firstHeading.slice(0, 80)}`)
}
if (!DRY) writeFileSync(join(OUT, '00 - Index.md'), `# ${BOOK_TITLE} — Index\n\n${idxRows.join('\n')}\n`)
console.log(DRY
  ? `\n--dry : ${CHAPTERS.length} chapitres + index PLANIFIÉS pour ${OUT} (${lastPage} pages extraites) — rien écrit`
  : `\n${CHAPTERS.length} chapitres + index écrits dans ${OUT} (${lastPage} pages extraites)`)
