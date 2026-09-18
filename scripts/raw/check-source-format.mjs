// Garde du FORMAT CANONIQUE des extractions de `Source/` (#1739, épique #1388). Toutes les
// extractions n'ont pas la même FORME : six livres portent un en-tête `*Folio N+*` et des ancres
// seules sur leur ligne (chaîne de 2026-07-07), un livre n'a aucun folio, quatre dossiers sont
// antérieurs au pipeline. Le format canonique — celui que `docs/ajouter-un-livre-source.md` décrit,
// que le découpeur produit — est UN, et cette garde MESURE l'écart de chaque dossier à ce format.
//
// QUI POSSÈDE QUOI : `docs/ajouter-un-livre-source.md` § « Format canonique » DÉFINIT la forme ;
// ce script la MESURE et NOMME les dossiers hors format ; `src/data/books.json` reste la source
// unique des livres à `dir`. Les dossiers FR encore hors registre (les quatre pré-pipeline) sont
// atteints par BALAYAGE de `Source/` sur les préfixes de `PREFIXES_FR` — sans quoi un dossier
// suivi mais non enregistré échapperait à toute garde.
//
// LE GESTE, UN SEUL : REJOUER la chaîne canonique sur le livre — re-découpe depuis la sortie
// Marker conservée sous `Source/_marker/`, ou ré-extraction quand cette sortie manque. Jamais un
// remède local de chapitre. Arbitrage utilisateur du 2026-09-14, verbatim : « Il faut un format
// unifié pour toutes les extractions, donc s'il faut rééxtraire, on rééxtrait » — fiche
// `.claude/memory/user-doctrine-format-unifie-reextraction-permise.md`.
//
// STOCK NOMINATIF (`scripts/raw/source-format-stock.json`, régime #1711) : une ENTRÉE par
// (famille, dossier, détail), clé `famille :: fichier :: ref :: occurrence`
// (`guards/lib/stock.mjs`, `cleDeSite` — seule définition, #1727). L'unité de RÉPARATION est le
// LIVRE ré-extrait, pas le chapitre : d'où UNE entrée par famille et par dossier, dont la `ref`
// porte le détail compté. Le `fichier` nomme le PREMIER chapitre fautif de ce dossier — un
// chemin de DOSSIER nu (`Source/<livre>`) ne tombe sous aucun motif de
// `scripts/guards/lib/stocksNominatifs.mjs` (`CHEMIN_SOURCE` exige `.md`) et laisserait les 57
// entrées HORS DE VUE des deux portes de croissance (mesuré le 2026-09-14 : `stocks-nominatifs`
// refusait « 0 entrée(s) vue(s) sur 57 déclarée(s) »). Les deux sens sont rouges : un écart
// MESURÉ hors du stock (ré-extraire le livre, ou déclarer par `CLIQUET:`), une entrée SANS écart
// mesuré (livre ré-extrait : la retirer).
//
// Re-run    : node scripts/raw/check-source-format.mjs
// Régénérer : node scripts/raw/check-source-format.mjs --ecrire-stock
import { existsSync, writeFileSync, statSync } from 'node:fs'
import { join, dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { listerDossier, parUnitesDeCode } from '../guards/lib/lister.mjs'
import { BOOKS, readText } from './_lib.mjs'
import { ecartDuVolet, sitesEnEntrees } from '../guards/lib/stock.mjs'
import { readStock } from './stockNominatif.mjs'

export const STOCK_PATH = join(dirname(fileURLToPath(import.meta.url)), 'source-format-stock.json')

/** Racine des extractions. */
export const RACINE_SOURCE = 'Source'

/** Préfixes des dossiers FRANÇAIS suivis de `Source/`. La garde couvre en plus tout livre à `dir`
 *  de `books.json`, quel que soit son préfixe (`dossiersFR`). Le reste de `Source/` est la VO du
 *  dépôt parent MJ, hors de cette garde ; son unique livre citable est nommé au CLAUDE.md
 *  § Sources VF. */
export const PREFIXES_FR = [
  'Warhammer v4 - ',
  'WH - V4 - ',
  'WH4_FR_',
  "Boite d'Initiation",
  'Warhammer - Habitants',
]

/** Les familles d'écart, dans l'ordre du rapport. Chacune est un défaut de FORME distinct. */
export const FAMILLES = [
  'ligne1-hors-format',
  'sans-folio',
  'ancre-seule',
  'nom-de-signet',
  'html-residuel',
  'index-mort',
  'table-sans-separateur',
]

const CHAPITRE_RE = /^(\d+) - (.*)\.md$/
export const INDEX = '00 - Index.md'

/** Ligne 1 CANONIQUE d'un chapitre : la tranche de pages PDF posée par le découpeur. La borne HAUTE
 *  est OPTIONNELLE — un chapitre d'UNE page rend `*Pages PDF 48*` (LDB `06 - Classes.md` l.1), et
 *  c'est la forme que les trois gardes de la même chaîne lisent déjà
 *  (`anchor-fill.mjs:53`, `check-folio-continuity.mjs:32`, `folio-bootstrap.mjs:30`, qui ancrent
 *  `^\*Pages PDF (\d+)(?:-(\d+))?\*` — borne haute en groupe optionnel). */
export const LIGNE1_CANONIQUE = /^\*Pages PDF \d+(?:-\d+)?\*$/

/** Ancre de page telle que la chaîne canonique la pose (INLINE, préfixe du texte de sa ligne). */
const ANCRE_PAGE = /<span [^>]*id="page-[^"]*"[^>]*>\s*<\/span>/g
const ANCRE_SEULE = /^<span [^>]*id="page-[^"]*"[^>]*>\s*<\/span>$/

