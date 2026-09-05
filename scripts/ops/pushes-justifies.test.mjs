// CONTRAT du croisement têtes de push × justificatifs (node --test, sans réseau ni disque).
// Les trois fonctions mesurées sont PURES : l'IO (`gh`, git, le répertoire commun) vit dans `main`.
// Lancé par `npm run test:ops`.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { croiser, rendu, tetesDeGh } from './pushes-justifies.mjs'

const GATES = ['test', 'typecheck', 'lint'].map((nom) => ({ nom, commande: `npm run ${nom}` }))
const vert = { sale: false }

test('une tête dont TOUTES les gates sont vertes est complète', () => {
  const [ligne] = croiser([{ sha: 'a'.repeat(40), sujet: 'feat' }], GATES, {
    ['a'.repeat(40)]: { test: vert, typecheck: vert, lint: vert },
  })
  assert.equal(ligne.verts, 3)
  assert.equal(ligne.total, 3)
  assert.deepEqual(ligne.manquantes, [])
  assert.equal(ligne.complet, true)
})

// La mesure d'ops et le hook doivent rendre le MÊME verdict : le 2026-09-04, 21 des 908 croisements
// divergeaient sur le seul volet `sale` — la mesure créditait au vert ce que le push refusait.
test('une gate prise sur un arbre SALE ne compte pas comme justifiée — même juge qu’au push', () => {
  const [ligne] = croiser([{ sha: 'b' }], GATES, {
    b: { test: vert, typecheck: { sale: true, salis: ['?? src/b.ts'] }, lint: vert },
  })
  assert.equal(ligne.verts, 2)
  assert.deepEqual(ligne.manquantes, ['typecheck'])
  assert.equal(ligne.complet, false)
})

test('une gate ABSENTE et une tête sans aucun justificatif manquent toutes les deux', () => {
  const [absente, inconnue] = croiser([{ sha: 'c' }, { sha: 'd' }], GATES, { c: { test: vert, lint: null } })
  assert.deepEqual(absente.manquantes, ['typecheck', 'lint'])
  assert.equal(inconnue.verts, 0)
  assert.deepEqual(inconnue.manquantes, GATES.map((g) => g.nom))
})

test('deux têtes au MÊME contenu partagent leurs justificatifs (la clé est le contenu, pas le sha)', () => {
  // `main` lit le magasin par les CLÉS de chaque tête : deux têtes de même contenu reçoivent les
  // mêmes vues, et le croisement les rend complètes toutes les deux.
  const vues = { test: vert, typecheck: vert, lint: vert }
  const lignes = croiser([{ sha: 'e' }, { sha: 'f' }], GATES, { e: vues, f: vues })
  assert.deepEqual(lignes.map((l) => l.complet), [true, true])
})

test('le rendu NOMME les gates manquantes, et compte les têtes nues', () => {
  const texte = rendu(croiser([{ sha: '1234567890', sujet: 'sujet du commit' }], GATES, { 1234567890: { test: vert } }))
  assert.match(texte, /123456789 {2}1\/3 {2}sujet du commit/)
  assert.match(texte, /manque : typecheck, lint/)
  assert.match(texte, /1\/1 tête\(s\) de push sans tous leurs justificatifs/)
})

test('le rendu d’un régime qui TIENT le dit, sans lister aucune gate', () => {
  const texte = rendu(
    croiser([{ sha: 'aaaaaaaaaa' }], GATES, { aaaaaaaaaa: { test: vert, typecheck: vert, lint: vert } }),
  )
  assert.match(texte, /1 tête\(s\) de push, toutes à 3\/3/)
  assert.ok(!texte.includes('manque'))
})

test('aucune tête : le vide se DIT', () => {
  assert.match(rendu(croiser([], GATES, {})), /aucune tête de push à juger/)
})

test('les têtes de `gh` sont dédupliquées, et une tête INCONNUE de l’histoire locale est écartée', () => {
  const courses = [
    { headSha: 'aaa' },
    { headSha: 'aaa' },
    { headSha: 'zzz' },
    { headSha: '' },
    { headSha: 'bbb' },
  ]
  assert.deepEqual(tetesDeGh(courses, new Set(['aaa', 'bbb'])), ['aaa', 'bbb'])
})
