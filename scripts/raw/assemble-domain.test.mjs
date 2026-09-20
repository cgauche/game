// L'ASSEMBLEUR des fiches de l'Atlas, côté CŒUR (#1825 lots E2, F0).
// Ce qu'il doit tenir : l'en-tête d'une fiche NOMME le cœur de règles REÇU (jamais une édition
// écrite en dur), le cœur ne se devine pas, et la fiche s'ÉCRIT SOUS son cœur — le CHEMIN déclare,
// si bien que deux cœurs portent le même domaine sans qu'aucun run n'écrase la fiche de l'autre.
// Les cœurs RÉELS viennent du registre par leur RÉGIME — aucun cœur nommé dans ce banc.
import test from 'node:test'
import assert from 'node:assert/strict'
import { coeursDuRegistre } from './_lib.mjs'
import { cheminDeFiche, coeurDuRendu, dossierDuCoeur, RAWDIR } from './assemble-domain.mjs'

test('coeurDuRendu : LÈVE en nommant la cause quand l’entrée ne porte pas son cœur', () => {
  assert.throws(() => coeurDuRendu({ domain: 'x' }, {}, 'sortie.json'), /sortie\.json ne porte pas son `coeur`/)
  assert.throws(() => coeurDuRendu({ domain: 'x', coeur: '' }, {}), /ne porte pas son `coeur`/)
})

test('coeurDuRendu : le cœur du domaine l’emporte, sinon celui de la racine du rendu', () => {
  assert.equal(coeurDuRendu({ coeur: 'du-domaine' }, { coeur: 'de-la-racine' }), 'du-domaine')
  assert.equal(coeurDuRendu({}, { coeur: 'de-la-racine' }), 'de-la-racine')
})

test('cheminDeFiche : la fiche s’écrit SOUS son cœur — le chemin PORTE le cœur reçu', () => {
  for (const coeur of coeursDuRegistre()) {
    const chemin = cheminDeFiche(coeur, 'un-domaine').split('\\').join('/')
    assert.equal(chemin, `${RAWDIR}/${coeur}/un-domaine.md`)
    assert.equal(dossierDuCoeur(coeur).split('\\').join('/'), `${RAWDIR}/${coeur}`)
  }
})

test('cheminDeFiche : DEUX cœurs portant le MÊME domaine rendent DEUX chemins — aucun run n’écrase l’autre', () => {
  const coeurs = coeursDuRegistre()
  if (coeurs.length < 2) return // registre à un seul cœur : rien à mesurer
  const chemins = coeurs.map((c) => cheminDeFiche(c, 'un-domaine'))
  assert.equal(new Set(chemins).size, coeurs.length)
})
