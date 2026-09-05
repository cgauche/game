// Contrat de la grammaire d'invocation partagée : les cas des DEUX consommateurs (`justifie.mjs`
// avec `--capture`, `lancer-local.mjs` sans option puis avec `--cwd`) sont joués ici, sur la même
// fonction — une forme refusée par l'un l'est par l'autre.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { separerInvocation } from './invocation.mjs'

test('forme nue : `<positionnel> -- <reste…>`', () => {
  assert.deepEqual(separerInvocation(['typescript', '--', 'tsc', '--noEmit']), {
    positionnel: 'typescript',
    options: {},
    reste: ['tsc', '--noEmit'],
  })
})

test('option déclarée : lue, retirée du reste, nommée SANS ses tirets', () => {
  assert.deepEqual(separerInvocation(['typecheck', '--capture', 'sortie.txt', '--', 'npm', 'run', 'typecheck:brut'], { options: ['--capture'] }), {
    positionnel: 'typecheck',
    options: { capture: 'sortie.txt' },
    reste: ['npm', 'run', 'typecheck:brut'],
  })
  assert.deepEqual(separerInvocation(['eslint', '--cwd', '/tmp/fixtures', '--', 'eslint', '.'], { options: ['--cwd'] }), {
    positionnel: 'eslint',
    options: { cwd: '/tmp/fixtures' },
    reste: ['eslint', '.'],
  })
})

test('le séparateur est cherché, jamais supposé en position 1', () => {
  const vu = separerInvocation(['gate', '--capture', 'f.txt', '--', 'node', '--test'], { options: ['--capture'] })
  assert.deepEqual(vu.reste, ['node', '--test'])
})

test('tout ce qui suit `--` appartient à la commande : un `--capture` y reste un argument', () => {
  const vu = separerInvocation(['gate', '--', 'npm', 'run', 'x', '--capture', 'y', '--'], { options: ['--capture'] })
  assert.deepEqual(vu.options, {})
  assert.deepEqual(vu.reste, ['npm', 'run', 'x', '--capture', 'y', '--'])
})

test('formes refusées : `null`, jamais une invocation partielle', () => {
  assert.equal(separerInvocation(['typescript', 'tsc']), null, 'sans séparateur')
  assert.equal(separerInvocation(['typescript', '--']), null, 'reste vide')
  assert.equal(separerInvocation(['--', 'tsc']), null, 'sans positionnel')
  assert.equal(separerInvocation([]), null, 'aucun argument')
  assert.equal(separerInvocation(['gate', '--verbeux', 'oui', '--', 'npm'], { options: ['--capture'] }), null, 'option non déclarée')
  assert.equal(separerInvocation(['gate', '--capture', '--', 'npm'], { options: ['--capture'] }), null, 'option sans valeur')
  assert.equal(separerInvocation(['gate', '--capture', 'a', '--capture', 'b', '--', 'npm'], { options: ['--capture'] }), null, 'option répétée')
  assert.equal(separerInvocation(['gate', '--capture', 'a', '--', 'npm']), null, 'aucune option déclarée par l’appelant')
})
