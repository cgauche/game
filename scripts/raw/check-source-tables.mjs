// Garde des TABLES CASSÉES du `Source/` (#1384, épique #1388). L'extraction Marker rend les tables
// imprimées avec des défauts de FORME qui les laissent inadressables (`descRef` de cellule) : un
// `<br>` littéral dans une cellule, une continuation de table après saut de page dont les
// « en-têtes » sont une fourchette de données, un bandeau de titre non absorbable, et des clés de
// ligne partagées entre deux tables d'une même section (qui rendent `ligne-ambigue` à la résolution).
//
// CE QUI N'EST PAS UN DÉFAUT ICI : un marqueur de folio (`<span data-folio>`) collé à la première
// ligne d'une table. La LIB l'absorbe (`toBlocks` applique `stripSpans` AVANT `parseTable`) — mesuré
// le 2026-09-14 : 25 lignes sur 25 ouvrent bien par `|` une fois les `<span>` retirés, et aucun
// lecteur ne lit ces lignes à l'état brut. Il ne bloque donc AUCUNE adresse, et l'ancre reste où la
// page coupe : `Source/` ne se réécrit pas pour un défaut que la lib absorbe déjà.
//
// QUI POSSÈDE QUOI : le PARSEUR (`src/data/source/decoupe.ts`) définit la table — ce script importe
// `parseChapitre`, `tablesOf`, `normText` et `estCleDePlage` (et lit, par `tablesOf`, ce que
// `parseTable` a décidé : `titre` absorbé, `banniereRefusee`), il n'en redéfinit AUCUN ; il CONSOMME
// et NOMME. La réparation, elle, vit dans `Source/` (geste `docs/ajouter-un-livre-source.md` §7) —
// jamais dans un remède au parsing.
//
// STOCK NOMINATIF (`scripts/raw/source-tables-stock.json`, régime #1711) : une ENTRÉE par SITE,
// clé `famille :: fichier :: ref :: occurrence` (`guards/lib/stock.mjs`, `cleDeSite` — seule définition, #1727). La clé ne porte
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
import { ecartDuVolet, sitesEnEntrees, cleDeSite, parCleDeSite, survieDeLecheance } from '../guards/lib/stock.mjs'
import { readStock } from './stockNominatif.mjs'
import { parseChapitre, tablesOf, normText, estCleDePlage } from '../../src/data/source/decoupe.ts'

export const STOCK_PATH = join(dirname(fileURLToPath(import.meta.url)), 'source-tables-stock.json')
const CHAPTER_FILE_RE = /^(\d+) - .*\.md$/

/** Les familles de défaut, dans l'ordre du rapport. Chacune est un GESTE de réparation distinct
 *  (cf. le tableau « défaut de table → geste » de `docs/ajouter-un-livre-source.md` §7). */
export const FAMILLES = [
  'br-litteral',
  'donnee-en-tete',
  'banniere-suspecte',
  'cle-de-ligne-ambigue',
]

/** RÉF d'une table : sa section et ses en-têtes NORMALISÉS — du contenu, jamais une position.
 *  Le `<br>` littéral y compte pour une ESPACE sans aucun traitement local : `normText` compose
 *  `sansBr` (`src/data/source/normalize.ts`, définition UNIQUE de la forme), donc une clé ne bouge
 *  pas le jour où le site se corrige à la main dans `Source/`. */
export const refDeTable = (sec, occ, headers) =>
  `${sec}#${occ} :: ${headers.map((h) => normText(h)).join('|')}`

/** Clé de LIGNE d'une rangée : sa première cellule non vide, normalisée (`''` si la rangée est vide,
 *  `<br>` absorbé par `normText` comme dans la réf ci-dessus). */
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

/**
 * Les ENTRÉES du stock, en ORDRE CANONIQUE (`parCleDeSite`) — c'est CE rendu que le fichier de stock
 * porte. L'ordre du BALAYAGE n'y entre pas : réordonner `src/data/books.json` ne réécrit pas ce
 * fichier (#1825).
 * `ancien` (les entrées déjà committées) porte la SURVIE : `survieDeLecheance`
 * (`scripts/guards/lib/stock.mjs`), seule définition du dépôt.
 * @param {{famille: string, file: string, ref: string}[]} sites
 * @param {{ lot: string, date: string, ancien?: Iterable<object> }} p
 */
export const entreesDe = (sites, { lot, date, ancien = [] }) =>
  FAMILLES.flatMap((famille) =>
    survieDeLecheance(sitesEnEntrees(sites.filter((s) => s.famille === famille), { famille }), { lot, date, ancien }),
  ).sort(parCleDeSite)

/** Les clés des sites MESURÉS (même occurrence que le stock : le calcul d'occurrence est celui de
 *  `sitesEnEntrees`, jamais un second comptage). */
export const clesMesurees = (sites) =>
  new Set(entreesDe(sites, { lot: '', date: '' }).map(cleDeSite))

