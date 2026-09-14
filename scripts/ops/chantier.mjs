// OUVERTURE D'UN CHANTIER — le geste que chaque session recodait au scratchpad : poser un worktree
// lié `.wt-<nom>` sur une branche `chantier/<nom>` issue d'`origin/main`, puis l'équiper.
//
// Pourquoi un outil du dépôt et pas trois lignes de shell : les trois façons de se tromper sont
// TOUJOURS les mêmes, et aucune ne se voit tout de suite — poser le worktree DEPUIS un worktree (il
// devient imbriqué, `scripts/guards/lib/arbreImbrique.mjs` refuse alors le commit qui le stage),
// partir de `HEAD` au lieu d'`origin/main` (le chantier naît en retard), et réutiliser un nom déjà
// pris (la branche existe : `git worktree add -b` rend un message que personne ne relit).
// Chaque refus est donc NOMMÉ ici, une fois, et le cas « cible déjà là » se distingue du cas
// « branche déjà là » : ce ne sont pas les mêmes gestes de sortie.
//
// Rien n'est jamais détruit : ni `--force`, ni suppression. Un `npm ci` rouge LAISSE le worktree et
// le dit — c'est un équipement qui manque, pas un chantier à défaire.
//
// Usage : `npm run ops:chantier -- <nom> [--sans-ci]`, `nom` = numéro de ticket + slug optionnel.
import { spawnSync } from 'node:child_process'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { fetchOrigin, lireGit, natureDuChemin, sortieOuNull } from '../guards/lib/gitPorte.mjs'
import { estArbrePrincipal, portDev, urlDev } from '../port-dev.mjs'

/** Racine de l'arbre qui porte CE script. */
export const RACINE = fileURLToPath(new URL('../..', import.meta.url))

/** Forme d'un nom de chantier : un numéro de ticket, puis un slug optionnel en minuscules. */
export const FORME_NOM = /^\d+(-[a-z0-9]+(-[a-z0-9]+)*)?$/

/** Ce que le refus de forme AFFICHE : la règle, pas le regex. */
export const FORME_DITE = '<numéro de ticket>[-slug-en-minuscules] (ex. « 1736 », « 1732-1734-outillage »)'

/** `true` si `nom` a la forme attendue. PURE. */
export const nomValide = (nom) => typeof nom === 'string' && FORME_NOM.test(nom)

/**
 * Arguments de la ligne de commande. PURE.
 * @param {string[]} argv arguments APRÈS `node script.mjs`
 * @returns {{nom: string, sansCi: boolean}|null} `null` si aucun nom n'est donné.
 */
export function argumentsDe(argv) {
  const args = [...(argv ?? [])]
  const sansCi = args.includes('--sans-ci')
  const nom = args.filter((a) => !a.startsWith('--'))[0]
  return nom === undefined ? null : { nom, sansCi }
}

/**
 * La raison de ne PAS créer ce chantier, ou `null`. Les deux collisions se disent DISTINCTEMENT :
 * un worktree déjà posé se rejoint, une branche déjà là se reprend ou se renomme. PURE.
 * @param {{cibleExiste: boolean, brancheExiste: boolean, nom: string, cible: string}} etat
 * @returns {string|null}
 */
export function refusDeCreation({ cibleExiste, brancheExiste, nom, cible }) {
  const branche = brancheDe(nom)
  if (cibleExiste && brancheExiste) {
    return `chantier « ${nom} » déjà ouvert : le worktree ${cible} ET la branche ${branche} existent — ` +
      'travaille dedans, ou choisis un autre nom.'
  }
  if (cibleExiste) {
    return `le chemin ${cible} existe déjà (worktree posé, ou dossier resté là) — ` +
      'travaille dedans, ou retire-le à la main avant de recommencer.'
  }
  if (brancheExiste) {
    return `la branche ${branche} existe déjà — reprends-la (\`git worktree add ${cible} ${branche}\`), ` +
      'ou choisis un autre nom.'
  }
  return null
}

/**
 * ÉQUIPEMENT d'un chantier neuf, dans l'ordre : la racine, PUIS le sous-projet `server/`. Le relay
 * Cloudflare a ses PROPRES dépendances (`server/package.json`), et la gate `server:typecheck` les
 * déclare en prérequis (`scripts/gates/toutes.mjs:373` : `{ chemin: 'server/node_modules',
 * pose: 'npm --prefix server ci' }`). Un worktree équipé de la seule racine rend donc cette gate
 * ROUGE — mesuré le 2026-09-14 (3ᵉ train réel, après 881 s de gates en série).
 * `ou` et `relance` sont ce que le refus DIT : où c'est rouge, et la commande qui le rejoue.
 */
export const EQUIPEMENTS = [
  { args: ['ci', '--no-audit', '--no-fund'], ou: '', relance: 'npm ci' },
  { args: ['--prefix', 'server', 'ci', '--no-audit', '--no-fund'], ou: ' dans server/', relance: 'npm --prefix server ci' },
]

/** Nom de branche d'un chantier. PURE. */
export const brancheDe = (nom) => `chantier/${nom}`

