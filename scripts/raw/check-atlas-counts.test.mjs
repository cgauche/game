// Test de la garde `check-atlas-counts` (node --test) : détecte un nombre de livres ou un compte
// d'état recopiés en dur, reste silencieuse sur le seuil invariant, et couvre les deux vraies
// pages de garde de l'Atlas (00-index.md + sources.md). Lancé par `npm run test:raw`.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { scanForbiddenCounts, INDEX_PATH, SOURCES_PATH, SCANNED_PATHS } from './check-atlas-counts.mjs'

test('scanForbiddenCounts : "N livres" recopié en dur → détecté', () => {
  const v = scanForbiddenCounts('depuis les 15 livres autorisés\n')
  assert.equal(v.length, 1)
  assert.equal(v[0].line, 1)
  assert.equal(v[0].excerpt, '15 livres')
})

test('scanForbiddenCounts : compte d\'état "✅ 150" recopié en dur → détecté', () => {
  const v = scanForbiddenCounts('état courant : ✅ 150 · 🟡 4 · ⬜ 0\n')
  assert.equal(v.length, 3)
  assert.deepEqual(v.map((x) => x.excerpt), ['✅ 150', '🟡 4', '⬜ 0'])
})

test('scanForbiddenCounts : seuil invariant "⬜ = 0" → silencieux (pas un compte courant)', () => {
  assert.deepEqual(scanForbiddenCounts('**Seuil : ⬜ = 0.**\n'), [])
})

test('scanForbiddenCounts : renvoi sans chiffre vers la table de sources.md → silencieux', () => {
  assert.deepEqual(scanForbiddenCounts('depuis les livres autorisés (voir sources.md)\n'), [])
})

test('scanForbiddenCounts : numéro de chapitre isolé (pas de pastille d\'état ni "livres") → silencieux', () => {
  assert.deepEqual(scanForbiddenCounts('Traumatisme & Blessures critiques | traumatisme.md | ⏳ | 18\n'), [])
})

test('scanForbiddenCounts : ligne + extrait corrects pour une violation en milieu de fichier', () => {
  const text = 'ligne 1\nligne 2\ndepuis les 15 livres\nligne 4\n'
  const v = scanForbiddenCounts(text)
  assert.equal(v.length, 1)
  assert.equal(v[0].line, 3)
})

test('scanForbiddenCounts : "## Les 15 livres" (titre de section, patron sources.md) → détecté', () => {
  const v = scanForbiddenCounts('## Les 15 livres\n')
  assert.equal(v.length, 1)
  assert.equal(v[0].excerpt, '15 livres')
})

test('SCANNED_PATHS couvre les deux pages de garde (00-index.md + sources.md)', () => {
  assert.deepEqual(SCANNED_PATHS, [INDEX_PATH, SOURCES_PATH])
})

test('docs/raw/00-index.md réel — aucun compte manuscrit interdit (non-régression #544)', () => {
  const text = readFileSync(INDEX_PATH, 'utf8')
  assert.deepEqual(scanForbiddenCounts(text), [])
})

test('docs/raw/sources.md réel — aucun compte manuscrit interdit (non-régression #544)', () => {
  const text = readFileSync(SOURCES_PATH, 'utf8')
  assert.deepEqual(scanForbiddenCounts(text), [])
})
