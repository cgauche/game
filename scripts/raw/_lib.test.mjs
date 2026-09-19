// Test de la graphie de réf partagée (`refRe`, #434 défaut 3, #1825 lot A) : UNE fabrique couvre
// TOUS les livres de BOOKS, les livres de cœur compris, avec les MÊMES groupes — m[1] livre · m[2] chapitre
// (optionnel) · m[3] ligne · m[4] suffixe. La forme `LIVRE ch.NN l.X` (écrite en parallèle de
// `LIVRE NN l.X` dans le code) est vue au même titre. Lancé par `npm run test:raw`.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { refRe, refFolioRe, allAbbrAlternation, span, refNums, isRangeSuffix, bookOf, chapterFile, BOOKS, booksDe, coeursDe, coeurDe, livresDeCoeur, sigleDeCoeur } from './_lib.mjs'
import booksData from '../../src/data/books.json' with { type: 'json' }

// Un sigle RÉEL, pris au registre par son RÉGIME (livre de cœur) — jamais recopié : le test dit le
// contrat de graphie, pas l'identité d'un livre. Résolveur PARTAGÉ avec les autres bancs
// (`sigleDeCoeur`, _lib.mjs) : il nomme sa cause quand le registre ne porte aucun cœur.
const SIGLE_COEUR = sigleDeCoeur()

// #1825 lot B : `books.json` possède l'ORDRE des livres (= l'ordre du fichier, celui que le
// Compendium affiche), `_lib.mjs` n'en tient aucune liste. Le contrat se juge sur une FIXTURE —
// le FILTRE (`dir`) et l'ORDRE du registre, sans recopier le registre réel ni aucun cardinal.
// Sigles volontairement en ordre DÉCROISSANT : un tri glissé dans `booksDe` les remettrait dans
// l'autre sens, et ce test le verrait.
const REGISTRE = [
  { id: 'c', abbr: 'C', dir: 'Source/C' },
  { id: 'b', abbr: 'B' },
  { id: 'a', abbr: 'A', dir: 'Source/A' },
]

test('booksDe : seules les entrées à `dir` entrent, dans l’ORDRE DU REGISTRE (jamais retrié)', () => {
  assert.deepEqual(booksDe(REGISTRE), [['C', 'Source/C'], ['A', 'Source/A']])
})

test('booksDe : un `dir` vide ou null écarte l’entrée, comme un `dir` absent', () => {
  assert.deepEqual(booksDe([{ id: 'v', abbr: 'V', dir: '' }, { id: 'n', abbr: 'N', dir: null }]), [])
})

test('BOOKS : le registre RÉEL passé par `booksDe` — aucune liste de livres dans le script', () => {
  assert.deepEqual(BOOKS, booksDe(booksData))
  assert.ok(BOOKS.every(([abbr, dir]) => abbr && dir), 'une entrée de BOOKS sans sigle ni dossier')
})

// #1825 lot C : le CŒUR d'un livre est une donnée du registre, lue par `abbr`.
const REGISTRE_COEURS = [
  { id: 'c', abbr: 'C', dir: 'Source/C', coeur: '4e' },
  { id: 'd', abbr: 'D', dir: 'Source/D', coeur: '5e' },
  { id: 's', abbr: 'S', dir: 'Source/S' },
]

test('coeursDe : le registre rend un cœur PAR SIGLE ; une entrée sans `coeur` n’y est pas', () => {
  assert.deepEqual([...coeursDe(REGISTRE_COEURS)], [['C', '4e'], ['D', '5e']])
})

test('coeurDe : la valeur du cœur, ou `null` pour un supplément comme pour un sigle inconnu', () => {
  const coeurs = coeursDe(REGISTRE_COEURS)
  assert.equal(coeurDe('C', coeurs), '4e')
  assert.equal(coeurDe('D', coeurs), '5e')
  assert.equal(coeurDe('S', coeurs), null)
  assert.equal(coeurDe('INCONNU', coeurs), null)
})

test('coeurDe : le registre RÉEL déclare au moins un livre de cœur, et le sigle vient de lui', () => {
  assert.ok(SIGLE_COEUR, 'aucun livre de `books.json` ne porte de `coeur`')
  assert.equal(coeurDe(SIGLE_COEUR), coeursDe(booksData).get(SIGLE_COEUR))
})

test('livresDeCoeur : les livres à `coeur`, dans l’ORDRE DU REGISTRE (jamais retriés)', () => {
  const inverse = [...REGISTRE_COEURS].reverse()
  assert.deepEqual(livresDeCoeur(booksDe(inverse), coeursDe(inverse)), [['D', 'Source/D'], ['C', 'Source/C']])
})

