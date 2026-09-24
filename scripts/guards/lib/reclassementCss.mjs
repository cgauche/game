// L'ÉVÉNEMENT DE FRONTIÈRE du stock CSS (#1806 D1″/D2″) : un module qui FRANCHIT la frontière du
// parent au commit (`franchissements`, `cssCouches.mjs`) — revendiqué au manifeste par une primitive
// réutilisée, second importeur gagné, ou ajouté à `FEUILLES_PARTAGEES` — sort ses sites de
// `CSS_IDENTITE_ECRAN_RATCHET` / `CSS_ESPACEMENT_RATCHET` sans les guérir. Le message le DIT :
// `RECLASSEMENT: <module> +N — <motif #ticket>`, UNE ligne par module franchi, N = son prix (`ventiler`,
// `cssCouches.mjs`). Trois refus : un franchissement sans ligne, une ligne sans franchissement, un N
// faux.
//
// Le discriminant est la FRONTIÈRE lue dans chaque côté (`coteCss`, `cssImages.mjs`) — manifeste,
// `FEUILLES_PARTAGEES`, `fichier`s réutilisés —, jamais le libellé `nature` qu'un commit écrit lui-même.
//
// FRONTIÈRE : cette lib CALCULE ; le VERDICT appartient aux appelants — le garde de solde au commit
// (`scripts/hooks/solde-ticket-guard.mjs`), la porte de plage au push (`plageStock.mjs`), chaque
// commit contre son parent (#1806 D3″).
import {
  CHEMIN_COUCHES, CHEMIN_MANIFESTE, RACINE_DES_MODULES, modulesDePrimitive, modulesExemptes, ventiler,
} from './cssCouches.mjs'
import { motifDeCitation, nomsDImport, nomsDImportDe } from './cssImages.mjs'
import { hunksDe } from './hunks.mjs'
import { MOTIF_MIN, declarationsDuMessage, mesuresNonCouvertes } from './stocksNominatifs.mjs'

/** Le mot-clé de la ligne de message. */
const MOT_RECLASSEMENT = 'RECLASSEMENT'

/** Un motif de reclassement nomme le ticket qui le porte. */
const TICKET = /#\d+/

/**
 * Les modules FRANCHIS d'un commit, avec leur prix par volet (`ventiler`), lus sur deux côtés
 * `{ manifeste, partagees, reutilises, lire }` (`coteCss`). Seuls les candidats — exemptés au commit,
 * pas au parent — sont lus : le prix d'un module ne dépend que de ses propres clés (fichier, réf).
 * @param {{ manifeste: readonly { id: string, fichier?: string, css?: string }[], partagees: readonly string[], reutilises: ReadonlySet<string>, lire: (f: string) => string | null }} parent
 * @param {typeof parent} commit
 * @returns {{ module: string, identite: number, espacement: number, n: number }[]} `n > 0`, triés
 */
export function franchisDesCotes(parent, commit) {
  const exP = modulesExemptes(parent)
  const candidats = [...modulesExemptes(commit)].filter((m) => !exP.has(m))
  const mesures = modulesDePrimitive(parent.manifeste)
  const dansLImage = (m) => (m.startsWith(RACINE_DES_MODULES) && m.endsWith('.css')) || mesures.has(m)
  const image = (cote, retenir) => ({
    ...cote,
    fichiers: candidats.filter(retenir).map((rel) => ({ rel, text: cote.lire(rel) })).filter((f) => f.text !== null),
  })
  return ventiler(image(parent, dansLImage), image(commit, () => true)).franchis.filter((f) => f.n > 0)
}

/**
 * Un geste peut-il déplacer la frontière (#1806 E) ? Il touche le manifeste ou `FEUILLES_PARTAGEES`
 * (`cssCouches.mjs`) ; ou il AJOUTE ou SUPPRIME (`nesOuMorts`, chemins `--diff-filter=AD`) un module de
 * code qui porte un nom d'import d'un `fichier` (`nomsDImportDe`) — vide compris : l'ordre de repli de
 * `resolveImport` (`importGraph.mjs`) peut alors faire changer de cible un import que rien ne réécrit,
 * ce qu'une simple MODIFICATION ne fait pas ; ou une ligne retirée ou ajoutée d'un hunk de son diff
 * `-U0` (`hunksDe`) cite un `fichier` du manifeste (`motifDeCitation`, la présélection de `coteCss`).
 * `nesOuMorts`, `diff` et `manifeste` (celui du parent) ne sont lus qu'à défaut des chemins.
 * @param {{ chemins: Iterable<string>, nesOuMorts: () => readonly string[], diff: () => string,
 *   manifeste: () => readonly { fichier?: string }[] }} p
 * @returns {boolean}
 */