/**
 * FORME de la ligne 1 d'un chapitre, ou `null` si elle est canonique. La forme est ce que le stock
 * NOMME : c'est elle qui dit de quelle chaîne d'extraction le livre est sorti.
 * @param {string} ligne @returns {string | null}
 */
export function formeDeLigne1(ligne) {
  const t = ligne.trim()
  if (LIGNE1_CANONIQUE.test(t)) return null
  if (/^\*Folio -?\d+\+?\*$/.test(t)) return '*Folio N+*'
  if (t.startsWith('#')) return '# Titre'
  if (t === '') return '(ligne vide)'
  return 'autre'
}

/** Le titre d'un chapitre est-il un SIGNET Word (`_GoBack`, `_gjdgxs`, `Sans titre`) plutôt que le
 *  titre imprimé ? Ces noms polluent l'index et rendent la réf de chapitre illisible. */
export const estNomDeSignet = (titre) => titre.startsWith('_') || /^sans titre$/i.test(titre.trim())

/** Une ligne de SÉPARATEUR de table Markdown (`| --- | --- |`, `|--|--|--|`). */
export function estSeparateur(ligne) {
  const t = ligne.trim().replace(/\s+/g, '')
  return t.startsWith('|') && /^[|:-]+$/.test(t) && t.includes('--')
}

/** La ligne DÉBARRASSÉE de ses ancres de page (une table ouverte par une ancre reste une table). */
const sansAncres = (ligne) => ligne.replace(ANCRE_PAGE, '')

/**
 * Blocs de TABLE d'un texte : suites maximales de lignes ouvrant par `|`.
 * @returns {{ total: number, sansSeparateur: number }}
 */
export function comptesDeTables(texte) {
  const lignes = texte.split('\n')
  let total = 0
  let sansSeparateur = 0
  let bloc = []
  const clore = () => {
    if (!bloc.length) return
    total += 1
    if (bloc.length < 2 || !estSeparateur(bloc[1])) sansSeparateur += 1
    bloc = []
  }
  for (const l of lignes) {
    if (sansAncres(l).trim().startsWith('|')) bloc.push(sansAncres(l))
    else clore()
  }
  clore()
  return { total, sansSeparateur }
}

/**
 * Balises HTML RÉSIDUELLES d'un texte, par nom de balise. Hors périmètre : `<br>` (le RAW imprimé
 * porte de vraies césures) et les ancres de page, qui SONT le format canonique. Une ancre sans
 * `data-folio` n'est donc pas comptée ici : la famille `sans-folio` la nomme déjà, au grain du
 * chapitre — la compter deux fois dirait deux réparations là où il n'y en a qu'une.
 * @returns {Map<string, number>}
 */
export function balisesResiduelles(texte) {
  const out = new Map()
  // Balise OUVRANTE seule : compter aussi `</sup>` doublerait chaque ÉLÉMENT (mesuré le
  // 2026-09-14 : 392 balises pour 196 `<sup>` imprimés).
  for (const m of texte.replace(ANCRE_PAGE, '').matchAll(/<([a-zA-Z][\w-]*)\b[^>]*>/g)) {
    const tag = m[1].toLowerCase()
    if (tag === 'br') continue
    out.set(tag, (out.get(tag) ?? 0) + 1)
  }
  return out
}

