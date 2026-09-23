// LECTURE des images CSS (#1806 L1) : le lieu UNIQUE où un arbre — ref git, index, arbre de travail —
// devient l'image `{ fichiers, manifeste, partagees, reutilises }` que mesure `cssCouches.mjs`, et le
// CÔTÉ `{ manifeste, partagees, reutilises, lire }` qu'en lit la garde `RECLASSEMENT:`. Les imports
// qui fixent `reutilises` se résolvent par `directImportsOf` (`importGraph.mjs`) contre les fichiers de
// l'arbre lu, sur les seules lignes que `git grep` (`grepDe`, `gitPorte.mjs`) trouve citant le nom d'un
// `fichier` du manifeste. Appelants : `cssCouchesAudit.ts` (disque), `ventilationDeGit` (le
// régénérateur), le garde de solde au commit, la porte de plage au push.
import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { aliasDuDepot, directImportsOf } from './importGraph.mjs'
import { INDEX, TRAVAIL, grepDe, lireGit, listerImage, sortieOuNull } from './gitPorte.mjs'
import { entreesEcrites } from './stock.mjs'
import {
  CHEMIN_COUCHES, CHEMIN_MANIFESTE, RACINE_DES_MODULES, feuillesPartageesDe, fichiersReutilises,
  manifesteDe, modulesDePrimitive, ventiler,
} from './cssCouches.mjs'

/** Racine où cherchent les importeurs. */
export const RACINE_DES_SOURCES = 'src'

/** Ce qui échappe à une ERE. */
const echapper = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/**
 * Le NOM par lequel un spécificateur relatif atteint `chemin` : son nom sans extension, celui de son
 * dossier pour un `index.*` (l'ordre de repli de `resolveImport`, `importGraph.mjs`).
 * @param {string} chemin @returns {string}
 */
export function nomDImport(chemin) {
  const segments = chemin.split('/')
  const base = segments.at(-1).replace(/\.[^.]+$/, '')
  return base === 'index' ? segments.at(-2) ?? base : base
}

/**
 * Les NOMS d'import des `fichier`s du manifeste (`nomDImport`).
 * @param {readonly { fichier?: string }[]} manifeste @returns {Set<string>}
 */
export function nomsDImport(manifeste) {
  return new Set(manifeste.flatMap(({ fichier }) => (typeof fichier === 'string' ? [nomDImport(fichier)] : [])))
}

/**
 * Le motif `-E` (`git grep` comme `RegExp`) des lignes qui IMPORTENT un `fichier` du manifeste, aux
 * seules formes que lit `IMPORT_RE` (`importGraph.mjs`) — `from '…'`, `import('…')`, `import '…'` —,
 * sur un spécificateur que `resolveImport` résout : relatif (`./`, `../`) ou sous un alias du dépôt
 * (`aliasDuDepot`), finissant par un nom du manifeste (`nomsDImport`), `/index` écrit ou non ; ou fait
 * de points seuls (`'.'`, `'..'`), dont le `index.*` ne se lit pas dans le spécificateur. Une ligne
 * faite du SEUL spécificateur (`SPECIFICATEUR_SEUL`) est candidate aussi : c'est la seconde ligne d'un
 * import écrit sur plusieurs, que `coteCss` relit alors en entier. `null` = rien à chercher.
 * @param {readonly { fichier?: string }[]} manifeste @returns {string | null}
 */
export function motifDImport(manifeste) {
  const noms = nomsDImport(manifeste)
  if (!noms.size) return null
  const racines = ['\\.\\.?/', ...aliasDuDepot().map(({ prefixe }) => echapper(prefixe))].join('|')
  const nomme = `(${racines})([^'"]*/)?(${[...noms].map(echapper).join('|')})(/index)?(\\.[cm]?[jt]sx?)?`
  const specificateur = `['"](${nomme}|\\.\\.?(/\\.\\.)*/?)['"]`
  return `(from|import)[ \t]*\\(?[ \t]*${specificateur}|^[ \t]*${specificateur}[ \t]*[,;)]*[ \t]*$`
}

