// FERMETURE DES TICKETS SOLDÉS — jouée DEPUIS `main`, après une CI verte, jamais au commit local.
//
// Un ticket se ferme quand son correctif est PUBLIÉ, pas quand un commit existe sur une machine :
// #1685 a été fermé par 8b52f3a55 avant que ce commit n'atteigne `main`, et un commit rebasé au loin
// ou jamais poussé laisse un ticket fermé sans code (revue de palier n°3, 2026-09-04, écart 10).
// Aucun hook local ne ferme donc de ticket : c'est le job `fermetures` de `ci.yml` qui appelle ce
// script sur la plage réellement poussée, après le job `build`.
//
// Usage : node scripts/ops/fermer-depuis-main.mjs <before>..<sha>   (`npm run ops:fermer -- <plage>`)
// Le geste GitHub appartient à l'orchestrateur et à la CI, jamais à un agent.
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
export const DEPOT = 'cgauche/game'

/** Le MÊME motif que `fermetures-sans-solde.test.mjs` et que `fermetures-non-citees.mjs`. */
export const FERMETURE_RE = /(fixes|closes|corrige|ferme)\s+#(\d+)/gi

/** Marque d'IDEMPOTENCE posée dans le commentaire de fermeture : elle porte le sha qui a soldé. */
export const marqueDe = (sha) => `<!-- ferme-depuis-main: ${sha} -->`

/**
 * Tickets fermés par une plage de commits, chacun rattaché au PREMIER commit qui le cite. PUR.
 * @param {{ sha: string, message: string }[]} commits du plus ancien au plus récent
 * @returns {{ numero: string, sha: string }[]}
 */
export function fermeturesDeLaPlage(commits) {
  const vus = new Map()
  for (const c of commits) {
    for (const m of String(c.message).matchAll(FERMETURE_RE)) {
      if (!vus.has(m[2])) vus.set(m[2], c.sha)
    }
  }
  return [...vus].map(([numero, sha]) => ({ numero, sha }))
}

/**
 * Que faire d'un ticket, sachant son état et ses commentaires. PUR.
 * @returns {'fermer'|'rien'|'rapporter'} `rien` = déjà fermée PAR CE SHA (rejeu du job) ;
 *   `rapporter` = déjà fermée par un AUTRE geste — on ne la referme pas, on le DIT.
 */
export function decisionPour({ etat, commentaires, sha }) {
  if (etat === 'open') return 'fermer'
  return commentaires.some((c) => String(c).includes(marqueDe(sha))) ? 'rien' : 'rapporter'
}

/**
 * Une issue déjà fermée par un AUTRE geste s'AVERTIT, elle ne rougit pas : le commit a fait son
 * travail, et rougir le job `fermetures` sur `main` pour cela ferait passer pour cassée une
 * publication saine. `::warning::` est la forme que GitHub Actions remonte à l'annotation du run.
 * L'échec reste réservé aux défauts réels : API en erreur, ticket inexistant, plage illisible.
 */
export const avertissementRapportee = (numero, sha) =>
  `::warning::[fermetures] #${numero} déjà FERMÉE par un autre geste que ${sha} — non refermée, à vérifier\n`

/** JAMAIS `shell: true` ; `stdio[0] = 'ignore'` = le `< /dev/null` qu'un `gh` de workflow réclame. */
const gh = (args) =>
  execFileSync('gh', args, { cwd: RACINE, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] })

/** Le dépôt LU est un paramètre : le test joue sur un dépôt jetable de `os.tmpdir()`, jamais sur
 *  l'arbre de travail (un test ne fabrique pas de commits dans l'arbre partagé). */
const git = (args, cwd = RACINE) => execFileSync('git', args, { cwd, encoding: 'utf8', maxBuffer: 1e8 })

/**
 * La base d'une plage est-elle un ANCÊTRE de sa tête ? `git log <base>..<tête>` sur une base
 * inatteignable lève une erreur brute de git ; le job qui l'appelle doit dire CE QUI s'est passé.
 * @returns {string|null} le motif de refus, ou `null` si la plage est lisible
 */
export function motifDePlageIllisible(plage, cwd = RACINE) {
  const [base, tete] = plage.split('..')
  try {
    git(['merge-base', '--is-ancestor', base, tete], cwd)
    return null
  } catch {
    return `base ${base} inatteignable depuis ${tete} : push non fast-forward sur main, interdit par le pre-push`
  }
}

/** Commits d'une plage `<a>..<b>`, du plus ancien au plus récent. */
export function commitsDeLaPlage(plage, cwd = RACINE) {
  const brut = git(['log', '--reverse', '--pretty=format:%H%x1f%B%x00', plage], cwd)
  return brut.split('\0').filter((b) => b.trim()).map((bloc) => {
    const [sha, message] = bloc.replace(/^\n/, '').split('\x1f')
    return { sha, message: message ?? '' }
  })
}

/** Solde tel que le COMMIT l'emporte (jamais le disque du runner) ; `null` s'il n'y est pas. */
export function soldeDuCommit(sha, numero, cwd = RACINE) {
  try {
    return git(['show', `${sha}:.claude/soldes/${numero}.md`], cwd)
  } catch {
    return null
  }
}

function main() {
  const plage = process.argv[2]
  if (!plage || !plage.includes('..')) {
    process.stderr.write('usage : node scripts/ops/fermer-depuis-main.mjs <before>..<sha>\n')
    process.exit(2)
  }
  const illisible = motifDePlageIllisible(plage)
  if (illisible) {
    process.stderr.write(`[fermetures] ${illisible}\n`)
    process.exit(1)
  }
  const fermetures = fermeturesDeLaPlage(commitsDeLaPlage(plage))
  if (fermetures.length === 0) {
    process.stdout.write(`[fermetures] ${plage} : aucun ticket cité par un commit fermant\n`)
    return
  }
  let rate = 0
  for (const { numero, sha } of fermetures) {
    const issue = JSON.parse(gh(['issue', 'view', numero, '--repo', DEPOT, '--json', 'state,comments']))
    const etat = String(issue.state).toLowerCase()
    const decision = decisionPour({ etat, commentaires: (issue.comments ?? []).map((c) => c.body), sha })
    if (decision === 'rien') {
      process.stdout.write(`[fermetures] #${numero} déjà fermée par ${sha} — rien à faire\n`)
      continue
    }
    if (decision === 'rapporter') {
      process.stderr.write(avertissementRapportee(numero, sha))
      continue
    }
    const solde = soldeDuCommit(sha, numero)
    const corps = `${solde ?? `Fermé par le commit ${sha}, publié sur main (aucun solde emporté).`}\n\n${marqueDe(sha)}\n`
    try {
      gh(['issue', 'close', numero, '--repo', DEPOT, '--comment', corps])
      process.stdout.write(`[fermetures] #${numero} fermée (solde du commit ${sha}${solde ? '' : ' — ABSENT'})\n`)
    } catch (err) {
      process.stderr.write(`[fermetures] #${numero} : fermeture impossible — ${String(err.message).slice(0, 200)}\n`)
      rate += 1
    }
  }
  if (rate) process.exit(1)
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main()
