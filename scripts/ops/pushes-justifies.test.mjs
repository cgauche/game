// CONTRAT du croisement têtes de push × justificatifs (node --test, sans réseau ni disque).
// Les trois fonctions mesurées sont PURES : l'IO (`gh`, git, le répertoire commun) vit dans `main`.
// Lancé par `npm run test:ops`.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { croiser, rendu, tetesDeGh } from './pushes-justifies.mjs'

const GATES = ['test', 'typecheck', 'lint']
const vert = { statut: 'vert' }

test('une tête dont TOUTES les gates sont vertes est complète', () => {
  const [ligne] = croiser(
    [{ sha: 'a'.repeat(40), cleTree: 'k1', sujet: 'feat' }],
    GATES,
    { k1: { test: vert, typecheck: vert, lint: vert } },
  )
  assert.equal(ligne.verts, 3)
  assert.equal(ligne.total, 3)
  assert.deepEqual(ligne.manquantes, [])
  assert.equal(ligne.complet, true)
})

test('une gate ROUGE ne compte pas comme justifiée — seul `vert` justifie', () => {
  const [ligne] = croiser([{ sha: 'b', cleTree: 'k1' }], GATES, {
    k1: { test: vert, typecheck: { statut: 'rouge' }, lint: vert },
  })
  assert.equal(ligne.verts, 2)
  assert.deepEqual(ligne.manquantes, ['typecheck'])
  assert.equal(ligne.complet, false)
})

test('une gate ABSENTE et une clé de contenu inconnue manquent toutes les deux', () => {
  const [absente, inconnue] = croiser(
    [{ sha: 'c', cleTree: 'k1' }, { sha: 'd', cleTree: 'k-jamais-vue' }],
    GATES,
    { k1: { test: vert, lint: null } },
  )
  assert.deepEqual(absente.manquantes, ['typecheck', 'lint'])
  assert.equal(inconnue.verts, 0)
  assert.deepEqual(inconnue.manquantes, GATES)
})

test('deux têtes au MÊME contenu partagent leurs justificatifs (la clé est le contenu, pas le sha)', () => {
  const lignes = croiser([{ sha: 'e', cleTree: 'k' }, { sha: 'f', cleTree: 'k' }], GATES, {
    k: { test: vert, typecheck: vert, lint: vert },
  })
  assert.deepEqual(lignes.map((l) => l.complet), [true, true])
})

test('le rendu NOMME les gates manquantes, et compte les têtes nues', () => {
  const texte = rendu(
    croiser([{ sha: '1234567890', cleTree: 'k', sujet: 'sujet du commit' }], GATES, { k: { test: vert } }),
  )
  assert.match(texte, /123456789 {2}1\/3 {2}sujet du commit/)
  assert.match(texte, /manque : typecheck, lint/)
  assert.match(texte, /1\/1 tête\(s\) de push sans tous leurs justificatifs/)
})

test('le rendu d’un régime qui TIENT le dit, sans lister aucune gate', () => {
  const texte = rendu(croiser([{ sha: 'aaaaaaaaaa', cleTree: 'k' }], GATES, {
    k: { test: vert, typecheck: vert, lint: vert },
  }))
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