/** Une ligne candidate qui commence par un guillemet : le SEUL spécificateur d'un import écrit sur
 *  plusieurs lignes (`motifDImport`). */
export const SPECIFICATEUR_SEUL = /^[ \t]*['"]/

/**
 * Le CÔTÉ d'un arbre : manifeste, `FEUILLES_PARTAGEES`, `fichier`s RÉUTILISÉS et lecteur de texte.
 * Un fichier candidat se résout sur ses lignes candidates, ou sur son contenu ENTIER dès qu'une d'elles
 * est un spécificateur seul (`SPECIFICATEUR_SEUL`) : `IMPORT_RE` lit alors l'import sur ses lignes.
 * Les imports se résolvent contre les SEULS fichiers de cet arbre (`lister`) : le disque n'est pas
 * l'arbre jugé (#1806).
 * @param {{ lire: (rel: string) => string | null, grep: (motif: string) => Map<string, string>,
 *   lister: (dossier: string) => readonly string[] }} source
 * @param {{ racine?: string }} [options] le dépôt où les imports se résolvent
 * @throws {Error} manifeste ou `cssCouches.mjs` illisible.
 */
export function coteCss(source, { racine = '.' } = {}) {
  const manifeste = manifesteDe(source.lire(CHEMIN_MANIFESTE))
  const partagees = feuillesPartageesDe(source.lire(CHEMIN_COUCHES))
  const motif = motifDImport(manifeste)
  const racineAbs = resolve(racine).split('\\').join('/')
  const arbre = motif ? new Set(source.lister(RACINE_DES_SOURCES).map((rel) => `${racineAbs}/${rel}`)) : new Set()
  const existe = (abs) => arbre.has(abs)
  const imports = motif
    ? [...source.grep(motif)].map(([rel, lignes]) => {
      const surPlusieursLignes = lignes.split('\n').some((l) => SPECIFICATEUR_SEUL.test(l))
      const contenu = surPlusieursLignes ? source.lire(rel) ?? lignes : lignes
      return [rel, directImportsOf(rel, contenu, { racine, existe })]
    })
    : []
  return { manifeste, partagees, reutilises: fichiersReutilises(manifeste, imports), lire: source.lire }
}

/**
 * L'IMAGE mesurable d'un arbre : son côté, et ses feuilles MESURÉES — `src/ui/styles/` ∪ les modules
 * déclarés par le manifeste (champ `css`), où qu'ils vivent (#1806 A3).
 * @param {Parameters<typeof coteCss>[0]} source
 * @param {{ racine?: string }} [options]
 */
export function imageCss(source, options) {
  const { manifeste, partagees, reutilises } = coteCss(source, options)
  const rels = new Set(source.lister(RACINE_DES_MODULES).filter((f) => f.endsWith('.css')))
  for (const c of modulesDePrimitive(manifeste)) rels.add(c)
  const fichiers = [...rels]
    .map((rel) => ({ rel, text: source.lire(rel) }))
    .filter((f) => f.text !== null)
  return { fichiers, manifeste, partagees, reutilises }
}

/** Le lecteur git par défaut dans `cwd` : une indisponibilité LÈVE en nommant ce qu'elle lisait. */
const lecteurGit = (cwd, quoi) => (args) => {
  const vu = lireGit(args, { cwd })
  if (!vu.disponible) throw new Error(`git indisponible pour lire ${quoi} : ${vu.raison}`)
  return sortieOuNull(vu)
}

/**
 * Une source lue par git dans `cwd` : `arbre` = une ref, `INDEX` ou `TRAVAIL`. `git` (args → sortie,
 * `null` = objet absent) est le lecteur de l'appelant ; par défaut `lireGit`, dont une indisponibilité
 * LÈVE en se nommant : une image vide jugerait sur rien.
 * @param {{ cwd?: string, arbre: string, git?: (args: string[]) => string | null }} p
 */
export function sourceGit({ cwd = process.cwd(), arbre, git }) {
  const lire = git ?? lecteurGit(cwd, arbre)
  const portee = arbre === INDEX ? ['--cached'] : arbre === TRAVAIL ? ['--untracked'] : [arbre]
  return {
    existe: () => arbre === INDEX || arbre === TRAVAIL || lire(['rev-parse', '--verify', '--quiet', `${arbre}^{commit}`]) !== null,
    lister: (dossier) => listerImage(lire, arbre, dossier),
    lire: arbre === TRAVAIL
      ? (rel) => lireDuTravail(cwd, rel)
      : (rel) => lire(['show', `${arbre === INDEX ? '' : arbre}:${rel}`]),
    grep: (motif) => grepDe(lire, portee, motif, [RACINE_DES_SOURCES]),
  }
}

/** Le texte d'un fichier de l'arbre de travail, `null` s'il n'existe pas. */
function lireDuTravail(cwd, rel) {
  try {
    return readFileSync(join(cwd, rel), 'utf8')
  } catch {
    return null
  }
}

/**
 * La carte des RENOMMAGES (chemin avant ↦ chemin après) que git détecte (`-M`, statut R) dans `args` — les
 * bornes d'un `git diff` (`['HEAD']`, `['--cached']`, `['<a>', '<b>']`).
 * @param {(args: string[]) => string | null} git @param {string[]} bornes
 * @returns {Map<string, string>}
 */
export function renommagesDe(git, bornes) {
  const carte = new Map()
  for (const l of (git(['diff', '-M', '--diff-filter=R', '--name-status', ...bornes]) ?? '').split('\n')) {
    const m = /^R\d*\t(.+)\t(.+)$/.exec(l)
    if (m) carte.set(m[1], m[2])
  }
  return carte
}

/** Le stock CSS nominatif, et ses deux collections que la ventilation lit. */
export const CHEMIN_STOCK_CSS = 'scripts/guards/lib/cssCouchesStock.mjs'
const COLLECTIONS = { identite: 'CSS_IDENTITE_ECRAN_RATCHET', espacement: 'CSS_ESPACEMENT_RATCHET' }

/**
 * La VENTILATION de `base` à `tete` (une ref, ou `TRAVAIL`) telle que git les porte — le seul chemin
 * de `--ventiler` et de l'admission du régénérateur : images lues par `imageCss`, renommages `-M` de
 * l'intervalle, et Sb = le stock ÉCRIT à `base` (`CHEMIN_STOCK_CSS`) quand il existe. Une ref absente
 * de l'histoire LÈVE en se nommant : un clone superficiel ne ventile rien.
 * @param {{ cwd?: string, base: string, tete?: string, git?: (args: string[]) => string | null }} p
 */
export function ventilationDeGit({ cwd = process.cwd(), base, tete = TRAVAIL, git }) {
  const lire = git ?? lecteurGit(cwd, `${base}..${tete}`)
  const source = (arbre) => {
    const s = sourceGit({ cwd, arbre, git: lire })
    if (!s.existe()) throw new Error(`ref ${arbre} absente de l'histoire de ${cwd} (clone superficiel ? il faut \`fetch-depth: 0\`)`)
    return s
  }
  const avant = source(base)
  const texte = avant.lire(CHEMIN_STOCK_CSS)
  const lus = texte === null ? null : Object.fromEntries(
    Object.entries(COLLECTIONS).map(([volet, nom]) => [volet, entreesEcrites(texte, nom)]),
  )
  const ecarts = lus ? Object.values(lus).flatMap((l) => l.ecarts) : []
  if (ecarts.length) throw new Error(`${CHEMIN_STOCK_CSS} illisible à ${base} : ${ecarts.join(' ; ')}`)
  const stockAvant = lus ? { identite: lus.identite.entrees, espacement: lus.espacement.entrees } : undefined
  const v = ventiler(imageCss(avant, { racine: cwd }), imageCss(source(tete), { racine: cwd }), {
    renommages: renommagesDe(lire, tete === TRAVAIL ? [base] : [base, tete]),
    stockAvant,
  })
  return { ...v, stockAvant: stockAvant ?? { identite: [], espacement: [] } }
}
