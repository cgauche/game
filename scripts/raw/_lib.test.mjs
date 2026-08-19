// Test des regex de réfs partagées (`ldbRe`/`otherRe`, #434 défaut 3) : la forme `LIVRE ch.NN l.X`
// (écrite en parallèle de `LIVRE NN l.X` dans le code) doit être vue au même titre. Lancé par `npm run test:raw`.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { ldbRe, otherRe, span, refNums, isRangeSuffix, bookOf, chapterFile } from './_lib.mjs'

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

// --- Forme COMPACTE `l.A/B/C` (#1318 E3-L4) ---
// Avant extension, la grammaire ne rendait que le PREMIER numéro : une compacte dont le 2e membre
// dépassait les bornes du chapitre passait VERTE à `check-code-refs`, alors que le même numéro cité
// seul échouait. Les numéros suivants étaient INVISIBLES à TOUTES les gardes de réf.
//
// SPÉCIMENS CONSTRUITS, jamais écrits en graphie canonique (patron `fixtureRef` de
// `src/raw-ref-integrity.test.ts`) : ce fichier est lui-même scanné par les gardes de réf du dépôt,
// qui ne distinguent pas une citation vivante d'un spécimen de test — une fixture littérale
// s'y lirait comme une vraie réf morte.
/** Réf de FIXTURE : `spec(18, '298/315/369')` → « <pivot> 18 l.298/315/369 ». */
const spec = (ch, tail) => ['LDB', String(ch), `l.${tail}`].join(' ')
/** Tous les numéros de ligne rendus par la grammaire pour une chaîne (miroir du parcours des gardes). */
const nums = (s) => [...s.matchAll(ldbRe())].flatMap((m) => refNums(m[2], m[3]))

test('ldbRe : forme COMPACTE à trois numéros — les TROIS sont rendus', () => {
  assert.deepEqual(nums(spec(18, '298/315/369')), [298, 315, 369])
})

test('ldbRe : forme COMPACTE à deux numéros', () => {
  assert.deepEqual(nums(spec(18, '202/213')), [202, 213])
})

test('ldbRe : la borne HAUTE d’une compacte est celle que borne check-code-refs', () => {
  const m = [...spec(18, '222/999').matchAll(ldbRe())]
  assert.equal(m.length, 1)
  assert.equal(span(m[0][2], m[0][3]).join(','), '222,999')
})

test('ldbRe : réf MULTI-CHAPITRES — le nombre après `/` suivi de ` l.` est un CHAPITRE, jamais une ligne', () => {
  assert.deepEqual(nums(`${spec(18, '298')}/20 l.72/20 l.32-49`), [298])
})

test('isRangeSuffix : seule `-fin` est un intervalle ; `+pts` et `/compacte` sont des ancres distinctes', () => {
  assert.equal(isRangeSuffix('-25'), true)
  assert.equal(isRangeSuffix('+17'), false)
  assert.equal(isRangeSuffix('/213'), false)
  assert.equal(isRangeSuffix(''), false)
})

// ANGLES MORTS ASSERTÉS (mesurés, pas supposés) — patron de `src/raw-ref-integrity.test.ts` :
//  a) une réf MULTI-CHAPITRES ne rend QUE son premier chapitre (les membres suivants n'ont pas de
//     sigle de livre, la grammaire les ignore) ;
//  b) une réf ENROULÉE (coupée par un retour à la ligne au milieu de la réf) est invisible : tous
//     les scanners lisent LIGNE À LIGNE. Le site rencontré en E3-L4 a été corrigé à la main.
test('ANGLES MORTS : multi-chapitres partiel, et réf ENROULÉE sur deux lignes — non vus, dit ici', () => {
  assert.deepEqual([...`${spec(18, '5')}/20 l.14`.matchAll(ldbRe())].map((m) => m[1]), ['18']) // le `20` non rendu
  assert.equal([...`LDB 09 /\n * 18 ${'l.'}382`.matchAll(ldbRe())].length, 0) // enroulée : rien
})

