// Garde de cohérence des lignes citées par le CODE (suite #434/#487, prévention).
// `check-refs.mjs` borne les réfs des DOCS (docs/raw) ; rien ne couvrait celles du CODE — vécu :
// `LDB 60 l.92` cité dans un chapitre de 62 lignes. Ici : pour chaque réf `<ABRÉV> NN l.X[-Y|+n…]`
// de `src/**` (.ts/.tsx/.json, hors node_modules, hors `src/gameIso/rig/parts/tenues/defs/` — même
// périmètre que le générateur `build-implemente`), résout le fichier-chapitre (`chapterFile`, _lib.mjs)
// et signale la réf dont la borne haute dépasse le nombre de lignes du chapitre, OU dont le chapitre
// est introuvable. Regex de réfs RÉUTILISÉES (`ldbRe`/`otherRe`/`span`/`bookOf`) — jamais réécrites.
// Cliquet NOMINATIF (`scripts/raw/dead-code-refs-stock.json`, écart calculé par `ecartsDeStock` de
// `guards/lib/stock.mjs`, forme de `reconciliation-stock.json`) : une ENTRÉE par site, et les deux
// sens échouent — un site NEUF est une régression à corriger ou à déclarer, une entrée dont le site
// a disparu est une dette SOLDÉE à retirer. Un nombre relevé dans un fichier de compte est net 0 à la
// porte de plage ; une entrée ajoutée est une croissance qui se déclare (`stocksNominatifs.mjs`).
// Le stock gelé (dérive de ligne post-ré-extraction Marker) soldé (#583) : le fichier de stock est
// ABSENT en régime nominal → tolérance ZÉRO (toute réf morte échoue nominativement, `readStock`
// traite un fichier absent comme zéro entrée). Si un résidu IRRÉDUCTIBLE réapparaît, le stock se
// recrée à sa mesure MINIMALE, chaque entrée portant son lot et sa date — jamais un cliquet tacite
// qui masque une future régression.
// DEUXIÈME contrôle, même parcours (#1457 G1) : la ligne citée doit être NON VIDE. Une réf dans les
// bornes peut pointer sur du blanc après une ré-extraction / une restitution de folio (vécu : le folio
// 88 de LDB 08 a décalé la fin du chapitre de +44 lignes, 7 réfs committées tombées sur du vide ou sur
// un autre paragraphe). Stock PROPRE (`scripts/raw/empty-line-code-refs-stock.json`, même écart) pour
// ne pas diluer la tolérance ZÉRO du contrôle de bornes ci-dessus.
// Re-run : node scripts/raw/check-code-refs.mjs (npm run raw:check-code-refs).
import { readFileSync } from 'node:fs'
import { listerArbre } from '../guards/lib/lister.mjs'
import { join, dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { ldbRe, otherRe, span, chapterFile, bookOf, readText, PIVOT_ABBR } from './_lib.mjs'
import { ecartsDeStock } from '../guards/lib/stock.mjs'

export const SRC_DIR = 'src'
export const EXCLUDE_SRC_PREFIX = 'src/gameIso/rig/parts/tenues/defs/' // art de couverture, pas une règle (cf. build-implemente)
export const STOCK_PATH = join(dirname(fileURLToPath(import.meta.url)), 'dead-code-refs-stock.json')
export const EMPTY_LINE_STOCK_PATH = join(dirname(fileURLToPath(import.meta.url)), 'empty-line-code-refs-stock.json')

// Réfs `LDB NN l.X…` et « autres livres » (AA/ZI/EDO…) d'une ligne — `{ abbr, nn, hi }` (borne haute
// de la plage dépliée par `span`). Réfs de livre entier (sans numéro de chapitre) = hors sujet (aucun
// fichier à borner). Miroir de `refsInLine` de check-refs.mjs, même vocabulaire de _lib.mjs.
function* refsInLine(ln) {
  const ldb = ldbRe()
  let m
  while ((m = ldb.exec(ln))) {
    const [lo, hi] = span(m[2], m[3])
    yield { abbr: PIVOT_ABBR, nn: m[1], lo, hi }
  }
  const other = otherRe()
  while ((m = other.exec(ln))) {
    const nn = m[2]
    if (nn == null) continue
    const abbr = bookOf(m[1].replace(/\s+/g, ' ').trim())
    if (!abbr) continue
    const [lo, hi] = span(m[3], m[4])
    yield { abbr, nn, lo, hi }
  }
}

const chapterTextCache = new Map()
function chapterLinesOf(path) {
  if (!chapterTextCache.has(path)) chapterTextCache.set(path, readText(path).split('\n'))
  return chapterTextCache.get(path)
}
function lineCount(path) {
  return chapterLinesOf(path).length
}

export const isExcludedSrc = (rel) => rel.startsWith(EXCLUDE_SRC_PREFIX)

function fichiersDuCode(dir) {
  return listerArbre(dir, {
    descendre: (rel) => !rel.split('/').includes('node_modules'),
    filtre: (rel) => /\.(tsx?|json)$/.test(rel),
  }).map((rel) => join(dir, rel))
}

/** Parcourt `srcDir` (src/ par défaut) et retourne les réfs mortes du code :
 *  `{ file, row, ref, abbr, nn, hi, kind, chapterLines?, chapterFile? }`.
 *  `kind` ∈ `out-of-bounds` (chapitre résolu, ligne hors borne) | `chapter-not-found` (chapitre absent). */
export function scanDeadCodeRefs(srcDir = SRC_DIR) {
  const dead = []
  for (const f of fichiersDuCode(srcDir)) {
    const rel = f.split('\\').join('/')
    if (isExcludedSrc(rel)) continue
    const lines = readFileSync(f, 'utf8').split('\n')
    lines.forEach((ln, i) => {
      for (const { abbr, nn, hi } of refsInLine(ln)) {
        const cf = chapterFile(abbr, nn)
        const ref = `${abbr} ${Number(nn)} l.${hi}`
        if (!cf) {
          dead.push({ file: rel, row: i + 1, ref, abbr, nn, hi, kind: 'chapter-not-found' })
          continue
        }
        const chapterLines = lineCount(cf.path)
        if (hi > chapterLines) {
          dead.push({ file: rel, row: i + 1, ref, abbr, nn, hi, kind: 'out-of-bounds', chapterLines, chapterFile: cf.file })
        }
      }
    })
  }
  return dead
}

/** Parcourt `srcDir` et retourne les réfs dont la ligne (ou TOUTE la plage) citée est VIDE dans le
 *  chapitre résolu : `{ file, row, ref, abbr, nn, lo, hi, chapterFile }`. Une réf dans les bornes qui
 *  tombe sur du blanc ne cite RIEN — symptôme d'une dérive de lignes (ré-extraction, restitution de
 *  folio). Les réfs hors borne / à chapitre introuvable sont l'affaire de `scanDeadCodeRefs`. */
export function scanEmptyLineCodeRefs(srcDir = SRC_DIR) {
  const vides = []
  for (const f of fichiersDuCode(srcDir)) {
    const rel = f.split('\\').join('/')
    if (isExcludedSrc(rel)) continue
    const lines = readFileSync(f, 'utf8').split('\n')
    lines.forEach((ln, i) => {
      for (const { abbr, nn, lo, hi } of refsInLine(ln)) {
        const cf = chapterFile(abbr, nn)
        if (!cf) continue
        const chap = chapterLinesOf(cf.path)
        if (hi > chap.length) continue
        let toutesVides = true
        for (let n = lo; n <= hi && toutesVides; n++) if ((chap[n - 1] ?? '').trim() !== '') toutesVides = false
        if (!toutesVides) continue
        const ref = `${abbr} ${Number(nn)} l.${lo === hi ? lo : `${lo}-${hi}`}`
        vides.push({ file: rel, row: i + 1, ref, abbr, nn, lo, hi, chapterFile: cf.file })
      }
    })
  }
  return vides
}

/** CLÉ NOMINATIVE d'une entrée ou d'un site : la famille quand la garde en distingue, le fichier, la
 *  réf, et l'OCCURRENCE. Jamais un numéro de ligne — il dérive à chaque édition du fichier et rendrait
 *  la moitié du stock périmée à chaque commit. Même clé des deux côtés de `ecartsDeStock`. */
export const cleDeSite = (e) => [e.famille ?? '', e.fichier, e.ref, e.occurrence].join(' :: ')

/**
 * Sites OBSERVÉS → entrées NOMINALES. L'occurrence est l'ordinal du site parmi ceux qui partagent la
 * même (famille, fichier, réf), dans l'ordre du balayage.
 * ANGLE MORT DIT : quand un fichier porte DEUX fois la même réf et que la PREMIÈRE se corrige, la
 * seconde descend de l'occurrence 2 à la 1 — l'écart rend alors une périmée ET une neuve pour un seul
 * geste. Le cliquet reste juste (le solde doit se déclarer), sa phrase est seulement plus bavarde.
 * @param {{ file: string, ref: string }[]} sites @param {{ famille?: string }} [p]
 */
export function sitesEnEntrees(sites, { famille } = {}) {
  const vus = new Map()
  return sites.map(({ file, ref }) => {
    const k = [famille ?? '', file, ref].join(' :: ')
    const occurrence = (vus.get(k) ?? 0) + 1
    vus.set(k, occurrence)
    return { famille, fichier: file, ref, occurrence }
  })
}

/** Contenu JSON d'un fichier de stock, ou `{}` s'il est ABSENT (mode ZÉRO-TOLÉRANCE : rien de toléré,
 *  l'écart fait le reste). Lecteur partagé : `reconcile.mjs` en tire ses `trous`. */
export function lireStockJson(path = STOCK_PATH) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'))
  } catch (err) {
    if (err.code === 'ENOENT') return {}
    throw err
  }
}

