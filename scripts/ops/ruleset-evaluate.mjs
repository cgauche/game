// RULESET `main-evaluate` — la protection serveur de `main`, décrite en mode ÉVALUATION.
//
// Décision utilisateur 3 du plan approuvé (AskUserQuestion 2026-09-01, question « protéger main côté
// serveur ? »), verbatim : « Aucune protection serveur pour l'instant » [entériné 2026-09-01]. D'où `enforcement: "evaluate"` :
// GitHub mesure ce que la règle AURAIT refusé sans jamais refuser, et le passage en `active` est une
// redécision utilisateur, quand la CI tient.
//
// MESURE du 2026-09-04 : GitHub REFUSE ce mode sur le plan de ce dépôt — l'appel rend HTTP 422
// « Enforcement evaluate option is not supported on this plan. Please upgrade to Enterprise to enable
// it. ». Les seuls modes offerts ici sont `active` (qui BLOQUE) et `disabled` : la voie « mesurer
// d'abord, décider ensuite » n'existe pas sur ce plan, et le choix entre les deux appartient à
// l'utilisateur. Ce refus est NOMMÉ par `refusGh` — il ne remonte jamais en exception brute.
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

/** Refus de GitHub sur `enforcement: evaluate` : le plan du dépôt ne l'offre pas (mesuré 2026-09-04). */
export const REFUS_EVALUATE =
  '[ruleset] GitHub refuse `enforcement: evaluate` sur ce plan (Enterprise seulement) : les seuls modes ' +
  'possibles sont `active` (bloque) et `disabled` — la voie « mesurer par evaluate » de la décision 3 ' +
  'est impossible ici, la re-décision est à l’utilisateur'

/** Ce qu'un échec de `gh` DIT. PUR. Un refus de plan est NOMMÉ ; tout autre échec rend son corps. */
export function refusGh(erreur) {
  const corps = [erreur?.stdout, erreur?.stderr, erreur?.message]
    .filter(Boolean)
    .map((p) => String(p))
    .join('\n')
  if (/not supported on this plan/i.test(corps)) return REFUS_EVALUATE
  return `[ruleset] échec de l’appel gh : ${corps.trim()}`
}

/**
 * Le geste, avec son exécutant `gh` INJECTÉ : c'est ainsi que le test vérifie qu'un `--dry-run`
 * n'émet aucun appel, sans réseau ni écriture. `PUT` est la méthode documentée de
 * `PUT /repos/{owner}/{repo}/rulesets/{ruleset_id}` (mise à jour d'un ruleset de dépôt) ; la
 * création passe par `POST /repos/{owner}/{repo}/rulesets`.
 * REND le code de sortie du processus : 0, ou 1 quand `gh` refuse — le refus part au `journal`.
 */
export function executer({
  argv = [],
  runner = gh,
  sortie = (s) => process.stdout.write(s),
  journal = (s) => process.stderr.write(s),
} = {}) {
  const dryRun = argv.includes('--dry-run')
  const ci = readFileSync(join(RACINE, '.github', 'workflows', 'ci.yml'), 'utf8')
  const corps = corpsDuRuleset(contextesRequis(ci))
  sortie(`${JSON.stringify(corps, null, 2)}\n`)
  if (dryRun) {
    sortie('[ruleset] --dry-run : rien n’a été écrit sur GitHub\n')
    return 0
  }
  // `gh api --input` lit un FICHIER : le corps passe par un fichier temporaire hors du dépôt, jamais
  // par stdin (que `stdio[0] = 'ignore'` ferme) ni par une ligne de commande à échapper.
  const fichier = join(tmpdir(), `wfrp-ruleset-${process.pid}.json`)
  try {
    const id = idExistant(runner)
    writeFileSync(fichier, JSON.stringify(corps))
    const cible = id === null ? `repos/${DEPOT}/rulesets` : `repos/${DEPOT}/rulesets/${id}`
    runner(['api', '-X', id === null ? 'POST' : 'PUT', cible, '--input', fichier])
    sortie(`[ruleset] ${NOM} ${id === null ? 'créé' : `mis à jour (id ${id})`} en mode evaluate\n`)
    return 0
  } catch (erreur) {
    journal(`${refusGh(erreur)}\n`)
    return 1
  } finally {
    rmSync(fichier, { force: true })
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1])
  process.exit(executer({ argv: process.argv.slice(2) }))