test('sigleDeCoeur : un registre SANS cœur LÈVE en nommant sa cause, jamais « undefined is not iterable »', () => {
  const sansCoeur = [{ id: 's', abbr: 'S', dir: 'Source/S' }]
  assert.throws(
    () => sigleDeCoeur(booksDe(sansCoeur), coeursDe(sansCoeur)),
    /books\.json` ne porte aucun livre de cœur \(champ `coeur`\)/,
  )
  assert.equal(sigleDeCoeur(booksDe(REGISTRE_COEURS), coeursDe(REGISTRE_COEURS)), 'C')
})

test('refRe : "LDB 17 l.25" matche', () => {
  const m = [...'LDB 17 l.25'.matchAll(refRe())]
  assert.equal(m.length, 1)
  assert.equal(m[0][1], 'LDB')
  assert.equal(m[0][2], '17')
  assert.equal(m[0][3], '25')
})

test('refRe : "LDB ch.17 l.25" matche (forme ch. optionnelle)', () => {
  const m = [...'LDB ch.17 l.25'.matchAll(refRe())]
  assert.equal(m.length, 1)
  assert.equal(m[0][2], '17')
  assert.equal(m[0][3], '25')
})

test('refRe : "ch.23 l.75" SANS livre ne matche pas (le groupe livre reste obligatoire)', () => {
  const m = [...'La Difficulté de l\'Artisanat (ch.23 l.75-103)'.matchAll(refRe())]
  assert.equal(m.length, 0)
})

test('refRe : suffixe plage "l.10-25" préservé avec la forme ch.', () => {
  const m = [...'LDB ch.10 l.10-25'.matchAll(refRe())]
  assert.equal(m.length, 1)
  assert.equal(span(m[0][3], m[0][4]).join(','), '10,25')
})

test('refRe : suffixe points "l.10+17" préservé avec la forme ch.', () => {
  const m = [...'LDB ch.10 l.10+17'.matchAll(refRe())]
  assert.equal(m.length, 1)
  assert.equal(span(m[0][3], m[0][4]).join(','), '10,17')
})

// --- UNE graphie : un livre de cœur n'a pas de grammaire propre (#1825 lot A) ---
test('refRe : un livre de CŒUR et un AUTRE livre rendent les MÊMES groupes', () => {
  const [p] = [...`${SIGLE_COEUR} 17 l.25-30`.matchAll(refRe())]
  const [o] = [...'MDG 17 l.25-30'.matchAll(refRe())]
  assert.deepEqual([p[1], p[2], p[3], p[4]], [SIGLE_COEUR, '17', '25', '-30'])
  assert.deepEqual([o[1], o[2], o[3], o[4]], ['MDG', '17', '25', '-30'])
})

test('refRe : le CHAPITRE est optionnel pour TOUS les livres, livres de cœur compris', () => {
  const [p] = [...`${SIGLE_COEUR} l.168`.matchAll(refRe())]
  const [o] = [...'MSRC l.90'.matchAll(refRe())]
  assert.equal(p[2], undefined)
  assert.equal(p[3], '168')
  assert.equal(o[2], undefined)
  assert.equal(o[3], '90')
})

test('allAbbrAlternation : TOUS les livres de BOOKS, les livres de cœur compris — aucun exclu', () => {
  const toutes = allAbbrAlternation().split('|')
  assert.equal(toutes.length, BOOKS.length)
  assert.ok(toutes.includes(SIGLE_COEUR))
  assert.deepEqual([...toutes].sort(), BOOKS.map(([a]) => a).sort())
})

test('allAbbrAlternation : tri par longueur DÉCROISSANTE (MSRC avant MSR, EDOC avant EDO)', () => {
  const alt = allAbbrAlternation().split('|')
  assert.ok(alt.indexOf('MSRC') < alt.indexOf('MSR'))
  assert.ok(alt.indexOf('EDOC') < alt.indexOf('EDO'))
})

test('refFolioRe : miroir FOLIO, mêmes groupes, livres de cœur compris', () => {
  const [p] = [...`${SIGLE_COEUR} 48 p.255-256`.matchAll(refFolioRe())]
  const [o] = [...'ADE II 08 p.233'.matchAll(refFolioRe())]
  assert.deepEqual([p[1], p[2], p[3], p[4]], [SIGLE_COEUR, '48', '255', '-256'])
  assert.deepEqual([o[1], o[2], o[3], o[4]], ['ADE II', '08', '233', ''])
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
/** Réf de FIXTURE : `spec(18, '298/315/369')` → « <sigle de cœur> 18 l.298/315/369 ». */
const spec = (ch, tail) => [SIGLE_COEUR, String(ch), `l.${tail}`].join(' ')
/** Tous les numéros de ligne rendus par la grammaire pour une chaîne (miroir du parcours des gardes). */
const nums = (s) => [...s.matchAll(refRe())].flatMap((m) => refNums(m[3], m[4]))

test('refRe : forme COMPACTE à trois numéros — les TROIS sont rendus', () => {
  assert.deepEqual(nums(spec(18, '298/315/369')), [298, 315, 369])
})

test('refRe : forme COMPACTE à deux numéros', () => {
  assert.deepEqual(nums(spec(18, '202/213')), [202, 213])
})

test('refRe : forme COMPACTE sans chapitre (`l.298/315`) — un livre de cœur la rend comme les autres', () => {
  assert.deepEqual(nums(`${SIGLE_COEUR} l.298/315`), [298, 315])
})

test('refRe : la borne HAUTE d’une compacte est celle que borne check-code-refs', () => {
  const m = [...spec(18, '222/999').matchAll(refRe())]
  assert.equal(m.length, 1)
  assert.equal(span(m[0][3], m[0][4]).join(','), '222,999')
})

test('refRe : réf MULTI-CHAPITRES — le nombre après `/` suivi de ` l.` est un CHAPITRE, jamais une ligne', () => {
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
  assert.deepEqual([...`${spec(18, '5')}/20 l.14`.matchAll(refRe())].map((m) => m[2]), ['18']) // le `20` non rendu
  assert.equal([...`LDB 09 /\n * 18 ${'l.'}382`.matchAll(refRe())].length, 0) // enroulée : rien
})

test('refRe : "AA ch.5 l.12" matche (forme ch. optionnelle)', () => {
  const m = [...'AA ch.5 l.12'.matchAll(refRe())]
  assert.equal(m.length, 1)
  assert.equal(m[0][2], '5')
  assert.equal(m[0][3], '12')
})

test('refRe : "AA 5 l.12" (sans ch.) matche toujours comme avant', () => {
  const m = [...'AA 5 l.12'.matchAll(refRe())]
  assert.equal(m.length, 1)
  assert.equal(m[0][2], '5')
  assert.equal(m[0][3], '12')
})

test('refRe : "MDG 12 l.221" matche (#434 défaut 10 : MDG dérivé de BOOKS)', () => {
  const m = [...'MDG 12 l.221'.matchAll(refRe())]
  assert.equal(m.length, 1)
  assert.equal(m[0][1], 'MDG')
  assert.equal(m[0][2], '12')
  assert.equal(m[0][3], '221')
})

test('refRe : "MDG ch.12 l.221" matche (forme ch. optionnelle)', () => {
  const m = [...'MDG ch.12 l.221'.matchAll(refRe())]
  assert.equal(m.length, 1)
  assert.equal(m[0][1], 'MDG')
  assert.equal(m[0][2], '12')
  assert.equal(m[0][3], '221')
})

test('refRe : "MSRC 14 l.5" matche comme MSRC, pas comme MSR (tri par longueur décroissante)', () => {
  const m = [...'MSRC 14 l.5'.matchAll(refRe())]
  assert.equal(m.length, 1)
  assert.equal(m[0][1], 'MSRC')
})

test('refRe : "EDOC 5 l.29" matche comme EDOC, pas comme EDO', () => {
  const m = [...'EDOC 5 l.29'.matchAll(refRe())]
  assert.equal(m.length, 1)
  assert.equal(m[0][1], 'EDOC')
})

test('refRe : "ADE II 08 l.233" matche toujours (abréviation à espace)', () => {
  const m = [...'ADE II 08 l.233'.matchAll(refRe())]
  assert.equal(m.length, 1)
  assert.equal(m[0][1], 'ADE II')
  assert.equal(m[0][2], '08')
  assert.equal(m[0][3], '233')
})

test('refRe : "ADE2 ch.8 l.65" ne matche PAS (ancienne graphie, plus tolérée, #585 lot B)', () => {
  const m = [...'ADE2 ch.8 l.65'.matchAll(refRe())]
  assert.equal(m.length, 0)
})

test('refRe : "Midd 02 l.10" ne matche PAS (ancien préfixe tronqué Middenheim, plus tolérée)', () => {
  const m = [...'Midd 02 l.10'.matchAll(refRe())]
  assert.equal(m.length, 0)
})

test('refRe : "ch.23 l.75" SANS livre ne matche pas (second spécimen, sans sigle alentour)', () => {
  const m = [...'La Difficulté (ch.23 l.75)'.matchAll(refRe())]
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

test('refRe : instances FRAÎCHES à chaque appel (lastIndex non partagé)', () => {
  const re1 = refRe()
  re1.exec('LDB 1 l.1')
  assert.notEqual(re1.lastIndex, 0)
  const re2 = refRe()
  assert.equal(re2.lastIndex, 0)
})