test('otherRe : "MSRC l.90" (livre sans chapitre) matche toujours', () => {
  const m = [...'MSRC l.90'.matchAll(otherRe())]
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

test('otherRe : "MSRC 14 l.5" matche comme MSRC, pas comme MSR (tri par longueur décroissante)', () => {
  const m = [...'MSRC 14 l.5'.matchAll(otherRe())]
  assert.equal(m.length, 1)
  assert.equal(m[0][1], 'MSRC')
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

test('otherRe : "ADE2 ch.8 l.65" ne matche PAS (ancienne graphie, plus tolérée, #585 lot B)', () => {
  const m = [...'ADE2 ch.8 l.65'.matchAll(otherRe())]
  assert.equal(m.length, 0)
})

test('otherRe : "Midd 02 l.10" ne matche PAS (ancien préfixe tronqué Middenheim, plus tolérée)', () => {
  const m = [...'Midd 02 l.10'.matchAll(otherRe())]
  assert.equal(m.length, 0)
})

test('otherRe : "ch.23 l.75" SANS livre ne matche pas', () => {
  const m = [...'La Difficulté (ch.23 l.75)'.matchAll(otherRe())]
  assert.equal(m.length, 0)
})

test('bookOf : "ADE2" (ancienne variante) résout à null (identité stricte, #585 lot B)', () => {
  assert.equal(bookOf('ADE2'), null)
})

test('bookOf : "ADE1" (ancienne variante) résout à null', () => {
  assert.equal(bookOf('ADE1'), null)
})

test('bookOf : "ADEII" (ancienne variante) résout à null', () => {
  assert.equal(bookOf('ADEII'), null)
})

test('bookOf : "ADEI" (ancienne variante) résout à null', () => {
  assert.equal(bookOf('ADEI'), null)
})

test('bookOf : "NADAJ" (ancienne graphie, le canon est désormais "NADJ") résout à null', () => {
  assert.equal(bookOf('NADAJ'), null)
})

test('bookOf : "Midd" (ancienne graphie, le canon est désormais "MCLB") résout à null', () => {
  assert.equal(bookOf('Midd'), null)
})

test('bookOf : "ADE II" (déjà canonique) résout par identité', () => {
  assert.equal(bookOf('ADE II'), 'ADE II')
})

test('bookOf : "MSRC" (déjà canonique) résout par identité', () => {
  assert.equal(bookOf('MSRC'), 'MSRC')
})

test('bookOf : "NADJ" (déjà canonique) résout par identité', () => {
  assert.equal(bookOf('NADJ'), 'NADJ')
})

test('bookOf : "MDG" (déjà canonique) résout par identité', () => {
  assert.equal(bookOf('MDG'), 'MDG')
})

test('bookOf : texte inconnu résout à null', () => {
  assert.equal(bookOf('Inconnu'), null)
})

test('chapterFile : résout avec la graphie canonique "ADE II"', () => {
  const cf = chapterFile(bookOf('ADE II'), '08')
  assert.notEqual(cf, null)
})

test('chapterFile : résout avec la graphie canonique "ADE I"', () => {
  const cf = chapterFile(bookOf('ADE I'), '6')
  assert.notEqual(cf, null)
})

test('chapterFile : résout avec la graphie canonique "NADJ"', () => {
  const cf = chapterFile(bookOf('NADJ'), '16')
  assert.notEqual(cf, null)
})

test('chapterFile : une ANCIENNE variante (bookOf → null) résout à null', () => {
  const cf = chapterFile(bookOf('ADE2'), '03')
  assert.equal(cf, null)
})

test('ldbRe / otherRe : instances FRAÎCHES à chaque appel (lastIndex non partagé)', () => {
  const re1 = ldbRe()
  re1.exec('LDB 1 l.1')
  assert.notEqual(re1.lastIndex, 0)
  const re2 = ldbRe()
  assert.equal(re2.lastIndex, 0)
})
