// Test du ré-ancrage `AA/ZI 01 l.X` → fichiers-chapitres actuels (node --test).
// Fixtures en mémoire (pas de git/fs) : `key()` normalise les lignes brutes comme le fait le
// balayage réel (`scanAndApply`), les tests n'exercent que les fonctions pures de résolution.
// Lancé par `npm run test:raw`.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { key, resolveBound, reanchorRef, explainFailure } from './reanchor-split.mjs'

const idx = (raw) => raw.map(key)

test('réf simple : une ligne unique se retrouve dans un chapitre', () => {
  const origKeys = idx(['', 'La phrase citée est ici.', ''])
  const bookIndex = { '02': idx(['', 'Autre chose.', 'La phrase citée est ici.', '']) }
  assert.deepEqual(resolveBound(origKeys, 2, bookIndex), ['02', 3])
})

test('plage l.X-Y : chaque borne est ré-ancrée', () => {
  const origKeys = idx(['', 'Début du passage.', 'Milieu.', 'Fin du passage.', ''])
  const bookIndex = { '03': idx(['', 'bruit', 'Début du passage.', 'Milieu.', 'Fin du passage.', 'suite']) }
  const r = reanchorRef(origKeys, '2', '-4', bookIndex)
  assert.deepEqual(r, { nn: '03', newStart: 3, newSuffix: '-5' })
})

test('plage l.X+A+B : chaque point additionnel est ré-ancré indépendamment', () => {
  const origKeys = idx(['', 'Premier point.', 'x', 'Second point.', 'y', 'Troisième point.'])
  const bookIndex = { '04': idx(['pad', 'pad', 'Premier point.', 'pad', 'Second point.', 'pad', 'Troisième point.']) }
  const r = reanchorRef(origKeys, '2', '+4+6', bookIndex)
  assert.deepEqual(r, { nn: '04', newStart: 3, newSuffix: '+5+7' })
})

test('texte ambigu jamais levé par le contexte → non résolu', () => {
  // « Ligne dupliquée » apparaît deux fois avec un contexte identique de chaque côté : aucune
  // fenêtre ne permet de trancher — la borne reste NON réécrite.
  const origKeys = idx(['avant', 'Ligne dupliquée', 'après'])
  const bookIndex = {
    '05': idx(['avant', 'Ligne dupliquée', 'après']),
    '06': idx(['avant', 'Ligne dupliquée', 'après']),
  }
  assert.equal(resolveBound(origKeys, 2, bookIndex), null)
  assert.match(explainFailure(origKeys, '2', '', bookIndex), /ambigu/)
})

test('texte introuvable dans les chapitres actuels → non résolu', () => {
  const origKeys = idx(['', 'Texte disparu de la ré-extraction.', ''])
  const bookIndex = { '07': idx(['', 'Rien à voir.', '']) }
  assert.equal(resolveBound(origKeys, 2, bookIndex), null)
  assert.match(explainFailure(origKeys, '2', '', bookIndex), /introuvable/)
})

test('borne vide ancrée via son voisin non-vide (même offset, candidat lui aussi vide)', () => {
  const origKeys = idx(['', 'Contenu de référence.', '', ''])
  const bookIndex = { '08': idx(['pad', 'pad', 'Contenu de référence.', '', ''] ) }
  // ligne 3 = vide dans l'origine ; son voisin non-vide (l.2) se retrouve en position 3 (0-based 2)
  // → la borne vide translate le même offset (+1) → position 4.
  assert.deepEqual(resolveBound(origKeys, 3, bookIndex), ['08', 4])
})

test('borne vide sans voisin exploitable → non résolue', () => {
  const origKeys = idx(['', ''])
  const bookIndex = { '09': idx(['', '']) }
  assert.equal(resolveBound(origKeys, 1, bookIndex), null)
})

test('bornes résolues vers des chapitres DIFFÉRENTS → réf entière rejetée', () => {
  const origKeys = idx(['Début unique ici.', 'x', 'Fin unique ailleurs.'])
  const bookIndex = {
    '10': idx(['Début unique ici.', 'pad']),
    '11': idx(['pad', 'Fin unique ailleurs.']),
  }
  const r = reanchorRef(origKeys, '1', '-3', bookIndex)
  assert.equal(r, null)
  assert.match(explainFailure(origKeys, '1', '-3', bookIndex), /chapitres différents/)
})
