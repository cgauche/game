// Construit les catalogues de l'Atlas (docs/raw/catalogue-*.md) en CONCATÉNANT verbatim les chapitres
// de DONNÉES de la SOURCE Marker propre (tables intactes), LDB + suppléments. Chaque chapitre est cité
// `<ABBR> NN` → crédité au niveau chapitre par coverage.mjs/reconcile.mjs. Un item de `inc` peut être un
// numéro de chapitre entier, OU `{ ch, from, to?, title }` pour une PLAGE DE SOUS-SECTION (ancres
// `chapterFile`, cf. `_lib.mjs`) — même mécanisme, pour un chapitre trop large pour son domaine (ex. MDG 2).
// Contrainte : tout bloc `<!-- X-INTEGRATION -->` du fichier existant reste un correctif MANUEL (perte
// connue de l'extraction Marker, aucun mécanisme `inc` ne la couvre encore) — préservé tel quel par
// extractPreservedBlocks/appendPreservedBlocks, JAMAIS régénéré. Re-run après toute ré-extraction.
// node scripts/raw/build-catalogs.mjs
import { existsSync } from 'node:fs'
import { listerDossier } from '../guards/lib/lister.mjs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { BOOKS, chapterFile as chapterFileLib, readText } from './_lib.mjs'
import { ecrireDoc } from '../docs/lib/empreinte-sources.mjs'

export const BLOCK_START = /^<!-- ([A-Z0-9_-]+-INTEGRATION) -->/
const blockEnd = (tag) => new RegExp(`^<!-- /${tag} -->\\s*$`)

// Extrait les blocs préservés (délimités par `<!-- X-INTEGRATION -->` … `<!-- /X-INTEGRATION -->`,
// précédés d'un séparateur `---` isolé) d'un catalogue EXISTANT. Un bloc sans marqueur de fin sur
// disque court jusqu'à l'EOF : on le ferme ici — auto-guérison au premier run.
export function extractPreservedBlocks(path) {
  if (!existsSync(path)) return []
  const lines = readText(path).split('\n')
  const blocks = []
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(BLOCK_START)
    if (!m) continue
    const tag = m[1]
    let start = i
    for (let j = i - 1; j >= Math.max(0, i - 5); j--) {
      if (lines[j].trim() === '---') { start = j; break }
    }
    const endRe = blockEnd(tag)
    let end = lines.length - 1
    let closed = false
    for (let j = i + 1; j < lines.length; j++) {
      if (endRe.test(lines[j])) { end = j; closed = true; break }
    }
    const body = lines.slice(start, end + 1)
    if (!closed) body.push(`<!-- /${tag} -->`)
    blocks.push(body.join('\n'))
    i = end
  }
  return blocks
}

function appendPreservedBlocks(content, blocks) {
  if (!blocks.length) return content
  return content.replace(/\n+$/, '\n') + '\n' + blocks.join('\n\n') + '\n'
}