/** Cibles des liens RELATIFS d'un index (`[x](<01 - Y.md>)` ou `[x](01%20-%20Y.md)`). */
export function liensDIndex(texte) {
  const out = []
  for (const m of texte.matchAll(/\]\((?:<([^>]+)>|([^)\s]+))\)/g)) {
    const cible = m[1] ?? m[2]
    if (/^(?:https?:|mailto:|#)/.test(cible)) continue
    let decode = cible
    try { decode = decodeURIComponent(cible) } catch { /* cible non décodable : jugée telle quelle */ }
    out.push(decode)
  }
  return out
}

/**
 * Sites d'écart d'UN dossier (PUR : aucun accès disque). `dir` est le chemin POSIX du dossier ;
 * `fichiers` la liste `{ nom, texte }` de ses `.md`. Chaque site nomme le PREMIER chapitre fautif
 * de sa famille (le `fichier` du stock) et porte le DÉTAIL COMPTÉ du dossier en `ref`.
 *
 * COUVERTURE DITE : les familles (1) à (4) ne jugent que les fichiers au motif `NN - X.md`
 * (`CHAPITRE_RE`), `00 - Index.md` exclu — un `.md` hors motif leur est INVISIBLE (mesuré le
 * 2026-09-14 : 0 fichier hors motif sur les 20 dossiers FR). Les familles (5) `html-residuel` et
 * (7) `table-sans-separateur` balaient TOUS les `.md` du dossier, index compris ; (6) `index-mort`
 * ne lit que `00 - Index.md`.
 * @param {string} dir @param {{ nom: string, texte: string }[]} fichiers
 * @returns {{ famille: string, file: string, ref: string }[]}
 */
export function sitesDuDossier(dir, fichiers) {
  const out = []
  const noms = new Set(fichiers.map((f) => f.nom))
  const chapitres = fichiers.filter((f) => CHAPITRE_RE.test(f.nom) && f.nom !== INDEX)
  const chemin = (nom) => `${dir}/${nom}`

  // (1) ligne 1 hors format — une entrée par FORME rencontrée.
  const formes = new Map()
  for (const { nom, texte } of chapitres) {
    const forme = formeDeLigne1(texte.split('\n')[0] ?? '')
    if (!forme) continue
    const vu = formes.get(forme)
    formes.set(forme, { premier: vu?.premier ?? nom, n: (vu?.n ?? 0) + 1 })
  }
  for (const forme of [...formes.keys()].sort(parUnitesDeCode)) {
    const { premier, n } = formes.get(forme)
    out.push({ famille: 'ligne1-hors-format', file: chemin(premier), ref: `${forme} ×${n}` })
  }

  // (2) chapitres SANS aucune ancre `data-folio` : rien n'y est adressable au folio imprimé.
  const sansFolio = chapitres.filter(({ texte }) => !/data-folio/.test(texte))
  if (sansFolio.length) {
    out.push({ famille: 'sans-folio', file: chemin(sansFolio[0].nom), ref: `${sansFolio.length} chapitre(s)` })
  }

  // (3) ancres SEULES sur leur ligne : la forme « scan/folio », qui casse l'adressage au texte
  // (l'ancre ne préfixe plus le paragraphe qu'elle ouvre).
  let seules = 0
  let ancres = 0
  let premiereSeule = null
  for (const { nom, texte } of chapitres) {
    for (const l of texte.split('\n')) {
      if (!/data-folio/.test(l)) continue
      ancres += 1
      if (!ANCRE_SEULE.test(l.trim())) continue
      seules += 1
      premiereSeule ??= nom
    }
  }
  if (seules) {
    out.push({ famille: 'ancre-seule', file: chemin(premiereSeule), ref: `${seules} ancres seules / ${ancres}` })
  }

  // (4) noms de SIGNET Word à la place du titre imprimé.
  const signets = chapitres.map((f) => f.nom).filter((n) => estNomDeSignet(CHAPITRE_RE.exec(n)[2]))
  if (signets.length) {
    out.push({ famille: 'nom-de-signet', file: chemin(signets[0]), ref: `${signets.length} fichier(s) : ${signets.join(', ')}` })
  }

  // (5) HTML résiduel — une entrée par BALISE (chacune se retire d'un geste distinct).
  const balises = new Map()
  for (const { nom, texte } of fichiers) {
    for (const [tag, n] of balisesResiduelles(texte)) {
      const vu = balises.get(tag)
      balises.set(tag, { premier: vu?.premier ?? nom, n: (vu?.n ?? 0) + n })
    }
  }
  for (const tag of [...balises.keys()].sort(parUnitesDeCode)) {
    const { premier, n } = balises.get(tag)
    out.push({ famille: 'html-residuel', file: chemin(premier), ref: `<${tag}> ×${n}` })
  }

  // (6) index MORT : un lien relatif vers un fichier absent du dossier.
  const index = fichiers.find((f) => f.nom === INDEX)
  if (index) {
    const morts = liensDIndex(index.texte).filter((c) => !noms.has(c))
    if (morts.length) out.push({ famille: 'index-mort', file: chemin(INDEX), ref: `${morts.length} lien(s)` })
  }

  // (7) tables sans ligne de SÉPARATEUR : le bloc n'est pas une table pour un parseur Markdown.
  let tables = 0
  let cassees = 0
  let premiereCassee = null
  for (const { nom, texte } of fichiers) {
    const c = comptesDeTables(texte)
    tables += c.total
    cassees += c.sansSeparateur
    if (c.sansSeparateur) premiereCassee ??= nom
  }
  if (cassees) {
    out.push({ famille: 'table-sans-separateur', file: chemin(premiereCassee), ref: `${cassees}/${tables} tables` })
  }

  return out
}

/** Chemin POSIX d'un dossier depuis la racine du dépôt. */
const cheminDe = (dir) => String(dir).split('\\').join('/').replace(/\/$/, '')

/** Les `.md` d'un dossier, lus (CRLF normalisé par `readText`). */
export function lireDossier(dir) {
  return listerDossier(dir, { absent: 'vide' })
    .filter((n) => n.endsWith('.md'))
    .map((nom) => ({ nom, texte: readText(join(dir, nom)) }))
}

/** Balaie UN dossier de livre → ses sites d'écart. */
export const scanDossier = (dir) => sitesDuDossier(cheminDe(dir), lireDossier(dir))

/**
 * Les DOSSIERS FR suivis, dans l'ordre POSIX : l'union des livres à `dir` de `books.json` et du
 * balayage de `Source/` sur `PREFIXES_FR`. Un livre enregistré dont le dossier manque sur le disque
 * LÈVE — un corpus amputé rendrait un vert muet (`sourceCorpus.mjs`, refus du vide).
 * @returns {string[]}
 */
export function dossiersFR(racine = RACINE_SOURCE, books = BOOKS) {
  const vus = new Set()
  for (const [abbr, dir] of books) {
    const p = cheminDe(dir)
    if (!existsSync(p)) throw new Error(`check-source-format : livre "${abbr}" de books.json sans dossier sur le disque (${p})`)
    vus.add(p)
  }
  for (const nom of listerDossier(racine, { absent: 'lever' })) {
    if (!PREFIXES_FR.some((p) => nom.startsWith(p))) continue
    const p = `${racine}/${nom}`
    let st
    try { st = statSync(p) } catch { continue }
    if (st.isDirectory()) vus.add(p)
  }
  const out = [...vus].sort(parUnitesDeCode)
  if (!out.length) throw new Error(`check-source-format : aucun dossier FR sous ${racine}/ — balayage amputé`)
  return out
}

/** Balaie tous les dossiers FR → sites agrégés, dans l'ordre du corpus. */
export function scanAll(dossiers = dossiersFR()) {
  const out = []
  for (const dir of dossiers) out.push(...scanDossier(dir))
  return out
}

/** Compte par famille (toutes les familles présentes, même à zéro). */
export const comptesParFamille = (sites) =>
  Object.fromEntries(FAMILLES.map((f) => [f, sites.filter((s) => s.famille === f).length]))

/** Compte par DOSSIER de livre — le `file` d'un site nomme un CHAPITRE, le dossier en est le
 *  préfixe. C'est le grain du rapport : l'unité de réparation est le livre. */
export const comptesParDossier = (sites) => {
  const out = new Map()
  for (const s of sites) {
    const dossier = s.file.slice(0, s.file.lastIndexOf('/'))
    out.set(dossier, (out.get(dossier) ?? 0) + 1)
  }
  return out
}

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
      ou: 'source-format-stock.json',
    })
    neuves.push(...r.neuves)
    perimees.push(...r.perimees)
  }
  return { neuves, perimees }
}

