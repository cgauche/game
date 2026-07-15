// Test des regex de réfs partagées (`ldbRe`/`otherRe`, #434 défaut 3) : la forme `LIVRE ch.NN l.X`
// (écrite en parallèle de `LIVRE NN l.X` dans le code) doit être vue au même titre. Lancé par `npm run test:raw`.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { ldbRe, otherRe, span } from './_lib.mjs'

test('ldbRe : "LDB 17 l.27" matche', () => {
  const m = [...'LDB 17 l.27'.matchAll(ldbRe())]
  assert.equal(m.length, 1)
  assert.equal(m[0][1], '17')
  assert.equal(m[0][2], '27')
})

test('ldbRe : "LDB ch.17 l.27" matche (forme ch. optionnelle)', () => {
  const m = [...'LDB ch.17 l.27'.matchAll(ldbRe())]
  assert.equal(m.length, 1)
  assert.equal(m[0][1], '17')
  assert.equal(m[0][2], '27')
})

test('ldbRe : "ch.23 l.75" SANS livre ne matche pas (le groupe livre reste obligatoire)', () => {
  const m = [...'La Difficulté de l\'Artisanat (ch.23 l.75-103)'.matchAll(ldbRe())]
  assert.equal(m.length, 0)
})

test('ldbRe : suffixe plage "l.10-25" préservé avec la forme ch.', () => {
  const m = [...'LDB ch.10 l.10-25'.matchAll(ldbRe())]
  assert.equal(m.length, 1)
  assert.equal(span(m[0][2], m[0][3]).join(','), '10,25')
})

test('ldbRe : suffixe points "l.10+17" préservé avec la forme ch.', () => {
  const m = [...'LDB ch.10 l.10+17'.matchAll(ldbRe())]
  assert.equal(m.length, 1)
  assert.equal(span(m[0][2], m[0][3]).join(','), '10,17')
})

test('otherRe : "T2C l.90" (livre sans chapitre) matche toujours', () => {
  const m = [...'T2C l.90'.matchAll(otherRe())]
  assert.equal(m.length, 1)
  assert.equal(m[0][2], undefined)
  assert.equal(m[0][3], '90')
})

test('otherRe : "AA ch.5 l.12" matche (forme ch. optionnelle)', () => {
  const m = [...'AA ch.5 l.12'.matchAll(otherRe())]
  assert.equal(m.length, 1)
  assert.equal(m[0][2], '5')
  assert.equal(m[0][3], '12')
})

test('otherRe : "AA 5 l.12" (sans ch.) matche toujours comme avant', () => {
  const m = [...'AA 5 l.12'.matchAll(otherRe())]
  assert.equal(m.length, 1)
  assert.equal(m[0][2], '5')
  assert.equal(m[0][3], '12')
})

test('ldbRe / otherRe : instances FRAÎCHES à chaque appel (lastIndex non partagé)', () => {
  const re1 = ldbRe()
  re1.exec('LDB 1 l.1')
  assert.notEqual(re1.lastIndex, 0)
  const re2 = ldbRe()
  assert.equal(re2.lastIndex, 0)
})