// Domaines → chapitres de DONNÉES par livre (repérés au canal titre).
const DOMAINS = [
  { file: 'catalogue-creatures.md', titre: 'Bestiaire — profils de créature', rules: 'bestiaire.md',
    inc: [['LDB', [76, 77, 78, 79, 80, 82, 83, 84, 85]], ['MCLB', [4]],
          ['ZI', [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14]],
          ['ADE II', [1, 2]], ['EDO', [11]], ['EDOC', [7]], ['MSRC', [13]], ['PDT', [10, 11]], ['MDG', [16]], ['VDM', [13, 15]]] },
  { file: 'catalogue-sorts.md', titre: 'Sorts — listes complètes', rules: 'magie.md',
    inc: [['LDB', [47, 48, 49, 50, 51]], ['EDO', [11]],
          ['MDG', [{ ch: 2, from: 'Magie des mers', to: 'LES ELFES SUR LA MER DES GRIFFES', title: 'Magie des mers' }]],
          ['VDM', [4, 5, 6, 7, 8, 9, 10, 11]]] },
  { file: 'catalogue-divin.md', titre: 'Religion — dieux, bénédictions & miracles', rules: 'religion.md',
    inc: [['LDB', [24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43]], ['MCLB', [7]], ['ACE', [11]], ['MDG', [10, 11]]] },
  { file: 'catalogue-equipement.md', titre: 'Équipement — objets, prix & Encombrement', rules: 'equipement.md',
    inc: [['LDB', [57, 59, 60, 61, 62, 63, 64, 65, 66, 67, 68, 69, 70, 71, 72, 73, 74, 75]],
          ['AA', [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]], ['MDG', [12]], ['VDM', [12]]] },
  { file: 'catalogue-carrieres.md', titre: 'Carrières — détails par niveau', rules: 'carrieres.md',
    inc: [['LDB', [6, 7, 8]], ['ADE I', [7, 8]], ['ADE II', [1]], ['MCLB', [8, 9, 10]], ['MDG', [9, 11]]] },
  { file: 'catalogue-divers.md', titre: 'Règles diverses des suppléments', rules: '00-index.md',
    inc: [['ADE II', [3, 9]], ['MSR', [11]], ['MSRC', [7, 9, 14]], ['ACE', [10, 12]], ['EDOC', [12]]] },
]

function chapterFile(abbr, nn, range) {
  const c = chapterFileLib(abbr, nn, range)
  if (!c) return null
  const title = c.file.replace(/^\d+ - /, '').replace(/\.md$/, '')
  const text = c.text ?? readText(c.path).trim()
  return { title, text }
}

function main() {
// Fail-fast : sans extraction sur disque, `chapterFile` rend null pour TOUT chapitre et le
// catalogue s'écrirait VIDE, écrasant le committé. On refuse avant la moindre écriture.
const dirsVides = BOOKS.filter(([, dir]) => !existsSync(dir) || !listerDossier(dir).some((f) => f.endsWith('.md')))
if (dirsVides.length) {
  console.error(`build-catalogs — ${dirsVides.length} extraction(s) Source/ absente(s) ou vide(s) : aucun catalogue écrit.`)
  for (const [abbr, dir] of dirsVides) console.error(`  ${abbr} → ${dir}`)
  process.exit(1)
}
const log = []
for (const dom of DOMAINS) {
  const parts = [], refs = [], missing = []
  for (const [abbr, chaps] of dom.inc) for (const spec of chaps) {
    const isRange = typeof spec === 'object'
    const nn = isRange ? spec.ch : spec
    const c = chapterFile(abbr, nn, isRange ? { from: spec.from, to: spec.to } : undefined)
    if (!c) { missing.push(`${abbr} ${nn}`); continue }
    refs.push(`\`${abbr} ${nn}\``)
    parts.push(`\n\n## [${abbr} ${nn}] ${isRange ? spec.title : c.title}\n\n${c.text}`)
  }
  const header = `# Atlas RAW — Catalogue : ${dom.titre}\n\n` +
    `> **Catalogue mécanique RAW**, consolidé verbatim depuis la source **Marker** (propre, tables intactes)\n` +
    `> des livres autorisés. Système & règles : voir [\`${dom.rules}\`](${dom.rules}).\n>\n` +
    `> **Chapitres source :** ${refs.join(' · ')}.\n\n---\n`
  const path = `docs/raw/${dom.file}`
  const preserved = extractPreservedBlocks(path)
  const body = appendPreservedBlocks(header + parts.join('\n') + '\n', preserved)
  ecrireDoc(path, body)
  log.push(`${dom.file} : ${refs.length} ch., ${Math.round(body.length / 1024)} Ko${missing.length ? ' · MANQUE ' + missing.join(', ') : ''}${preserved.length ? ` · ${preserved.length} bloc(s) préservé(s)` : ''}`)
}
console.log(log.join('\n'))
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isMain) main()
