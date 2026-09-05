// TÊTES DE PUSH × JUSTIFICATIFS DE GATE — chaque contenu poussé sur `main` porte-t-il, sur le disque
// de ce clone, le verdict VERT de chacune des gates de `ci.yml` ?
//
// C'est une MESURE d'ops, pas un test : elle interroge l'HISTOIRE RÉELLE (les courses CI du dépôt) et
// le répertoire git COMMUN (`<git-common-dir>/wfrp-justificatifs/`, partagé par tous les worktrees).
// Ce que la porte au push garantit à l'instant du push (`scripts/git-hooks/pre-push.mjs`), cette
// mesure le RELIT après coup, tête par tête : un régime qui tient se lit `22/22` sur chaque ligne.
//
// Portée : les justificatifs vivent HORS de git — un clone frais n'en a aucun, et la mesure y rend
// `0/22` partout. Elle se joue sur le clone qui a poussé.
//
// Usage : `npm run ops:pushes-justifies [-- --depuis <sha>]` (défaut : les têtes de push connues de
// `gh`, dans l'ordre de l'histoire). Exit 1 dès qu'une tête n'a pas toutes ses gates au vert.
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import {
  clesDeContenu,
  gatesRequises,
  lireJustificatif,
  migrerAncienneGraphie,
  motifDeRefus,
} from '../guards/lib/justificatif.mjs'
import { coursesCiDeMain } from '../guards/lib/coursesCi.mjs'

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..', '..')

/**
 * Croisement PUR : pour chaque tête, les gates dont le justificatif vaut pour SON contenu. Le
 * verdict est celui du push — `motifDeRefus`, le même juge que le hook : un justificatif pris sur
 * un arbre SALE ne crédite rien ici non plus (21 des 908 croisements mesurés le 2026-09-04
 * divergeaient sur ce seul volet).
 * @param {{ sha: string, sujet?: string }[]} tetes
 * @param {{ nom: string, commande?: string }[]} gates gates exigées
 * @param {Record<string, Record<string, object | null>>} justificatifs vues par sha de tête
 */
export function croiser(tetes, gates, justificatifs) {
  return tetes.map((tete) => {
    const vus = justificatifs[tete.sha] ?? {}
    const manquantes = gates
      .filter((gate) => motifDeRefus(vus[gate.nom] ?? null, gate) !== null)
      .map((gate) => gate.nom)
    return {
      ...tete,
      verts: gates.length - manquantes.length,
      total: gates.length,
      manquantes,
      complet: manquantes.length === 0,
    }
  })
}

/** Rendu de la mesure. PUR. Une tête incomplète NOMME les gates qui lui manquent. */
export function rendu(lignes) {
  if (lignes.length === 0) return '[pushes-justifies] aucune tête de push à juger'
  const nues = lignes.filter((l) => !l.complet)
  return [
    ...lignes.map((l) => {
      const compte = `${String(l.verts).padStart(2)}/${l.total}`
      const queue = l.complet ? '' : `  ← manque : ${l.manquantes.join(', ')}`
      return `${l.sha.slice(0, 9)} ${compte}  ${(l.sujet ?? '').slice(0, 60)}${queue}`
    }),
    nues.length === 0
      ? `[pushes-justifies] ${lignes.length} tête(s) de push, toutes à ${lignes[0].total}/${lignes[0].total}`
      : `[pushes-justifies] ${nues.length}/${lignes.length} tête(s) de push sans tous leurs justificatifs`,
  ].join('\n')
}

/** Têtes de push connues de `gh`, dédupliquées, dans l'ordre de l'histoire locale. PUR. */
export function tetesDeGh(courses, connus) {
  const vus = new Set()
  const gardees = []
  for (const course of courses) {
    const sha = String(course.headSha ?? '')
    if (!sha || vus.has(sha) || !connus.has(sha)) continue
    vus.add(sha)
    gardees.push(sha)
  }
  return gardees
}

function main() {
  // Le magasin est partagé avec le lanceur de gates et le hook : la mesure le lit dans la graphie
  // courante, elle ne le laisse pas à deux graphies.
  migrerAncienneGraphie({ cwd: RACINE })
  const args = process.argv.slice(2)
  const iDepuis = args.indexOf('--depuis')
  const depuis = iDepuis !== -1 ? args[iDepuis + 1] : null
  const git = (a) => execFileSync('git', a, { cwd: RACINE, encoding: 'utf8', maxBuffer: 1 << 28 })

  // L'ordre et le périmètre viennent de l'histoire LOCALE ; `gh` ne dit que QUI a été poussé.
  const plage = depuis ? [`${depuis}^..HEAD`] : ['HEAD']
  const histoire = git(['rev-list', '--reverse', ...plage]).trim().split(/\r?\n/).filter(Boolean)
  const connus = new Set(histoire)

  const lues = coursesCiDeMain({ cwd: RACINE, limit: 200 })
  if (!lues.disponible) {
    // Fail-LOUD : une lecture muette n'est pas « aucun push ».
    process.stderr.write(`[pushes-justifies] lecture des courses impossible : ${String(lues.raison).slice(0, 300)}\n`)
    process.exit(1)
  }
  const pousses = new Set(tetesDeGh(lues.valeur, connus))
  const tetes = histoire
    .filter((sha) => pousses.has(sha))
    .map((sha) => ({
      sha,
      cles: clesDeContenu(sha, { cwd: RACINE }),
      sujet: git(['log', '-1', '--format=%s', sha]).trim(),
    }))

  const gates = gatesRequises({ cwd: RACINE })
  const justificatifs = {}
  for (const tete of tetes) {
    justificatifs[tete.sha] = Object.fromEntries(
      gates.map((gate) => [gate.nom, lireJustificatif({ cwd: RACINE, gate: gate.nom, cles: tete.cles })]),
    )
  }
  const lignes = croiser(tetes, gates, justificatifs)
  process.stdout.write(`${rendu(lignes)}\n`)
  if (lignes.some((l) => !l.complet)) process.exit(1)
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main()
