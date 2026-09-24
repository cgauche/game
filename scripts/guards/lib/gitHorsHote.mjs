// GIT HORS DE L'HÔTE — la garde de l'invariant d'en-tête de `gitPorte.mjs` : « l'hôte UNIQUE de la
// forme d'union et des commandes git que les portes […] exécutent » (#1806).
//
// LE PÉRIMÈTRE est un fait du dépôt, pas une liste, et il a deux faces :
//   · les sources SUIVIES sous les trois dossiers d'où une porte s'exécute — `scripts/hooks` (hooks
//     Claude Code, `.claude/settings.json`), `scripts/git-hooks` (hooks git, `core.hooksPath`) et
//     `scripts/guards` (leur bibliothèque) : une porte qui n'importe pas l'hôte y est prise ;
//   · toute source suivie qui IMPORTE l'hôte : elle compose ses lectures, elle lit donc git par lui
//     seul (`scripts/ops/faits-de-palier.mjs`, faits de palier ; `scripts/ops/publier.mjs`).
// Hors instruments Vitest (`estFichierVitest` : une suite FORGE des dépôts, un banc n'est pas une porte)
// et hors l'hôte lui-même. Un module neuf y entre en naissant, ou en important l'hôte.
//
// TROIS FORMES, chacune un site :
//   · `lanceur`  — un appel dont le premier argument est l'exécutable `git` (`execFileSync('git', …)`,
//     `run('git', …)`), ou un `exec`/`execSync` dont la ligne de commande commence par `git ` : git
//     lancé sans l'hôte ;
//   · `decoupe`  — un `split` sur NUL : la découpe d'une sortie `-z` hors de l'hôte ;
//   · `forme`    — une option qui produit des CHEMINS (`--name-only`, `--name-status`, `--numstat`,
//     `ls-files`, `ls-tree`, `-z`) écrite hors de l'appel d'un lecteur de l'hôte (`LECTEURS`).
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { cheminsDe, fichiersDuGrep, lecteurGit } from './gitPorte.mjs'
import { estFichierVitest } from './fichierVitest.mjs'

/** L'arbre lu par défaut : celui où VIT ce module. */
export const RACINE = fileURLToPath(new URL('../../..', import.meta.url))

/** Les dossiers d'où une porte s'exécute. */
export const DOSSIERS_DES_PORTES = Object.freeze(['scripts/guards', 'scripts/hooks', 'scripts/git-hooks'])

/** L'hôte : le seul module qui lance git et découpe ses sorties. */
export const HOTE = 'scripts/guards/lib/gitPorte.mjs'

/** Les lecteurs de l'hôte qu'une forme de chemins doit traverser. */
export const LECTEURS = Object.freeze(['cheminsDe', 'numstatDe', 'nameStatusDe', 'etatsDe', 'eolsDe', 'journalDe'])

const MODULE = /\.(?:mjs|cjs|mts|cts|ts|js)$/
const LANCEUR = /[\w$]\s*\(\s*(['"`])git\1|\bexec(?:Sync)?\(\s*(['"`])git\s/g
const DECOUPE = /split\(\s*(['"`])(?:\\0|\\x00|\\u0000)\1\s*\)/g
const FORME = /(['"`])(--name-only|--name-status|--numstat|ls-files|ls-tree|-z)\1/g

/** Un import statique de l'hôte (`-E` de `git grep`). */
export const IMPORT_DE_L_HOTE = "from[[:space:]]+['\"][^'\"]*gitPorte\\.mjs['\"]"

/** Les sources du périmètre, chemins POSIX relatifs, triés. */
export function sourcesDesPortes(racine = RACINE) {
  const git = lecteurGit(racine)
  const sources = [...cheminsDe(git, ['ls-files', '--', ...DOSSIERS_DES_PORTES]), ...fichiersDuGrep(git, [], IMPORT_DE_L_HOTE, [])]
  return [...new Set(sources)].filter((f) => MODULE.test(f) && !estFichierVitest(f) && f !== HOTE).sort()
}

/** Le nom de l'appel dont `index` est un argument : l'identifiant devant la première `(` ouverte à
 *  sa gauche, `null` hors de tout appel. */
function appelEnglobant(texte, index) {
  let profondeur = 0
  for (let i = index - 1; i >= 0; i -= 1) {
    const c = texte[i]
    if (c === ')' || c === ']' || c === '}') profondeur += 1
    else if (c === '(' || c === '[' || c === '{') {
      if (profondeur > 0) profondeur -= 1
      else if (c === '(') return /([\w$]+)\s*$/.exec(texte.slice(Math.max(0, i - 80), i))?.[1] ?? null
    }
  }
  return null
}

/** Le texte sans ses commentaires, longueurs conservées (les index restent ceux de la source). */
const sansCommentaires = (texte) =>
  texte.replace(/\/\*[\s\S]*?\*\/|(^|[^:\\])\/\/[^\n]*/g, (m) => m.replace(/[^\n]/g, ' '))

/**
 * Les sites d'une source où git se lit hors de l'hôte. PURE.
 * @param {string} chemin @param {string} texte
 * @returns {{ chemin: string, ligne: number, forme: 'lanceur'|'decoupe'|'forme', extrait: string }[]}
 */
export function sitesHorsHote(chemin, texte) {
  const code = sansCommentaires(texte)
  const ligneDe = (i) => code.slice(0, i).split('\n').length
  const lignes = texte.split('\n')
  const sites = []
  const noter = (forme, i) => sites.push({ chemin, ligne: ligneDe(i), forme, extrait: lignes[ligneDe(i) - 1].trim().slice(0, 120) })
  for (const m of code.matchAll(LANCEUR)) noter('lanceur', m.index)
  for (const m of code.matchAll(DECOUPE)) noter('decoupe', m.index)
  for (const m of code.matchAll(FORME)) if (!LECTEURS.includes(appelEnglobant(code, m.index))) noter('forme', m.index)
  return sites.sort((a, b) => a.ligne - b.ligne)
}

/** Les sites du périmètre, lus sur le disque de `racine` (ou par `lire`). */
export function sitesDuDepot(racine = RACINE, { lister = sourcesDesPortes, lire = (rel) => readFileSync(join(racine, rel), 'utf8') } = {}) {
  return lister(racine).flatMap((rel) => sitesHorsHote(rel, lire(rel) ?? ''))
}
