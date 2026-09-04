// RULESET `main-evaluate` — la protection serveur de `main`, posée en mode ÉVALUATION.
//
// Décision utilisateur 3 du plan approuvé (AskUserQuestion 2026-09-01, question « protéger main côté
// serveur ? ») : aucune protection serveur à ce stade — d'où `enforcement: "evaluate"` : GitHub mesure
// ce que la règle AURAIT refusé sans jamais refuser. Le passage en `active` est une redécision
// utilisateur, quand la CI tient (déclencheur mesuré proposé : 20 runs verts consécutifs).
// Ce que la règle mesure se lit dans `scripts/ops/rule-suites.mjs`.
//
// Usage : `npm run ops:ruleset -- --dry-run` (imprime le corps, n'écrit rien) ou `npm run ops:ruleset`
// (crée ou met à jour le ruleset — geste de l'orchestrateur, jamais d'un agent).
import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync, rmSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { tmpdir } from 'node:os'

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
export const DEPOT = 'cgauche/game'
export const NOM = 'main-evaluate'

/**
 * Jobs de `ci.yml` qui ne VÉRIFIENT pas le contenu poussé, chacun avec sa raison : ils ne peuvent pas
 * être un check requis. Nominatif — un job neuf devient un check requis tant qu'il n'est pas nommé ici.
 */
export const JOBS_NON_VERIFIANTS = {
  fermetures:
    'joue APRÈS la publication (il ferme les tickets soldés par les commits poussés) — exiger sa ' +
    'réussite avant de laisser entrer le push serait circulaire',
}

/** Noms des jobs de `.github/workflows/ci.yml`, dans l'ordre du fichier — jamais recopiés à la main :
 *  un job renommé change le nom de son check, et la règle doit suivre le fichier. */
export function jobsCi(texte) {
  const lignes = texte.split(/\r?\n/)
  const iJobs = lignes.findIndex((l) => /^jobs:\s*$/.test(l))
  if (iJobs === -1) throw new Error('ci.yml sans bloc `jobs:` — le ruleset ne peut pas nommer ses checks')
  return lignes.slice(iJobs + 1)
    .map((l) => /^ {2}([A-Za-z0-9_-]+):\s*$/.exec(l)?.[1])
    .filter(Boolean)
}

/** Contextes de check requis = les jobs VÉRIFIANTS de `ci.yml`. */
export function contextesRequis(texte) {
  return jobsCi(texte).filter((j) => !(j in JOBS_NON_VERIFIANTS))
}

/** Corps du ruleset. PUR. */
export function corpsDuRuleset(contextes) {
  return {
    name: NOM,
    target: 'branch',
    enforcement: 'evaluate',
    conditions: { ref_name: { include: ['refs/heads/main'], exclude: [] } },
    rules: [{
      type: 'required_status_checks',
      parameters: {
        strict_required_status_checks_policy: false,
        required_status_checks: contextes.map((context) => ({ context })),
      },
    }],
  }
}

/** JAMAIS `shell: true` : `gh` est un exécutable, et les endpoints comme les corps JSON portent des
 *  caractères que `cmd.exe` interpréterait. `stdio[0] = 'ignore'` = le `< /dev/null` d'un workflow. */
const gh = (args) =>
  execFileSync('gh', args, { cwd: RACINE, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] })

/** Id du ruleset `main-evaluate` s'il existe, `null` sinon (l'écriture est donc IDEMPOTENTE). */
export function idExistant(runner = gh) {
  const liste = JSON.parse(runner(['api', `repos/${DEPOT}/rulesets`]))
  return liste.find((r) => r.name === NOM)?.id ?? null
}

/**
 * Le geste, avec son exécutant `gh` INJECTÉ : c'est ainsi que le test vérifie qu'un `--dry-run`
 * n'émet aucun appel, sans réseau ni écriture. `PUT` est la méthode documentée de
 * `PUT /repos/{owner}/{repo}/rulesets/{ruleset_id}` (mise à jour d'un ruleset de dépôt) ; la
 * création passe par `POST /repos/{owner}/{repo}/rulesets`.
 */
export function executer({ argv = [], runner = gh, sortie = (s) => process.stdout.write(s) } = {}) {
  const dryRun = argv.includes('--dry-run')
  const ci = readFileSync(join(RACINE, '.github', 'workflows', 'ci.yml'), 'utf8')
  const corps = corpsDuRuleset(contextesRequis(ci))
  sortie(`${JSON.stringify(corps, null, 2)}\n`)
  if (dryRun) {
    sortie('[ruleset] --dry-run : rien n’a été écrit sur GitHub\n')
    return
  }
  const id = idExistant(runner)
  // `gh api --input` lit un FICHIER : le corps passe par un fichier temporaire hors du dépôt, jamais
  // par stdin (que `stdio[0] = 'ignore'` ferme) ni par une ligne de commande à échapper.
  const fichier = join(tmpdir(), `wfrp-ruleset-${process.pid}.json`)
  writeFileSync(fichier, JSON.stringify(corps))
  try {
    const cible = id === null ? `repos/${DEPOT}/rulesets` : `repos/${DEPOT}/rulesets/${id}`
    runner(['api', '-X', id === null ? 'POST' : 'PUT', cible, '--input', fichier])
    sortie(`[ruleset] ${NOM} ${id === null ? 'créé' : `mis à jour (id ${id})`} en mode evaluate\n`)
  } finally {
    rmSync(fichier, { force: true })
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) executer({ argv: process.argv.slice(2) })