export function deplaceLaFrontiere({ chemins, nesOuMorts, diff, manifeste }) {
  if ([...chemins].some((f) => f === CHEMIN_COUCHES || f === CHEMIN_MANIFESTE)) return true
  const lu = manifeste()
  const motif = motifDeCitation(lu)
  if (!motif) return false
  const noms = nomsDImport(lu)
  if (nesOuMorts().some((f) => MODULE_DE_CODE.test(f) && nomsDImportDe(f).some((n) => noms.has(n)))) return true
  const cite = new RegExp(motif)
  return hunksDe(diff()).some(({ retirees, ajoutees }) => [...retirees, ...ajoutees].some((l) => cite.test(l)))
}

/** Un chemin de MODULE de code, que `resolveImport` peut désigner. */
const MODULE_DE_CODE = /\.[cm]?[jt]sx?$/

/** Les lignes `RECLASSEMENT:` d'un message dont le motif porte son `#<ticket>`. */
export const lignesDeReclassement = (message) =>
  declarationsDuMessage(message, MOT_RECLASSEMENT).filter((d) => TICKET.test(d.motif))

/**
 * Les ÉCARTS entre les franchissements d'un commit et les lignes de son message (vide = couvert) :
 * un module franchi sans UNE ligne au N exact (`mesuresNonCouvertes`, juge unique avec `CLIQUET:`),
 * et toute ligne qui nomme un module qui n'a pas franchi.
 * @param {ReturnType<typeof franchisDesCotes>} franchis @param {{ fichier: string, n: number }[]} lignes
 * @returns {{ module: string, n: number | null, declare: number | null, declarees?: number[] }[]}
 *   `n` = le prix, `null` pour une ligne sans franchissement.
 */
export function ecartsDeReclassement(franchis, lignes) {
  const nonCouverts = mesuresNonCouvertes(franchis.map((f) => ({ fichier: f.module, n: f.n })), lignes)
    .map(({ fichier, n, declare, declarees }) => ({ module: fichier, n, declare, ...(declarees ? { declarees } : {}) }))
  const franchi = new Set(franchis.map((f) => f.module))
  const orphelines = lignes.filter((d) => !franchi.has(d.fichier)).map((d) => ({ module: d.fichier, n: null, declare: d.n }))
  return [...nonCouverts, ...orphelines]
}

/**
 * Les écarts d'un COMMIT jugé contre son parent.
 * @param {{ message: string }} p
 * @param {{ parent: Parameters<typeof franchisDesCotes>[0], commit: Parameters<typeof franchisDesCotes>[1] }} cotes
 */
export function reclassementsNonDeclares({ message }, { parent, commit }) {
  return ecartsDeReclassement(franchisDesCotes(parent, commit), lignesDeReclassement(message))
}

/** Un écart, en clair. */
const ceQueDitLeModule = (e) => {
  if (e.n === null) return `${e.module} : ligne \`+${e.declare}\` sans franchissement`
  if (e.declarees) return `${e.module} : franchi au prix ${e.n}, ${e.declarees.length} lignes (${e.declarees.map((n) => `+${n}`).join(', ')}) — une seule par module`
  if (e.declare === null) return `${e.module} : franchi au prix ${e.n}, aucune ligne`
  return `${e.module} : franchi au prix ${e.n}, la ligne annonce \`+${e.declare}\``
}

/**
 * Refus lisible : où (commit ou rien), chaque écart, et le geste. Une image illisible (`illisible`)
 * est dite par son commit.
 * @param {({ sha?: string, ecarts: ReturnType<typeof ecartsDeReclassement> } | { sha: string, illisible: string })[]} refus
 */
export function raisonDeRefusDeReclassement(refus) {
  const lignes = refus.map((r) => {
    const ou = r.sha ? `${r.sha.slice(0, 9)} ` : ''
    if ('illisible' in r) return `${ou}injugeable : ${r.illisible}`
    return `${ou}${r.ecarts.map(ceQueDitLeModule).join(', ')}`
  })
  const geste = refus.some((r) => r.sha)
    ? '`git rebase -i` pour porter au message du commit fautif'
    : 'porter au message'
  return (
    `⛔ RECLASSEMENT CSS : ${lignes.join(' || ')}. Un module FRANCHIT la frontière quand il devient ` +
    `exempté au commit sans l'être au parent — revendiqué au manifeste (${CHEMIN_MANIFESTE}) par une ` +
    `primitive réutilisée, second importeur gagné, ou ajouté à \`FEUILLES_PARTAGEES\` (${CHEMIN_COUCHES}) — ` +
    `et ses sites quittent le stock (xxi) sans guérir. Geste : ${geste} ` +
    `\`RECLASSEMENT: <module> +N — <motif>\` (motif d’au moins ${MOTIF_MIN} caractères, portant son ` +
    '`#<ticket>`), UNE ligne par module franchi, N = ses sites sortis ; aucune ligne pour un module qui ' +
    'n’a pas franchi.'
  )
}
