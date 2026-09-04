// CE QUE LE RULESET EN ÉVALUATION AURAIT REFUSÉ — lecture des `rule-suites` de `main`.
//
// Un ruleset `enforcement: evaluate` (voir `scripts/ops/ruleset-evaluate.mjs`) ne bloque rien : il
// JOURNALISE, push par push, le verdict qu'il aurait rendu. La part de `result: fail` est le chiffre
// qui doit décider de son passage en `active` — sans elle, l'activation serait un pari.
// Joué par le canari hebdo, et à la main par `npm run ops:rule-suites`.
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
export const DEPOT = 'cgauche/game'

/** JAMAIS `shell: true` (`&` d'une requête coupe la commande sous `cmd.exe`) ; `stdio[0] = 'ignore'`
 *  est le `< /dev/null` qu'un `gh` de workflow réclame. */
const gh = (args) =>
  execFileSync('gh', args, { cwd: RACINE, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] })

/**
 * Part des pushes qui auraient été REFUSÉS. PUR.
 * @param {{ result?: string, evaluation_result?: string, pushed_at?: string, actor_name?: string, ref?: string }[]} suites
 * @param {string} depuis date ISO `YYYY-MM-DD` : les suites antérieures sont écartées
 */
export function partRefusee(suites, depuis) {
  const dans = suites.filter((s) => String(s.pushed_at ?? '') >= depuis)
  // Deux champs portent le verdict selon l'`enforcement` : `result` pour un ruleset actif,
  // `evaluation_result` pour un ruleset en évaluation. On lit les deux, sans en préférer un.
  const echecs = dans.filter((s) => s.result === 'fail' || s.evaluation_result === 'fail')
  return {
    total: dans.length,
    echecs: echecs.length,
    part: dans.length ? echecs.length / dans.length : 0,
    lignes: echecs.map((s) => `${s.pushed_at} · ${s.actor_name ?? '?'} · ${s.ref ?? '?'}`),
  }
}

/**
 * Ce que dit l'ABSENCE de ruleset. Le vide se DIT, et il DIT sa raison : `evaluate` est refusé par
 * GitHub sur le plan de ce dépôt (HTTP 422, mesuré 2026-09-04), donc aucun ruleset n'y est posé.
 */
export const SANS_RULESET =
  '[rule-suites] aucun ruleset sur le dépôt — `evaluate` est refusé sur ce plan GitHub, voir ' +
  'scripts/ops/ruleset-evaluate.mjs'

/** Rendu du verdict, y compris quand il n'y a RIEN à dire — un vide se DIT, il ne se tait pas. */
export function rendu({ total, echecs, part, lignes }, { depuis, pose }) {
  if (total === 0) {
    return `[rule-suites] aucun push évalué depuis le ${pose ?? depuis} — le ruleset ne mesure encore rien.`
  }
  const pct = (part * 100).toFixed(0)
  return [
    `[rule-suites] ${echecs}/${total} push(es) auraient été REFUSÉS depuis le ${depuis} (${pct} %)`,
    ...lignes.map((l) => `  - ${l}`),
  ].join('\n')
}

function main() {
  const args = process.argv.slice(2)
  const iDepuis = args.indexOf('--depuis')
  const defaut = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString().slice(0, 10)
  const depuis = iDepuis !== -1 ? args[iDepuis + 1] : defaut

  let suites = []
  let pose = null
  try {
    suites = JSON.parse(gh(['api', '--paginate', `repos/${DEPOT}/rulesets/rule-suites?ref=main&per_page=100`]))
    const rulesets = JSON.parse(gh(['api', `repos/${DEPOT}/rulesets`]))
    pose = rulesets.find((r) => r.name === 'main-evaluate')?.created_at?.slice(0, 10) ?? null
  } catch (err) {
    // Fail-LOUD : un endpoint indisponible n'est pas « 0 refus ».
    process.stderr.write(`[rule-suites] lecture impossible : ${String(err.message).slice(0, 300)}\n`)
    process.exit(1)
  }
  if (pose === null) {
    process.stdout.write(`${SANS_RULESET}\n`)
    return
  }
  process.stdout.write(`${rendu(partRefusee(suites, depuis), { depuis, pose })}\n`)
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main()
