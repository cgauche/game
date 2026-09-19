// CE QU'UNE PLAGE DE COMMITS FERME — le vocabulaire de LECTURE, partagé (#1813).
//
// Il vit ici, et non dans `scripts/ops/fermer-depuis-main.mjs`, pour une raison MÉCANIQUE : ce script
// porte le geste qui ferme les tickets SOLDÉS (job `fermetures` de ci.yml), et ce geste n'est hors de
// portée d'un tiers que tant que le script est une FEUILLE que rien n'importe (`modulesFeuilles.mjs`).
// Le train de publication lit donc son vocabulaire de plage ICI. Un cliquet d'argv littéraux ne
// suffirait pas à le dire : un appel indirect n'en laisse aucun — mesuré, un `fermerLeTicket(...)`
// glissé dans l'étape `pilotage` laisse un cliquet d'argv entièrement vert.
//
// Lecture PURE ou lecture de git : rien ici n'écrit, ni sur le disque, ni sur GitHub.
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { estAncetre } from './gitPorte.mjs'
import { numerosFermes } from './fermetures.mjs'

/** L'arbre lu par défaut : celui où VIT ce module. */
const RACINE = fileURLToPath(new URL('../../..', import.meta.url))

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
    for (const numero of numerosFermes(c.message)) {
      if (!vus.has(numero)) vus.set(numero, c.sha)
    }
  }
  return [...vus].map(([numero, sha]) => ({ numero, sha }))
}

/**
 * Que faire d'un ticket, sachant son état et ses commentaires. PUR.
 * La marque du sha se lit AVANT l'état : le geste de fermeture est en DEUX temps (commentaire posé,
 * puis état patché), donc un PATCH raté laisse un ticket OUVERT qui porte DÉJÀ son solde. Juger sur
 * le seul `etat === 'open'` ferait poster un SECOND solde identique au rejeu du job.
 * @returns {'fermer'|'patcher'|'rien'|'rapporter'}
 *   `fermer` = commentaire à poser PUIS état à patcher ; `patcher` = solde déjà posé, seul l'état
 *   reste à fermer ; `rien` = déjà fermée PAR CE SHA (rejeu) ; `rapporter` = fermée par un AUTRE
 *   geste — on ne la referme pas, on le DIT.
 */
export function decisionPour({ etat, commentaires, sha }) {
  const soldeDeja = commentaires.some((c) => String(c).includes(marqueDe(sha)))
  if (etat === 'open') return soldeDeja ? 'patcher' : 'fermer'
  return soldeDeja ? 'rien' : 'rapporter'
}

/** Cette décision POSTE-t-elle un solde ? L'invariant se lit ici, une fois : la marque du sha déjà
 *  au fil ⇒ aucun POST, quel que soit l'état du ticket. */
export const posteUnSolde = (decision) => decision === 'fermer'

/**
 * Une issue déjà fermée par un AUTRE geste s'AVERTIT, elle ne rougit pas : le commit a fait son
 * travail, et rougir le job `fermetures` sur `main` pour cela ferait passer pour cassée une
 * publication saine. `::warning::` est la forme que GitHub Actions remonte à l'annotation de la course.
 * L'échec reste réservé aux défauts réels : API en erreur, ticket inexistant, plage illisible.
 */
export const avertissementRapportee = (numero, sha) =>
  `::warning::[fermetures] #${numero} déjà FERMÉE par un autre geste que ${sha} — non refermée, à vérifier\n`

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
  const vu = estAncetre(base, tete, { cwd })
  if (!vu.disponible) return `ascendance de ${plage} indisponible : ${vu.raison} — aucune fermeture n'est jugée`
  if (vu.absent || vu.valeur !== true)
    return `base ${base} inatteignable depuis ${tete} : push non fast-forward sur main, interdit par le pre-push`
  return null
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
