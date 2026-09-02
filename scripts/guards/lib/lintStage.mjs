// LINT DES FICHIERS STAGÉS — la porte que la CI joue déjà (`npm run lint`) ramenée AU COMMIT, sur le
// seul diff. Sur la fenêtre mesurée (30 commits), les deux rouges CI venaient de là : le hook ne
// jouait aucun lint (revue de palier 2026-09-02).
//
// Trois règles de câblage, chacune mesurée :
//   · l'outil vient de CET arbre (`scripts/lancer-local.mjs`) — un worktree sans `eslint` doit REFUSER,
//     pas emprunter celui de l'arbre principal ;
//   · `--no-warn-ignored` : `eslint.config.js` ignore `src/data/**` et `*.config.*`, et un fichier
//     ignoré CITÉ explicitement rend un avertissement — avec `--max-warnings 0` il ferait échouer le
//     commit sans qu'aucune règle ne soit violée (7 commits sur 30 concernés) ;
//   · seuls les chemins EXISTANTS partent : un chemin supprimé cité rend exit 2 après ~15 s.
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { execFileSync } from 'node:child_process'

/** Extensions que `eslint.config.js` sait juger. */
const EXTS_LINT = ['.ts', '.tsx', '.mjs', '.mts']

/**
 * Chemins à passer à eslint : ceux du lot qui portent une extension jugée ET qui existent sur le
 * disque de `racine`. REND des chemins POSIX relatifs, dans l'ordre du lot.
 * @param {string[]} chemins @param {string} racine @returns {string[]}
 */
export function fichiersALinter(chemins, racine) {
  return chemins
    .map((f) => String(f).replace(/\\/g, '/'))
    .filter((rel) => EXTS_LINT.some((e) => rel.endsWith(e)))
    .filter((rel) => existsSync(join(racine, rel)))
}

/** Défaut NOMMÉ quand le rapport n'est pas exploitable : un lint qu'on ne sait pas lire REFUSE le
 *  commit, il ne le laisse jamais passer. @param {string} cause */
const defautOutillage = (cause) => ({ site: '(lint)', gravite: 'erreur', regle: '(outillage)', message: cause })

/**
 * Défauts d'un rapport eslint `--format json` : un par message, `fichier:ligne:colonne` relatif à
 * `racine`. Les fichiers sans message n'en produisent aucun.
 * FAIL-CLOSED : une sortie NON VIDE que `JSON.parse` refuse rend un défaut d'outillage, jamais `[]`
 * — un `[]` y ferait passer un lint ROUGE (avertissement node, message de lanceur collé au JSON).
 * @param {string} sortieJson @param {string} racine
 * @returns {{ site: string, gravite: string, regle: string, message: string }[]}
 */
export function defautsDeRapport(sortieJson, racine) {
  if (!String(sortieJson).trim()) return []
  /** @type {{ filePath: string, messages: { line: number, column: number, severity: number, ruleId: string|null, message: string }[] }[]} */
  let rapport
  try {
    rapport = JSON.parse(sortieJson)
  } catch (e) {
    return [defautOutillage("rapport illisible : " + String(e.message).split('\n')[0] + " — sortie : " + String(sortieJson).trim().slice(0, 200))]
  }
  if (!Array.isArray(rapport)) return [defautOutillage("rapport illisible : le JSON rendu n'est pas la liste de fichiers d'eslint")]
  const racinePosix = String(racine).replace(/\\/g, '/').replace(/\/$/, '') + '/'
  const defauts = []
  for (const fichier of rapport) {
    const abs = String(fichier.filePath).replace(/\\/g, '/')
    const rel = abs.startsWith(racinePosix) ? abs.slice(racinePosix.length) : abs
    for (const m of fichier.messages ?? []) {
      defauts.push({
        site: `${rel}:${m.line ?? 0}:${m.column ?? 0}`,
        gravite: m.severity === 2 ? 'erreur' : 'avertissement',
        regle: m.ruleId ?? '(parse)',
        message: m.message,
      })
    }
  }
  return defauts
}

/**
 * Joue eslint sur `fichiers` depuis `racine`. REND `{ defauts, brut }` — `brut` est la sortie telle
 * quelle (diagnostic quand le rapport n'est pas du JSON : outil absent, config cassée).
 * @param {string} racine @param {string[]} fichiers
 * @returns {{ defauts: ReturnType<typeof defautsDeRapport>, brut: string }}
 */
export function lancerLint(racine, fichiers) {
  if (!fichiers.length) return { defauts: [], brut: '' }
  const args = [
    join(racine, 'scripts', 'lancer-local.mjs'), 'eslint', '--',
    'eslint', '--max-warnings', '0', '--no-warn-ignored', '--format', 'json',
    ...fichiers,
  ]
  // Le rapport JSON vit sur STDOUT et lui seul : stderr porte les avertissements du moteur node et
  // les messages du lanceur local, qui ne sont pas du JSON. Les concaténer casserait le parse.
  let stdout
  let stderr = ''
  let echec = false
  try {
    stdout = execFileSync(process.execPath, args, { cwd: racine, encoding: 'utf8' })
  } catch (e) {
    echec = true
    stdout = String(e.stdout ?? '')
    stderr = String(e.stderr ?? '')
  }
  const defauts = defautsDeRapport(stdout, racine)
  // eslint a rendu un code non nul SANS rapport exploitable (outil absent, config cassée, chemin
  // refusé) : le refus est NOMMÉ. Sans cette branche, l'échec passerait pour un arbre propre.
  if (echec && !defauts.length) {
    defauts.push(defautOutillage("eslint a échoué sans rapport : " + ((stderr || stdout).trim().split('\n')[0] || '(aucune sortie)')))
  }
  return { defauts, brut: stdout + stderr }
}
