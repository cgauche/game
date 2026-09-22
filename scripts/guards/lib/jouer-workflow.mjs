// JOUER UN SCRIPT DE WORKFLOW AVEC DES DOUBLURES — sans un seul agent.
//
// Un script de workflow (`.claude/workflows/*.js`, `scripts/**/*.workflow.js`) est du JavaScript
// qu'aucun `import` ne peut charger : `export const meta` d'un côté, `return` de premier niveau de
// l'autre. Le harnais l'enveloppe dans une fonction async ; ce module l'enveloppe DE LA MÊME FAÇON,
// pour que ce qu'un banc observe soit ce que le script REND et ce qu'il ENVOIE — jamais une
// réécriture de l'un ou de l'autre dans un test.
//
// SOURCE UNIQUE de cette enveloppe : deux copies dériveraient dès que le harnais change une
// doublure, et un banc jouerait alors un autre script que celui qui part.

import { readFileSync } from 'node:fs'

/**
 * @typedef {object} RunDeWorkflow
 * @property {any} rendu ce que le script `return`
 * @property {Map<string, string>} promptsParLabel `phase:label` → prompt ENVOYÉ
 * @property {Map<string, any>} optionsParLabel `phase:label` → OPTIONS envoyées (type d'agent, modèle,
 *   schéma) : ce qu'un banc doit pouvoir juger sans relire le source à la regex
 * @property {string[]} journal ce que le script a passé à `log`
 */

/**
 * Joue le script de workflow du chemin donné, dans l'enveloppe du harnais.
 * `repondre(prompt, opts)` rend ce que l'agent aurait rendu, phase par phase.
 * @param {string} chemin chemin ABSOLU du script de workflow
 * @param {any} argsDuRun la valeur du global `args`
 * @param {(prompt: string, opts: any) => any} repondre
 * @returns {Promise<RunDeWorkflow>}
 */
export async function jouerWorkflow(chemin, argsDuRun, repondre) {
  const source = readFileSync(chemin, 'utf8').replace(/^export const meta/m, 'const meta')
  const promptsParLabel = new Map()
  const optionsParLabel = new Map()
  const journal = []
  const agent = (prompt, opts) => {
    promptsParLabel.set(`${opts.phase}:${opts.label}`, prompt)
    optionsParLabel.set(`${opts.phase}:${opts.label}`, opts)
    return Promise.resolve(repondre(prompt, opts))
  }
  // Les doublures font ce que fait le harnais, point par point :
  //  · `parallel` ne REJETTE jamais — un thunk qui lève rend `null`, comme un agent mort ;
  //  · `pipeline` dépose à `null` l'item dont une stage lève, et saute ses stages restantes ;
  //  · les items qui traversent `pipeline` sont des COPIES — une comparaison d'identité y est fausse.
  const parallel = (thunks) => Promise.all(thunks.map((t) => Promise.resolve().then(t).catch(() => null)))
  const copie = (v) => (v === undefined ? undefined : structuredClone(v))
  const pipeline = async (items, ...stages) => {
    const out = []
    for (const item of items) {
      let courant = copie(item)
      for (const stage of stages) {
        try {
          courant = copie(await stage(courant))
        } catch {
          courant = null
          break
        }
      }
      out.push(courant)
    }
    return out
  }
  const fabrique = new Function(
    'agent', 'parallel', 'pipeline', 'phase', 'log', 'args', 'budget',
    `return (async () => {\n${source}\n})()`,
  )
  const rendu = await fabrique(agent, parallel, pipeline, () => {}, (m) => journal.push(m), argsDuRun, undefined)
  return { rendu, promptsParLabel, optionsParLabel, journal }
}