/**
 * VERDICT des `preuve` du stock — une preuve est un FAIT daté (« PDF p.N : … »), pas une dispense :
 *   - `vides` : une entrée qui porte le champ `preuve` sans rien prouver (chaîne vide ou non-chaîne) ;
 *     exempter par un champ vide serait un cliquet percé ;
 *   - `perimees` : une entrée PROUVÉE dont le site n'est plus mesuré — la preuve parle d'un site qui
 *     n'existe plus (`Source/` a bougé), elle se re-lit au PDF ou l'entrée se retire.
 * @returns {{ vides: string[], perimees: string[] }}
 */
export function verdictDesPreuves(sites, stock) {
  const mesurees = clesMesurees(sites)
  const vides = []
  const perimees = []
  for (const e of stock) {
    if (!('preuve' in e)) continue
    if (typeof e.preuve !== 'string' || !e.preuve.trim()) {
      vides.push(`${cleDeSite(e)} — \`preuve\` VIDE : une preuve est un fait lu au PDF (« PDF p.N : … »), ou rien.`)
      continue
    }
    if (!mesurees.has(cleDeSite(e))) {
      perimees.push(`${cleDeSite(e)} — preuve PÉRIMÉE : ce site n'est plus mesuré, la preuve ne parle plus de rien.`)
    }
  }
  return { vides, perimees }
}

/** Comptes de la dette : ce qui reste À TRIER (aucune preuve) et ce qui est VÉRIFIÉ (preuve lue au PDF). */
export const comptesDeTri = (stock) => {
  const verifies = [...stock].filter((e) => typeof e.preuve === 'string' && e.preuve.trim()).length
  return { aTrier: [...stock].length - verifies, verifies }
}

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
  'CE FICHIER EST UN INVENTAIRE des sites mesurés, PLAFONNÉ en nombre d\'entrées : il ne décroît que ' +
  'quand un site disparaît du `Source/`. La DETTE, elle, est le compte « à trier » — les entrées SANS ' +
  '`preuve` — et celle-là décroît vers zéro, sous son propre plafond (`PLAFOND_A_TRIER`, ' +
  '`check-source-tables.test.mjs`) : une entrée reçoit sa `preuve` (« PDF p.N : … ») + sa `date` le jour ' +
  'où sa forme est lue au PDF et jugée conforme au livre, et elle RESTE (le site existe, il est jugé). ' +
  'PLAN de résorption — B2 : AUCUNE migration de `Source/`. Un `<br>` de cellule est un saut de ' +
  'ligne IMPRIMÉ (GFM n\'a pas d\'autre forme) : la lib l\'absorbe pour l\'ADRESSAGE (`sansBr`) et le ' +
  'rend en `\\n` pour une cellule (`brEnSaut`), donc il ne bloque plus une adresse. Son SENS, lui, se ' +
  'lit AU PDF, site par site : une CÉSURE typographique se corrige en espace dans `Source/`, une ' +
  'liste d\'items imprimée en colonne se garde telle quelle et se solde par une `preuve` sur son ' +
  'entrée (« PDF p.N : … » + `date`). B3 et suivants : une ZONE par train, ' +
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
export const stockDe = (sites, { lot, date, ancien = [] }) =>
  `${JSON.stringify({ quoi: QUOI(comptesParFamille(sites)), entrees: entreesDe(sites, { lot, date, ancien }) }, null, 2)}\n`

function main() {
  const args = process.argv.slice(2)
  const sites = scanAllBooks()
  const comptes = comptesParFamille(sites)
  const stock = readStock(STOCK_PATH)

  if (args.includes('--ecrire-stock')) {
    const lot = '#1384 B2'
    const date = new Date().toISOString().slice(0, 10)
    writeFileSync(STOCK_PATH, stockDe(sites, { lot, date, ancien: stock }))
    console.log(`stock écrit : ${STOCK_PATH} — ${entreesDe(sites, { lot, date, ancien: stock }).length} entrée(s)`)
    return
  }

  const tri = comptesDeTri(stock)
  console.log(
    `tables cassées du Source/ : ${sites.length} site(s) sur ${new Set(sites.map((s) => s.file)).size} chapitre(s), ` +
      `${BOOKS.length} livre(s) — ${FAMILLES.map((f) => `${f} ${comptes[f]}`).join(', ')}`,
  )
  console.log(`stock : ${tri.aTrier} à trier (aucune preuve), ${tri.verifies} vérifié(s) au PDF.`)

  const { neuves, perimees } = ecartDuStock(sites, stock)
  const preuves = verdictDesPreuves(sites, stock)
  if (neuves.length) {
    console.log('RÉGRESSION — site(s) hors du stock :')
    for (const o of neuves) console.log(`  ${o}`)
  }
  if (perimees.length) {
    console.log('Entrée(s) SOLDÉE(s) (défaut réparé) :')
    for (const s of perimees) console.log(`  ${s}`)
  }
  if (preuves.vides.length || preuves.perimees.length) {
    console.log('PREUVE(s) en défaut :')
    for (const s of [...preuves.vides, ...preuves.perimees]) console.log(`  ${s}`)
  }
  if (!neuves.length && !perimees.length && !preuves.vides.length && !preuves.perimees.length) {
    console.log('OK — cliquet aligné, aucune régression.')
    return
  }
  process.exitCode = 1
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isMain) main()
