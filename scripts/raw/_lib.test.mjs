// Test des regex de réfs partagées (`ldbRe`/`otherRe`, #434 défaut 3) : la forme `LIVRE ch.NN l.X`
// (écrite en parallèle de `LIVRE NN l.X` dans le code) doit être vue au même titre. Lancé par `npm run test:raw`.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { ldbRe, otherRe, span, bookOf, chapterFile } from './_lib.mjs'

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

test('otherRe : "MDG 12 l.221" matche (#434 défaut 10 : MDG dérivé de BOOKS)', () => {
  const m = [...'MDG 12 l.221'.matchAll(otherRe())]
  assert.equal(m.length, 1)
  assert.equal(m[0][1], 'MDG')
  assert.equal(m[0][2], '12')
  assert.equal(m[0][3], '221')
})

test('otherRe : "MDG ch.12 l.221" matche (forme ch. optionnelle)', () => {
  const m = [...'MDG ch.12 l.221'.matchAll(otherRe())]
  assert.equal(m.length, 1)
  assert.equal(m[0][1], 'MDG')
  assert.equal(m[0][2], '12')
  assert.equal(m[0][3], '221')
})

test('otherRe : "T2C 14 l.5" matche comme T2C, pas comme T2 (tri par longueur décroissante)', () => {
  const m = [...'T2C 14 l.5'.matchAll(otherRe())]
  assert.equal(m.length, 1)
  assert.equal(m[0][1], 'T2C')
})

test('otherRe : "EDOC 5 l.29" matche comme EDOC, pas comme EDO', () => {
  const m = [...'EDOC 5 l.29'.matchAll(otherRe())]
  assert.equal(m.length, 1)
  assert.equal(m[0][1], 'EDOC')
})

test('otherRe : "ADE II 08 l.233" matche toujours (variante tolérante)', () => {
  const m = [...'ADE II 08 l.233'.matchAll(otherRe())]
  assert.equal(m.length, 1)
  assert.equal(m[0][1], 'ADE II')
  assert.equal(m[0][2], '08')
  assert.equal(m[0][3], '233')
})

test('otherRe : "ADE2 ch.8 l.65" matche toujours (chiffre arabe, forme ch.)', () => {
  const m = [...'ADE2 ch.8 l.65'.matchAll(otherRe())]
  assert.equal(m.length, 1)
  assert.equal(m[0][1], 'ADE2')
  assert.equal(m[0][2], '8')
  assert.equal(m[0][3], '65')
})

test('otherRe : "Midd 02 l.10" matche toujours (préfixe tronqué Middenheim)', () => {
  const m = [...'Midd 02 l.10'.matchAll(otherRe())]
  assert.equal(m.length, 1)
  assert.equal(m[0][1], 'Midd')
  assert.equal(m[0][2], '02')
  assert.equal(m[0][3], '10')
})

test('otherRe : "ch.23 l.75" SANS livre ne matche pas', () => {
  const m = [...'La Difficulté (ch.23 l.75)'.matchAll(otherRe())]
  assert.equal(m.length, 0)
})

test('bookOf : "ADE2" canonicalise vers "ADE II" (#434 défaut 11)', () => {
  assert.equal(bookOf('ADE2'), 'ADE II')
})

test('bookOf : "ADE1" canonicalise vers "ADE I"', () => {
  assert.equal(bookOf('ADE1'), 'ADE I')
})

test('bookOf : "ADEII" canonicalise vers "ADE II" (pas ADE I)', () => {
  assert.equal(bookOf('ADEII'), 'ADE II')
})

test('bookOf : "ADEI" canonicalise vers "ADE I"', () => {
  assert.equal(bookOf('ADEI'), 'ADE I')
})

test('bookOf : "NADJ" canonicalise vers "NADAJ"', () => {
  assert.equal(bookOf('NADJ'), 'NADAJ')
})

test('bookOf : "Midd" canonicalise vers "Middenheim"', () => {
  assert.equal(bookOf('Midd'), 'Middenheim')
})

test('bookOf : "MDG" (déjà canonique) résout par identité', () => {
  assert.equal(bookOf('MDG'), 'MDG')
})

test('bookOf : texte inconnu résout à null', () => {
  assert.equal(bookOf('Inconnu'), null)
})

test('chapterFile : résout après canonicalisation de "ADE2"', () => {
  const cf = chapterFile(bookOf('ADE2'), '03')
  assert.notEqual(cf, null)
})

test('chapterFile : résout après canonicalisation de "ADE1"', () => {
  const cf = chapterFile(bookOf('ADE1'), '6')
  assert.notEqual(cf, null)
})

test('chapterFile : résout après canonicalisation de "NADJ"', () => {
  const cf = chapterFile(bookOf('NADJ'), '16')
  assert.notEqual(cf, null)
})

test('ldbRe / otherRe : instances FRAÎCHES à chaque appel (lastIndex non partagé)', () => {
  const re1 = ldbRe()
  re1.exec('LDB 1 l.1')
  assert.notEqual(re1.lastIndex, 0)
  const re2 = ldbRe()
  assert.equal(re2.lastIndex, 0)
})