/** Les ENTRÉES d'un fichier de stock (fichier absent, ou stock vide : aucune entrée). */
export function readStock(path = STOCK_PATH) {
  return lireStockJson(path).entrees ?? []
}

/**
 * VERDICT d'un volet à stock nominatif : les deux sens, en phrases prêtes à afficher. Le calcul est
 * celui de `ecartsDeStock` ; ce qui vit ici est le REMÈDE — ce que le lecteur doit faire de chaque
 * ligne. Le PLAFOND n'y est pas : il vit dans le test de la garde.
 * ANGLE MORT DIT, À LA PORTE DE PLAGE : un ÉCHANGE EN PLACE à total constant — réécrire le `fichier`
 * ou la `ref` d'une entrée existante pour couvrir un site neuf pendant qu'un autre est soldé, dans le
 * MÊME commit — rend `[]` à `croissanceDesStocks` : le stock ne peut pas CROÎTRE ainsi, mais ce solde
 * et ce neuf ne se déclarent pas. Cette garde-ci, elle, les voit toujours (la clé a changé des deux
 * côtés) : c'est la SUITE qui tient ce cas, pas la porte de plage.
 * @param {{ sites: {file: string, ref: string}[], stock: object[], famille?: string, ou?: string }} p
 *   `ou` nomme le fichier de stock dans le remède.
 */