/** Chemin du worktree d'un chantier dans `racine`. PURE (hors `join`). */
export const cibleDe = (racine, nom) => join(racine, `.wt-${nom}`)

/**
 * Ce que l'ouverture IMPRIME en fin : les quatre faits dont la session a besoin tout de suite. PURE.
 * @param {{cible: string, branche: string, base: string, port: number, url?: string}} chantier
 */
export function resumeDeChantier({ cible, branche, base, port, url }) {
  return [
    `worktree=${cible}`,
    `branche=${branche}`,
    `base=${base}`,
    `port=${port} (${url ?? `http://localhost:${port}/`})`,
  ].join('\n')
}

/**
 * Ouvre le chantier `nom` depuis `racine`. `git`, `fetch` et `npm` sont injectables (mesure).
 * @param {{racine?: string, nom: string, sansCi?: boolean, git?: Function, fetch?: Function,
 *   npm?: Function}} params
 * @returns {{ok: true, cible: string, branche: string, base: string, resume: string, npmJoue: boolean}
 *   | {ok: false, refus: string, cible?: string, branche?: string}}
 */
export function creerChantier({ racine = RACINE, nom, sansCi = false, git = lireGit, fetch = fetchOrigin, npm = spawnSync }) {
  if (!nomValide(nom)) {
    return { ok: false, refus: `nom de chantier invalide : « ${nom} » — forme attendue : ${FORME_DITE}` }
  }
  if (!estArbrePrincipal(racine)) {
    return {
      ok: false,
      refus: `lance depuis l'arbre principal, pas depuis un worktree (${racine}) — ` +
        'un worktree posé sous un worktree est imbriqué, et le hook de commit le refuse.',
    }
  }

  const cible = cibleDe(racine, nom)
  const branche = brancheDe(nom)

  const vuBranche = git(['rev-parse', '--verify', '--quiet', `refs/heads/${branche}`], { cwd: racine, site: 'git rev-parse' })
  if (!vuBranche.disponible) return { ok: false, refus: `branche illisible : ${vuBranche.raison}` }
  const brancheExiste = !vuBranche.absent && vuBranche.valeur.status === 0
  const cibleExiste = natureDuChemin(cible) !== 'absent'

  const refus = refusDeCreation({ cibleExiste, brancheExiste, nom, cible })
  if (refus) return { ok: false, refus, cible, branche }

  const vuFetch = fetch({ cwd: racine })
  if (!vuFetch.disponible) {
    return { ok: false, refus: `origin non consultable, le chantier ne peut pas partir d'origin/main : ${vuFetch.raison}` }
  }

  const vuAdd = git(['worktree', 'add', '-b', branche, cible, 'origin/main'], { cwd: racine, site: 'git worktree add' })
  if (!vuAdd.disponible) return { ok: false, refus: `git worktree add a échoué : ${vuAdd.raison}`, cible, branche }
  if (vuAdd.absent || vuAdd.valeur.status !== 0) {
    return { ok: false, refus: `git worktree add a échoué (code ${vuAdd.absent ? 'objet absent' : vuAdd.valeur.status})`, cible, branche }
  }

  const base = (sortieOuNull(git(['rev-parse', '--short', 'origin/main'], { cwd: racine, site: 'git rev-parse' })) ?? '').trim() || 'inconnue'
  const resume = resumeDeChantier({ cible, branche, base, port: portDev(cible), url: urlDev(cible) })

  if (sansCi) return { ok: true, cible, branche, base, resume, npmJoue: false }

  // `shell: true` MESURÉ nécessaire : `spawnSync('npm.cmd', …, { shell: false })` rend
  // `EINVAL` sous Node v22.20.0 / win32 (mesure du 2026-09-14). Aucun argument ne porte d'espace,
  // et le `cwd` ne passe pas par la ligne de commande — il n'y a donc rien à citer.
  for (const { args, ou, relance } of EQUIPEMENTS) {
    const vuNpm = npm(process.platform === 'win32' ? 'npm.cmd' : 'npm', args, {
      cwd: cible, stdio: 'inherit', shell: true,
    })
    if (vuNpm?.error || vuNpm?.status !== 0) {
      return {
        ok: false,
        cible,
        branche,
        refus: `worktree posé, npm ci rouge${ou} — relancer \`${relance}\` dans ${cible}` +
          (vuNpm?.error ? ` (${vuNpm.error.message})` : ` (code ${vuNpm?.status})`),
      }
    }
  }
  return { ok: true, cible, branche, base, resume, npmJoue: true }
}

function main() {
  const args = argumentsDe(process.argv.slice(2))
  if (!args) {
    process.stderr.write(`[chantier] usage : npm run ops:chantier -- ${FORME_DITE} [--sans-ci]\n`)
    process.exit(1)
  }
  const vu = creerChantier(args)
  if (!vu.ok) {
    process.stderr.write(`[chantier] ${vu.refus}\n`)
    process.exit(1)
  }
  process.stdout.write(`${vu.resume}\n`)
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main()
