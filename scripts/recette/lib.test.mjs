// Sonde de la LOGIQUE de survie au rechargement du pipeline de capture (#1196, promue en test
// committé sous #1211) : classification des erreurs CDP (`isNavigationError`) et politique de
// rejeu (`withReloadRetry`). Tests PURS — aucun Chrome, aucun serveur, aucun process : la session
// est un faux objet local. Lancé par `npm run test:recette`.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { isNavigationError, TARGET_NAVIGATED, withReloadRetry } from './lib.mjs'

/** Session factice : `evaluate` (via `rpc`) répond « app prête » immédiatement, aucun réseau. */
function fakeSession() {
  return {
    contextCleared: false,
    rpc: async () => ({ result: { value: true } }),
  }
}

const err = (message) => new Error(message)

// ---------------------------------------------------------------- classification

test('classification : le code TARGET_NAVIGATED marque l\'erreur rejouable', () => {
  const e = err('message quelconque sans motif reconnu')
  e.code = TARGET_NAVIGATED
  assert.equal(isNavigationError(e), true)
})

for (const message of [
  'Inspected target navigated or closed',
  'Execution context was destroyed.',
  'Cannot find context with specified id',
  'Target closed',
  'Session with given id not found',
  'No target with given id',
]) {
  test(`classification : « ${message} » est rejouable`, () => {
    assert.equal(isNavigationError(err(message)), true)
  })
}

test('classification : casse indifférente (les motifs CDP sont insensibles à la casse)', () => {
  assert.equal(isNavigationError(err('INSPECTED TARGET NAVIGATED OR CLOSED')), true)
})

test('classification : helper de DEV évaporé — lecture sur undefined/null', () => {
  assert.equal(isNavigationError(err("Cannot read properties of undefined (reading 'screen')")), true)
  assert.equal(isNavigationError(err("Cannot read properties of null (reading 'screen')")), true)
})

test('classification : helper de DEV évaporé — window.__wfrp is not a function / undefined', () => {
  assert.equal(isNavigationError(err('window.__wfrp is not a function')), true)
  assert.equal(isNavigationError(err('window.__wfrp is undefined')), true)
})

test('classification : une CHAÎNE nue est classée sur son texte', () => {
  assert.equal(isNavigationError('Execution context was destroyed'), true)
  assert.equal(isNavigationError('bouton introuvable'), false)
})

test('classification : une erreur quelconque n\'est PAS rejouable', () => {
  assert.equal(isNavigationError(err('Condition jamais vraie après 8000ms : document.querySelector(".btn")')), false)
})

test('classification : absence d\'erreur ou message vide — pas rejouable', () => {
  assert.equal(isNavigationError(null), false)
  assert.equal(isNavigationError(undefined), false)
  assert.equal(isNavigationError(err('')), false)
})

// ---------------------------------------------------------------- politique de rejeu

test('withReloadRetry : une erreur rejouable est rejouée `tries` fois puis abandonnée, l\'erreur d\'origine en cause', async () => {
  const session = fakeSession()
  let calls = 0
  const origine = err('Inspected target navigated or closed')
  const retries = []
  await assert.rejects(
    () => withReloadRetry(session, async () => { calls++; throw origine }, {
      tries: 3, timeoutMs: 100, onRetry: (e, i, n) => { retries.push([i, n]) },
    }),
    (e) => {
      assert.match(e.message, /3 tentatives épuisées/)
      assert.equal(e.cause, origine)
      return true
    },
  )
  assert.equal(calls, 3)
  assert.deepEqual(retries, [[1, 3], [2, 3]])
})

test('withReloadRetry : une erreur NON rejouable remonte telle quelle, AUCUN rejeu', async () => {
  const session = fakeSession()
  let calls = 0
  const origine = err('bouton « Lancer » introuvable')
  let retried = false
  await assert.rejects(
    () => withReloadRetry(session, async () => { calls++; throw origine }, {
      tries: 3, timeoutMs: 100, onRetry: () => { retried = true },
    }),
    (e) => e === origine,
  )
  assert.equal(calls, 1)
  assert.equal(retried, false)
})

test('withReloadRetry : le succès au 2e essai rend le résultat', async () => {
  const session = fakeSession()
  let calls = 0
  const valeur = await withReloadRetry(session, async () => {
    calls++
    if (calls === 1) throw err('Execution context was destroyed')
    return 'capture ok'
  }, { tries: 3, timeoutMs: 100 })
  assert.equal(valeur, 'capture ok')
  assert.equal(calls, 2)
})

test('withReloadRetry : `resettle` remet l\'écran entre deux tentatives', async () => {
  const session = fakeSession()
  let calls = 0
  let resettles = 0
  const valeur = await withReloadRetry(session, async () => {
    calls++
    if (calls === 1) throw err('Target closed')
    return 42
  }, { tries: 3, timeoutMs: 100, resettle: () => { resettles++ } })
  assert.equal(valeur, 42)
  assert.equal(resettles, 1)
})

test('withReloadRetry : `contextCleared` déclenche le rejeu même sur une erreur non classée', async () => {
  const session = fakeSession()
  let calls = 0
  const valeur = await withReloadRetry(session, async () => {
    calls++
    if (calls === 1) { session.contextCleared = true; throw err('valeur inattendue : undefined') }
    return 'ok'
  }, { tries: 3, timeoutMs: 100 })
  assert.equal(valeur, 'ok')
  assert.equal(calls, 2)
})

test('withReloadRetry : le succès au 1er essai n\'appelle ni onRetry ni resettle', async () => {
  const session = fakeSession()
  let touched = 0
  const valeur = await withReloadRetry(session, async () => 'direct', {
    tries: 3, timeoutMs: 100, onRetry: () => { touched++ }, resettle: () => { touched++ },
  })
  assert.equal(valeur, 'direct')
  assert.equal(touched, 0)
})
