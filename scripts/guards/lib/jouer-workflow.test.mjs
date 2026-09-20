// L'ENVELOPPE de jeu d'un workflow — ce qu'elle garantit à tout banc qui s'en sert.
// Le script joué ici est un JOUET écrit par le banc : il n'éprouve aucun workflow réel, seulement
// le contrat de l'enveloppe (dé-export de `meta`, `args` transmis, doublures `agent`/`parallel`/
// `pipeline`/`phase`/`log`, COPIES à travers `pipeline`). Sans lui, un défaut de l'enveloppe se
// lirait comme un défaut du workflow joué.
import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { jouerWorkflow } from './jouer-workflow.mjs'

/** Écrit un script jouet dans un dossier JETABLE et le joue. */
async function jouerJouet(source, argsDuRun, repondre = () => ({ ok: true })) {
  const dir = mkdtempSync(join(tmpdir(), 'jouer-workflow-'))
  try {
    const chemin = join(dir, 'jouet.workflow.js')
    writeFileSync(chemin, source, 'utf8')
    return await jouerWorkflow(chemin, argsDuRun, repondre)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

test('`export const meta` est dé-exporté et le `return` de premier niveau est rendu', async () => {
  const { rendu } = await jouerJouet([
    "export const meta = { name: 'jouet', phases: [] }",
    'return { nom: meta.name }',
  ].join('\n'))
  assert.deepEqual(rendu, { nom: 'jouet' })
})

test('`args` arrive au script TEL QUEL, et un `args` absent vaut `undefined`', async () => {
  const src = 'return { vu: typeof args === "undefined" ? "absent" : args }'
  assert.deepEqual((await jouerJouet(src, { a: 1 })).rendu, { vu: { a: 1 } })
  assert.deepEqual((await jouerJouet(src, undefined)).rendu, { vu: 'absent' })
})

test('les prompts sont capturés par `phase:label`, et `log` alimente le journal', async () => {
  const { promptsParLabel, journal } = await jouerJouet([
    "phase('P')",
    "log('une ligne')",
    "await agent('mon prompt', { phase: 'P', label: 'l1' })",
    'return {}',
  ].join('\n'))
  assert.deepEqual([...promptsParLabel], [['P:l1', 'mon prompt']])
  assert.deepEqual(journal, ['une ligne'])
})

test('`parallel` ne REJETTE jamais : un thunk qui lève rend `null`, comme un agent mort', async () => {
  const { rendu } = await jouerJouet([
    'const r = await parallel([() => 1, () => { throw new Error("mort") }, () => 3])',
    'return { r }',
  ].join('\n'))
  assert.deepEqual(rendu.r, [1, null, 3])
})

test('`pipeline` dépose à `null` l’item dont une stage lève, et saute ses stages restantes', async () => {
  const { rendu } = await jouerJouet([
    'let vues = 0',
    'const r = await pipeline([{ n: 1 }, { n: 2 }],',
    '  (x) => { if (x.n === 2) throw new Error("mort") ; return { n: x.n * 10 } },',
    '  (x) => { vues++ ; return { n: x.n + 1 } })',
    'return { r, vues }',
  ].join('\n'))
  assert.deepEqual(rendu.r, [{ n: 11 }, null])
  assert.equal(rendu.vues, 1, 'la seconde stage n’est pas jouée sur l’item mort')
})

test('les items qui traversent `pipeline` sont des COPIES — une comparaison d’identité y est fausse', async () => {
  const { rendu } = await jouerJouet([
    'const item = { n: 1 }',
    'let recu = null',
    'const r = await pipeline([item], (x) => { recu = x ; return x })',
    'return { memeObjet: recu === item, valeur: r[0].n }',
  ].join('\n'))
  assert.equal(rendu.memeObjet, false)
  assert.equal(rendu.valeur, 1)
})
