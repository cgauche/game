// Construit les catalogues de l'Atlas (docs/raw/catalogue-*.md) en CONCATÉNANT verbatim les chapitres
// de DONNÉES de la SOURCE Marker propre (tables intactes), LDB + suppléments. Chaque chapitre est cité
// `<ABBR> NN` → crédité au niveau chapitre par coverage.mjs/reconcile.mjs. Re-run après toute ré-extraction.
// node scripts/raw/build-catalogs.mjs
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const BASE = 'Source'
const BOOK = {
  'LDB': 'Warhammer v4 - Livre de base version corrigée',
  'ADE I': "Warhammer v4 - Les archives de l'Empire volume 1",
  'ADE II': "Warhammer v4 - Les archives de l'Empire volume 2",
  'AA': 'WH - V4 - Aux Armes',
  'ZI': 'WH - V4 - Le zoo impérial',
  'Middenheim': 'Warhammer v4 - Middenheim la cité du Loup Blanc',
  'EDO': "Warhammer v4 - 1.0 L'ennemi dans l'Ombre",
  'EDOC': "Warhammer v4 - 1.0 L'ennemi dans l'Ombre Compagnon",
  'T2C': 'Warhammer v4 - 2.0 Mort sur le Reik Compagnon',
  'T3': 'Warhammer v4 - 3.0 Le Pouvoir Derriere le Trone',
  'T2': 'Warhammer v4 - 2.0 Mort sur le Reik',
  'Altdorf': "Warhammer v4 - Aldorf la Couronne de l'Empire",
}

// Domaines → chapitres de DONNÉES par livre (repérés au canal titre).
const DOMAINS = [
  { file: 'catalogue-creatures.md', titre: 'Bestiaire — profils de créature', rules: 'bestiaire.md',
    inc: [['LDB', [76, 77, 78, 79, 80, 82, 83, 84, 85]], ['Middenheim', [4]], ['ZI', [1]],
          ['ADE II', [1, 2]], ['EDO', [11]], ['EDOC', [7]], ['T2C', [13]], ['T3', [10, 11]]] },
  { file: 'catalogue-sorts.md', titre: 'Sorts — listes complètes', rules: 'magie.md',
    inc: [['LDB', [47, 48, 49, 50, 51]], ['EDO', [11]]] },
  { file: 'catalogue-divin.md', titre: 'Religion — dieux, bénédictions & miracles', rules: 'religion.md',
    inc: [['LDB', [24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43]], ['Middenheim', [7]], ['Altdorf', [11]]] },
  { file: 'catalogue-equipement.md', titre: 'Équipement — objets, prix & Encombrement', rules: 'equipement.md',
    inc: [['LDB', [57, 59, 60, 61, 62, 63, 64, 65, 66, 67, 68, 69, 70, 71, 72, 73, 74, 75]], ['AA', [1]]] },
  { file: 'catalogue-carrieres.md', titre: 'Carrières — détails par niveau', rules: 'carrieres.md',
    inc: [['LDB', [6, 7, 8]], ['ADE I', [7, 8]], ['ADE II', [1]], ['Middenheim', [8, 9, 10]]] },
  { file: 'catalogue-divers.md', titre: 'Règles diverses des suppléments', rules: '00-index.md',
    inc: [['ADE II', [3, 9]], ['T2', [11]], ['T2C', [7, 9, 14]], ['Altdorf', [10, 12]], ['EDOC', [12]]] },
]

function chapterFile(abbr, nn) {
  const dir = BOOK[abbr]; if (!dir) return null
  const pad = String(nn).padStart(2, '0')
  let f
  try { f = readdirSync(join(BASE, dir)).find((x) => x.startsWith(pad + ' - ') && x.endsWith('.md')) } catch { return null }
  if (!f) return null
  return { title: f.replace(/^\d+ - /, '').replace(/\.md$/, ''), text: readFileSync(join(BASE, dir, f), 'utf8').trim() }
}

const log = []
for (const dom of DOMAINS) {
  const parts = [], refs = [], missing = []
  for (const [abbr, chaps] of dom.inc) for (const nn of chaps) {
    const c = chapterFile(abbr, nn)
    if (!c) { missing.push(`${abbr} ${nn}`); continue }
    refs.push(`\`${abbr} ${nn}\``)
    parts.push(`\n\n## [${abbr} ${nn}] ${c.title}\n\n${c.text}`)
  }
  const header = `# Atlas RAW — Catalogue : ${dom.titre}\n\n` +
    `> **Catalogue mécanique RAW**, consolidé verbatim depuis la source **Marker** (propre, tables intactes)\n` +
    `> des livres autorisés. Système & règles : voir [\`${dom.rules}\`](${dom.rules}).\n>\n` +
    `> **Chapitres source :** ${refs.join(' · ')}.\n\n---\n`
  writeFileSync(`docs/raw/${dom.file}`, header + parts.join('\n') + '\n')
  log.push(`${dom.file} : ${refs.length} ch., ${Math.round((header + parts.join('')).length / 1024)} Ko${missing.length ? ' · MANQUE ' + missing.join(', ') : ''}`)
}
console.log(log.join('\n'))