const QUOI = ({ comptes, dossiers, entrees }) =>
  'Écart de FORME des extractions de `Source/` au format canonique (#1739, épique #1388) : une ' +
  'ENTRÉE par (famille, dossier, détail), clé `famille :: fichier :: ref :: occurrence` (régime ' +
  `#1711). Format DÉFINI par \`docs/ajouter-un-livre-source.md\` § « Format canonique ». ` +
  `${dossiers} dossier(s) FR balayé(s). ` +
  `Compte par famille à la naissance : ${FAMILLES.map((f) => `${f} ${comptes[f]}`).join(', ')}. ` +
  'LE GESTE, UN SEUL — REJOUER la chaîne canonique sur le livre : re-découpe depuis la sortie ' +
  'Marker conservée sous `Source/_marker/`, ou ré-extraction quand cette sortie manque. Jamais un ' +
  'remède de chapitre (arbitrage utilisateur 2026-09-14 : « Il faut un format unifié pour toutes ' +
  'les extractions, donc s’il faut rééxtraire, on rééxtrait »). ' +
  'DÉCROISSANCE : un livre repassé par la chaîne sort du stock dans le train qui l’intègre — ses ' +
  'entrées se retirent dans le MÊME commit que le dossier remplacé, et la garde refuse alors toute ' +
  'entrée sans écart mesuré. L’ORDRE de ré-extraction vit sur #1739. ' +
  'LIMITE DITE, et VOULUE — le DÉTAIL est un COMPTE : `ref` porte « ×N », donc tout geste NON ' +
  'CANONIQUE (corriger une occurrence sur N à la main) déplace la clé et ROUGIT cette garde. C’est ' +
  'exactement ce qu’on veut : un geste non canonique se voit. La porte de PLAGE ' +
  '(`croissanceDesStocks`), elle, n’y verrait qu’un −1/+1 net 0 sur la même ligne — c’est la SUITE ' +
  'qui tient ce cas, pas la porte de plage. ' +
  'CE QUE LE `fichier` NOMME — le PREMIER chapitre fautif de la famille dans ce dossier, jamais le ' +
  'dossier nu : un chemin sans `.md` ne tombe sous aucun motif de ' +
  `\`scripts/guards/lib/stocksNominatifs.mjs\` (\`CHEMIN_SOURCE\` exige \`.md\`) et laisserait les ${entrees} ` +
  'entrées hors de vue des deux portes de croissance (mesuré le 2026-09-14 : la garde ' +
  '`stocks-nominatifs` refusait « 0 entrée(s) vue(s) sur 57 déclarée(s) »). ' +
  'COUVERTURE DITE — les familles `ligne1-hors-format`, `sans-folio`, `ancre-seule` et ' +
  '`nom-de-signet` ne jugent que les fichiers au motif `NN - X.md`, `00 - Index.md` exclu ; un `.md` ' +
  'hors motif leur est INVISIBLE (mesuré le 2026-09-14 : 0 fichier hors motif sur les 20 dossiers). ' +
  '`html-residuel` et `table-sans-separateur` balaient, eux, TOUS les `.md` du dossier. ' +
  'COUVERTURE DITE — `html-residuel` ne compte PAS les ancres de page : une ancre sans ' +
  '`data-folio` est déjà nommée par `sans-folio`, et la compter deux fois dirait deux réparations ' +
  'là où il n’y en a qu’une.'