export function ecartDuVolet({ sites, stock, famille, ou }) {
  return ecartsDeStock({
    observe: sitesEnEntrees(sites, { famille }),
    stock,
    cle: cleDeSite,
    remede: {
      neuve: (k) => `${k} — site NEUF : corriger la réf, ou déclarer une entrée dans ${ou} et la porter au message par \`CLIQUET:\`.`,
      perimee: (k) => `${k} — entrée SOLDÉE : le site a disparu, retirer cette entrée de ${ou}.`,
    },
  })
}

function main() {
  const dead = scanDeadCodeRefs()
  const { neuves, perimees } = ecartDuVolet({
    sites: dead, stock: readStock(STOCK_PATH), ou: 'dead-code-refs-stock.json',
  })

  console.log(`réfs de code mortes (ligne hors borne du chapitre, ou chapitre introuvable) : ${dead.length} site(s)`)

  if (neuves.length) {
    console.log('RÉGRESSION — site(s) de réf morte hors du stock :')
    for (const o of neuves) console.log(`  ${o}`)
  }
  if (perimees.length) {
    console.log('Entrée(s) SOLDÉE(s) (réfs réparées) :')
    for (const s of perimees) console.log(`  ${s}`)
  }
  if (neuves.length || perimees.length) {
    console.log('Détail (fichier:ligne — réf, cause) :')
    for (const d of dead) {
      const cause = d.kind === 'out-of-bounds' ? `${d.chapterFile} a ${d.chapterLines} lignes` : 'chapitre introuvable'
      console.log(`${d.file}:${d.row} — ${d.ref} (${cause})`)
    }
    process.exitCode = 1
  }

  const vides = scanEmptyLineCodeRefs()
  const { neuves: neuvesV, perimees: perimeesV } = ecartDuVolet({
    sites: vides, stock: readStock(EMPTY_LINE_STOCK_PATH), ou: 'empty-line-code-refs-stock.json',
  })

  console.log(`réfs de code sur ligne VIDE (dans les bornes, mais la ligne citée est blanche) : ${vides.length} site(s)`)
  if (neuvesV.length) {
    console.log('RÉGRESSION — site(s) de réf sur ligne vide hors du stock :')
    for (const o of neuvesV) console.log(`  ${o}`)
  }
  if (perimeesV.length) {
    console.log('Entrée(s) SOLDÉE(s) (réfs repointées) :')
    for (const s of perimeesV) console.log(`  ${s}`)
  }
  if (neuvesV.length || perimeesV.length) {
    console.log('Détail (fichier:ligne — réf, chapitre) :')
    for (const v of vides) console.log(`${v.file}:${v.row} — ${v.ref} (${v.chapterFile} : ligne(s) blanche(s))`)
    process.exitCode = 1
  }

  if (!neuves.length && !perimees.length && !neuvesV.length && !perimeesV.length) console.log('OK — cliquets alignés, aucune régression.')
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isMain) main()
