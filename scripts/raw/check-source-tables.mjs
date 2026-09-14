// Garde des TABLES CASSÉES du `Source/` (#1384, épique #1388). L'extraction Marker rend les tables
// imprimées avec des défauts de FORME qui les laissent inadressables (`descRef` de cellule) : un
// `<br>` littéral dans une cellule, un marqueur de folio collé à la première ligne de table, une
// continuation de table après saut de page dont les « en-têtes » sont une fourchette de données, un
// bandeau de titre non absorbable, et des clés de ligne partagées entre deux tables d'une même
// section (qui rendent `ligne-ambigue` à la résolution).
//
// QUI POSSÈDE QUOI : le PARSEUR (`src/data/source/decoupe.ts`) définit la table — ce script importe
// `parseChapitre`, `tablesOf`, `normText` et `estCleDePlage` (et lit, par `tablesOf`, ce que
// `parseTable` a décidé : `titre` absorbé, `banniereRefusee`), il n'en redéfinit AUCUN ; il CONSOMME
// et NOMME. La réparation, elle, vit dans `Source/` (geste `docs/ajouter-un-livre-source.md` §7) —
// jamais dans un remède au parsing.
//
// STOCK NOMINATIF (`scripts/raw/source-tables-stock.json`, régime #1711) : une ENTRÉE par SITE,
// clé `famille :: fichier :: ref :: occurrence` (`stockNominatif.mjs`, `cleDeSite`). La clé ne porte
// JAMAIS une position : ni la ligne du `.md` (elle dérive à chaque correction), ni l'ordinal de la
// table dans sa section (26 % des tables bougeraient à la moindre insertion). Elle porte le
// CONTENU : la section et les en-têtes normalisés, l'`occurrence` départageant deux tables de mêmes
// en-têtes (les continuations de page). Les deux sens sont rouges : un site MESURÉ hors du stock
// (corriger, ou déclarer par `CLIQUET:`), une entrée SANS site mesuré (défaut réparé : la retirer).
//
// Re-run    : node scripts/raw/check-source-tables.mjs
// Régénérer : node scripts/raw/check-source-tables.mjs --ecrire-stock
import { writeFileSync } from 'node:fs'
import { join, dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { listerDossier } from '../guards/lib/lister.mjs'
import { BOOKS, readText } from './_lib.mjs'
import { ecartDuVolet, readStock, sitesEnEntrees } from './stockNominatif.mjs'
import { parseChapitre, tablesOf, normText, estCleDePlage } from '../../src/data/source/decoupe.ts'

export const STOCK_PATH = join(dirname(fileURLToPath(import.meta.url)), 'source-tables-stock.json')
const CHAPTER_FILE_RE = /^(\d+) - .*\.md$/

/** Les familles de défaut, dans l'ordre du rapport. Chacune est un GESTE de réparation distinct
 *  (cf. le tableau « défaut de table → geste » de `docs/ajouter-un-livre-source.md` §7). */
export const FAMILLES = [
  'br-litteral',
  'span-colle',
  'donnee-en-tete',
  'banniere-suspecte',
  'cle-de-ligne-ambigue',
]

/** RÉF d'une table : sa section et ses en-têtes NORMALISÉS — du contenu, jamais une position.
 *  Le `<br>` littéral y compte pour une ESPACE : c'est exactement le geste que la migration du lot
 *  B2 appliquera, et une clé qui changerait sous sa propre réparation ferait passer chaque table
 *  voisine pour un site neuf le jour où la sienne se solde. */
export const refDeTable = (sec, occ, headers) =>
  `${sec}#${occ} :: ${headers.map((h) => normText(h.replace(/<br\s*\/?>/gi, ' '))).join('|')}`

/** Clé de LIGNE d'une rangée : sa première cellule non vide, normalisée (`''` si la rangée est vide). */
export const cleDeLigne = (row) => normText(row.find((c) => c.trim()) ?? '')

/**
 * Sites de défaut d'UN chapitre (PUR : aucun accès disque). `file` est le chemin du chapitre tel que
 * le stock le nomme ; `texte` son markdown (déjà passé par `readText`).
 * @param {string} texte @param {string} file @returns {{ famille: string, file: string, ref: string }[]}
 */
export function sitesDuChapitre(texte, file) {
  const out = []
  const chapitre = parseChapitre(texte)
  for (const section of chapitre.sections) {
    const tables = tablesOf(section)
    for (const { table } of tables) {
      const ref = refDeTable(section.slug, section.occ, table.headers)
      const cellules = [...table.headers, ...table.rows.flat()]
      if (cellules.some((c) => /<br\s*\/?>/i.test(c))) out.push({ famille: 'br-litteral', file, ref })
      if (estCleDePlage(table.headers[0] ?? '')) out.push({ famille: 'donnee-en-tete', file, ref })
      if (table.banniereRefusee != null) out.push({ famille: 'banniere-suspecte', file, ref })
    }
    // Clés de ligne PARTAGÉES : une clé présente dans DEUX tables de la même section rend
    // `ligne-ambigue` à la résolution (`celluleBrute` cherche dans toute la section). Une entrée par
    // CLÉ, jamais par section : au grain section, réparer 19 clés sur 20 ne se verrait pas (#1727).
    // COUVERTURE DITE — cette famille ne nomme QUE les clés partagées ENTRE tables, parce que c'est
    // le périmètre exact d'UN geste : restituer les headings imprimés qui séparent les tables. Le
    // prédicat réel de `rowsMatching` est bien plus large, et mesuré le 2026-09-14 sur les 16 livres :
    // 145 clés partagées entre tables (ce qui suit), 220 si l'on compte aussi les clés DUPLIQUÉES
    // dans une même table, 2 289 si l'on compte toute VALEUR de cellule répétée dans la section.
    // Les 2 144 de l'écart ne sont pas niés : ils ne se réparent pas par un heading, et la famille
    // qui les porterait n'aurait aucun geste à offrir.
    if (tables.length >= 2) {
      const parCle = new Map()
      tables.forEach(({ table }, i) => {
        for (const cle of new Set(table.rows.map(cleDeLigne).filter(Boolean))) {
          if (!parCle.has(cle)) parCle.set(cle, new Set())
          parCle.get(cle).add(i)
        }
      })
      for (const [cle, dansTables] of parCle) {
        if (dansTables.size < 2) continue
        out.push({ famille: 'cle-de-ligne-ambigue', file, ref: `${section.slug}#${section.occ} :: ${cle}` })
      }
    }
  }
  // `span-colle` se mesure sur le texte BRUT : `stripSpans` retire les balises avant les blocs, le
  // marqueur de folio collé à la première ligne de table y est donc INVISIBLE — alors qu'il fait
  // manquer cette ligne à `TABLE_LINE` (elle n'ouvre plus par `|`). La réf est le FOLIO porté, la
  // seule identité stable d'une ligne de `Source/`.
  for (const l of texte.split('\n')) {
    if (!/data-folio/.test(l) || !/<\/span>\s*\|/.test(l)) continue
    const folio = /data-folio="(-?\d+)"/.exec(l)?.[1] ?? '?'
    out.push({ famille: 'span-colle', file, ref: `folio ${folio}` })
  }
  return out
}

/** Chemin POSIX d'un chapitre depuis la racine du dépôt (`Source/<livre>/<NN - X>.md`). */
const cheminDe = (dir, file) => `${String(dir).split('\\').join('/').replace(/\/$/, '')}/${file}`

/** Balaie un dossier de livre → sites de défaut de tous ses chapitres. */
export function scanBookDir(dir) {
  const out = []
  for (const file of listerDossier(dir, { absent: 'vide' }).filter((f) => CHAPTER_FILE_RE.test(f))) {
    out.push(...sitesDuChapitre(readText(join(dir, file)), cheminDe(dir, file)))
  }
  return out
}

/** Balaie tous les livres de `books` (BOOKS par défaut) → sites agrégés, dans l'ordre du corpus. */
export function scanAllBooks(books = BOOKS) {
  const out = []
  for (const [, dir] of books) out.push(...scanBookDir(dir))
  return out
}

/** Compte par famille (toutes les familles présentes, même à zéro). */
export const comptesParFamille = (sites) =>
  Object.fromEntries(FAMILLES.map((f) => [f, sites.filter((s) => s.famille === f).length]))

/** Les ENTRÉES du stock, dans l'ordre du balayage — c'est CE rendu que le fichier de stock porte. */
export const entreesDe = (sites, { lot, date }) =>
  FAMILLES.flatMap((famille) =>
    sitesEnEntrees(sites.filter((s) => s.famille === famille), { famille }).map((e) => ({ ...e, lot, date })),
  )

/**
 * ÉCART au stock, famille par famille (le stock d'une famille ne juge que ses sites : mêlés, tous
 * les sites des autres familles paraîtraient périmés).
 * @returns {{ neuves: string[], perimees: string[] }}
 */
export function ecartDuStock(sites, stock) {
  const neuves = []
  const perimees = []
  for (const famille of FAMILLES) {
    const r = ecartDuVolet({
      sites: sites.filter((s) => s.famille === famille),
      stock: stock.filter((e) => e.famille === famille),
      famille,
      ou: 'source-tables-stock.json',
    })
    neuves.push(...r.neuves)
    perimees.push(...r.perimees)
  }
  return { neuves, perimees }
}

const QUOI = (comptes) =>
  'Tables du `Source/` que leur FORME rend inadressables (#1384, épique #1388) : une ENTRÉE par SITE, ' +
  `clé \`famille :: fichier :: ref :: occurrence\` (régime #1711). Compte par famille à la naissance : ${
    FAMILLES.map((f) => `${f} ${comptes[f]}`).join(', ')
  }. ` +
  'PLAN de résorption — B2 : `br-litteral` et `span-colle` se soldent par UNE migration rejouable ' +
  '(le `<br>` d\'une cellule devient une espace ; le `<span data-folio>` collé passe seul sur la ligne ' +
  'précédente), soit −(br-litteral + span-colle) entrées. B3 et suivants : une ZONE par train, ' +
  'corrigée à la main au PDF (geste `docs/ajouter-un-livre-source.md` §7) — `18 - Traumatisme`, ' +
  '`10 - Talents`, `61 - Encombrement`, `62 - Les armes`, `85 - Traits`, `08 - Statut`, ' +
  '`14 - _GoBack`, `40 - Les prières`, `46 - Les règles magiques`, `05 - _gjdgxs` du Livre de base ; ' +
  'zones portées par tickets existants : #1707 (table de Talents dupliquée), #1519 ' +
  '(`51 - Magie du Chaos` mal titré), #678 (EDOC `09 - _GoBack.md`, en-têtes orphelins). Le résidu de ' +
  'SCÉNARIO (hors donnée de règle) est porté par #1731. ' +
  'COUVERTURE DITE de `cle-de-ligne-ambigue` : elle nomme les clés partagées ENTRE tables d\'une ' +
  'section — le périmètre d\'UN geste (restituer les headings imprimés). Les clés dupliquées DANS ' +
  'une même table et les valeurs non-clés répétées rendent aussi `ligne-ambigue` et restent HORS de ' +
  'cette famille : mesuré le 2026-09-14, 145 ici, 220 au grain « clé dupliquée dans la section », ' +
  '2 289 au prédicat réel de `rowsMatching` (toute valeur de cellule répétée). ' +
  'LIMITE DITE : `banniere-suspecte` est le résidu que la garde du parseur n\'absorbe PAS. Il se ' +
  'ventile (mesure du 2026-09-14) en texte NON majuscule 51, bandeau MAJUSCULE sans rangée de ' +
  'donnée 49 (pour l\'essentiel des titres de statbloc de PNJ et leurs rubriques : ' +
  '« ISABELLA — PROPHÈTE (BRONZE 4) », « COMPÉTENCES DE BASE »), une seule lettre 11, aucune ' +
  'lettre 1, et bandeau MAJUSCULE devant une table SANS en-têtes 1 (fourchette en `headers[0]`). ' +
  'Chacun se tranche au PDF, un par un, jamais par un élargissement de la garde qui sauterait un ' +
  'en-tête réel.'

/** Rend le CONTENU du fichier de stock pour des sites mesurés (source unique de sa forme). */
export const stockDe = (sites, { lot, date }) =>
  `${JSON.stringify({ quoi: QUOI(comptesParFamille(sites)), entrees: entreesDe(sites, { lot, date }) }, null, 2)}\n`

function main() {
  const args = process.argv.slice(2)
  const sites = scanAllBooks()
  const comptes = comptesParFamille(sites)

  if (args.includes('--ecrire-stock')) {
    const lot = '#1384 B1'
    const date = new Date().toISOString().slice(0, 10)
    writeFileSync(STOCK_PATH, stockDe(sites, { lot, date }))
    console.log(`stock écrit : ${STOCK_PATH} — ${entreesDe(sites, { lot, date }).length} entrée(s)`)
    return
  }

  console.log(
    `tables cassées du Source/ : ${sites.length} site(s) sur ${new Set(sites.map((s) => s.file)).size} chapitre(s), ` +
      `${BOOKS.length} livre(s) — ${FAMILLES.map((f) => `${f} ${comptes[f]}`).join(', ')}`,
  )

  const { neuves, perimees } = ecartDuStock(sites, readStock(STOCK_PATH))
  if (neuves.length) {
    console.log('RÉGRESSION — site(s) hors du stock :')
    for (const o of neuves) console.log(`  ${o}`)
  }
  if (perimees.length) {
    console.log('Entrée(s) SOLDÉE(s) (défaut réparé) :')
    for (const s of perimees) console.log(`  ${s}`)
  }
  if (!neuves.length && !perimees.length) {
    console.log('OK — cliquet aligné, aucune régression.')
    return
  }
  process.exitCode = 1
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isMain) main()
