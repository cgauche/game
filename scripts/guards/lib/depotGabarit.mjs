// Fixture de dépôt git jetable, source UNIQUE du geste : un GABARIT est construit une fois par
// contenu (init + config + fichiers + commit = cinq processus git), puis chaque test en prend une
// INSTANCE par copie de fichiers. Le `.git` d'un `git init` est un dossier autonome : sa copie est
// un dépôt complet et indépendant, que l'appelant peut committer, salir et jeter.
//
// Mesure du 2026-09-07 (#1709, machine peu chargée) : 226 ms la fabrication, 26 ms la copie,
// 34 ms un `git init` nu.
// Aucun état de départ n'est simulé : c'est le même arbre, aux mêmes octets, sous le même sha.

import { execFileSync } from 'node:child_process'
import { cpSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'

/** @typedef {{ fichiers?: Record<string, string>, branche?: string, origin?: string | null, message?: string, refs?: Record<string, string>, commit?: boolean }} ParamsDepot */
/** @typedef {{ racine: string, sha: string | null }} Depot */

/** @type {Map<string, Depot>} */
const GABARITS = new Map()

const jeterLesGabarits = () => {
  for (const { racine } of GABARITS.values()) rmSync(racine, { recursive: true, force: true })
}

process.on('exit', jeterLesGabarits)
// Un `node --test` interrompu (Ctrl-C, `taskkill`, timeout de CI) ne passe PAS par `exit` : sans ces
// deux relais, chaque gabarit construit resterait sous `os.tmpdir()`. Ils rendent la main au code de
// sortie conventionnel du signal (128 + n), et `process.exit` rejoue `exit`, donc le nettoyage.
process.once('SIGINT', () => { jeterLesGabarits(); process.exit(130) })
process.once('SIGTERM', () => { jeterLesGabarits(); process.exit(143) })

const git = (cwd) => (args) => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim()

/** Clé de contenu : deux appels aux mêmes paramètres décrivent le même arbre, donc le même gabarit. */
function cle({ fichiers, branche, origin, message, refs, commit }) {
  const trie = (o) => Object.keys(o).sort().map((k) => [k, o[k]])
  return JSON.stringify([trie(fichiers), branche, origin, message, trie(refs), commit])
}

function ecrire(racine, rel, texte) {
  mkdirSync(join(racine, dirname(rel)), { recursive: true })
  writeFileSync(join(racine, rel), texte, 'utf8')
}

/**
 * Gabarit partagé pour un contenu donné : construit au premier appel, rendu tel quel ensuite.
 * L'identité de l'auteur, `commit.gpgsign` à faux et un `core.hooksPath` RELATIF pointant hors de
 * tout hook (résolu dans le dépôt jugé, jamais dans le gabarit) rendent la fixture indépendante de
 * la machine hôte. Une construction qui échoue ne laisse aucun dossier derrière elle.
 * @param {ParamsDepot} params `fichiers` = `{ 'chemin/relatif': 'contenu' }` ; `refs` = `{ 'refs/…': 'HEAD' }` ;
 *   `commit: false` = un dépôt initialisé dont les fichiers restent HORS index et sans HEAD (`sha` = `null`).
 * @returns {Depot} racine du gabarit (à NE PAS muter — prendre une `instanceDeDepot`) et sha de son commit.
 */
export function gabaritDeDepot({ fichiers = {}, branche = 'main', origin = null, message = 'fondation', refs = {}, commit = true } = {}) {
  if (!commit && Object.keys(refs).length > 0) {
    throw new Error(`gabaritDeDepot : une ref se pose sur un commit — \`refs\` (${Object.keys(refs).join(', ')}) exige \`commit: true\``)
  }
  const k = cle({ fichiers, branche, origin, message, refs, commit })
  const memo = GABARITS.get(k)
  if (memo) return memo

  const racine = mkdtempSync(join(tmpdir(), 'gabarit-'))
  let sha = null
  try {
    const g = git(racine)
    g(['init', '-q', '-b', branche])
    g(['config', 'user.email', 'mesure@example.invalid'])
    g(['config', 'user.name', 'mesure'])
    g(['config', 'commit.gpgsign', 'false'])
    // RELATIF : git résout `core.hooksPath` contre le dépôt qui l'exécute, donc dans l'INSTANCE.
    // Un chemin absolu y ferait pointer chaque instance vers le gabarit — effacé à la sortie.
    g(['config', 'core.hooksPath', 'hooks-absents'])
    for (const [rel, texte] of Object.entries(fichiers)) ecrire(racine, rel, texte)
    if (commit) {
      g(['add', '-A'])
      g(['commit', '-q', '--allow-empty', '-m', message])
      sha = g(['rev-parse', 'HEAD'])
    }
    if (origin) g(['remote', 'add', 'origin', origin])
    for (const [nom, cible] of Object.entries(refs)) g(['update-ref', nom, g(['rev-parse', cible])])
  } catch (e) {
    rmSync(racine, { recursive: true, force: true })
    throw e
  }

  const depot = { racine, sha }
  GABARITS.set(k, depot)
  return depot
}

/**
 * Instance indépendante du gabarit de ce contenu : un dépôt complet, à l'appelant de le jeter
 * (`rmSync(racine, { recursive: true, force: true })` en `finally`).
 * @param {ParamsDepot} params mêmes paramètres que {@link gabaritDeDepot}.
 * @returns {Depot} racine de l'instance et sha de son commit de fondation.
 */
export function instanceDeDepot(params = {}) {
  const gabarit = gabaritDeDepot(params)
  const racine = mkdtempSync(join(tmpdir(), 'depot-'))
  cpSync(gabarit.racine, racine, { recursive: true })
  return { racine, sha: gabarit.sha }
}
