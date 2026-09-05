// COURSES CI DE `main` — l'unique lecture `gh run list` de ce dépôt (hors sondes).
//
// Une COURSE est une exécution de workflow. Trois portes la lisent, chacune avec sa fenêtre : la
// porte au push (30, puis 300 dans le cas rare où aucune course verte d'un ancêtre n'est dans les
// 30), les faits de palier (300, tous workflows), la mesure des pushes justifiés (200). La FENÊTRE
// est le seul réglage : `gh run list` n'a pas de fenêtre de dates, la limite EST la fenêtre.
//
// COÛT MESURÉ (2026-09-05, ce dépôt, médiane de trois passes) : `--limit 1` = 985 ms,
// `--limit 30` = 1 583 ms, `--limit 300` = 10 732 ms. La lecture en deux temps du pre-push tient à
// cet écart : passer de 30 à 300 coûte ~9 s à CHAQUE push.
//
// La sortie est TRIÉE par `createdAt` décroissant ICI : un consommateur qui prend `courses[0]` prend
// la plus récente sans avoir à le savoir, et deux consommateurs ne trient pas différemment.
//
// MESURE : `WFRP_GH_STUB=<fichier json>` fournit la réponse au lieu de `gh`. Deux formes :
//   · un TABLEAU de courses — servi à chaque appel ;
//   · `{ "appels": [ [...], [...] ] }` — une liste PAR APPEL, la dernière se répète. C'est la forme
//     qui rejoue une liste PÉRIMÉE puis sa relecture (session #1508), et les deux fenêtres 30/300.
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { classer, fait, indisponible } from './gitPorte.mjs'

/** Champs demandés à `gh` : l'union de ce que les trois consommateurs lisent, une seule fois. */
export const CHAMPS = 'conclusion,createdAt,databaseId,headSha,status,workflowName'

/** Appels déjà servis par un fichier de stub, par chemin. */
const appelsServis = new Map()

/** Remet les compteurs du stub à zéro (un test qui joue deux scénarios sur le même fichier). */
export const reinitialiserStub = () => appelsServis.clear()

/** Courses d'un stub, PUR sauf le compteur d'appels : la n-ième lecture reçoit la n-ième liste. */
function listeDuStub(chemin) {
  let lu
  try {
    lu = JSON.parse(readFileSync(chemin, 'utf8'))
  } catch (e) {
    return indisponible(e.message)
  }
  if (Array.isArray(lu)) return fait(triees(lu))
  const appels = Array.isArray(lu?.appels) ? lu.appels : null
  if (!appels || appels.length === 0) return indisponible(`stub ${chemin} : ni tableau de courses ni \`appels\``)
  const rang = appelsServis.get(chemin) ?? 0
  appelsServis.set(chemin, rang + 1)
  return fait(triees(appels[Math.min(rang, appels.length - 1)]))
}

/** Tri par `createdAt` décroissant ; à défaut de date, l'ordre servi est conservé. PUR. */
export function triees(courses) {
  return [...(courses ?? [])]
    .map((c, rang) => ({ c, rang }))
    .sort((a, b) => String(b.c.createdAt ?? '').localeCompare(String(a.c.createdAt ?? '')) || a.rang - b.rang)
    .map(({ c }) => c)
}

/**
 * Les courses CI de `main`, en union à trois issues (jamais `absent` : une liste vide EST un fait).
 * @param {{cwd?:string, env?:object, limit?:number, workflow?:string|null, spawn?:Function}} [p]
 * @returns {{disponible:true, valeur:object[]}|{disponible:false, raison:string}}
 */
export function coursesCiDeMain({ cwd = process.cwd(), env = process.env, limit = 30, workflow = 'ci.yml', spawn = spawnSync } = {}) {
  if (env.WFRP_GH_STUB) return listeDuStub(env.WFRP_GH_STUB)
  const args = [
    'run', 'list', '--branch', 'main',
    ...(workflow ? ['--workflow', workflow] : []),
    '--limit', String(limit), '--json', CHAMPS,
  ]
  const vu = classer(spawn('gh', args, {
    cwd, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'], timeout: 120000,
  }))
  if (!vu.disponible) return vu
  if (vu.absent) return indisponible('gh n’a rendu aucune sortie exploitable')
  if (vu.valeur.status !== 0) return indisponible(`gh a rendu ${vu.valeur.status}`)
  try {
    const lu = JSON.parse(vu.valeur.stdout)
    return Array.isArray(lu) ? fait(triees(lu)) : indisponible('gh n’a pas rendu un tableau de courses')
  } catch (e) {
    return indisponible(e.message)
  }
}