/** Rend le CONTENU du fichier de stock pour des sites mesurés (source unique de sa forme). */
export const stockDe = (sites, { lot, date, dossiers }) => {
  const entrees = entreesDe(sites, { lot, date })
  const quoi = QUOI({ comptes: comptesParFamille(sites), dossiers, entrees: entrees.length })
  return `${JSON.stringify({ quoi, entrees }, null, 2)}\n`
}

function main() {
  const args = process.argv.slice(2)
  const dossiers = dossiersFR()
  const sites = scanAll(dossiers)
  const comptes = comptesParFamille(sites)

  if (args.includes('--ecrire-stock')) {
    const lot = '#1739 H-0'
    const date = new Date().toISOString().slice(0, 10)
    writeFileSync(STOCK_PATH, stockDe(sites, { lot, date, dossiers: dossiers.length }))
    console.log(`stock écrit : ${STOCK_PATH} — ${entreesDe(sites, { lot, date }).length} entrée(s)`)
    return
  }

  const parDossier = comptesParDossier(sites)
  console.log(
    `format des extractions : ${sites.length} écart(s) sur ${parDossier.size} dossier(s) hors format, ` +
      `${dossiers.length} dossier(s) FR balayé(s) — ${FAMILLES.map((f) => `${f} ${comptes[f]}`).join(', ')}`,
  )
  for (const dir of dossiers) {
    if (parDossier.has(dir)) console.log(`  ${dir} — ${parDossier.get(dir)} écart(s)`)
  }

  const { neuves, perimees } = ecartDuStock(sites, readStock(STOCK_PATH))
  if (neuves.length) {
    console.log('RÉGRESSION — écart(s) hors du stock :')
    for (const o of neuves) console.log(`  ${o}`)
  }
  if (perimees.length) {
    console.log('Entrée(s) SOLDÉE(s) (livre ré-extrait) :')
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
