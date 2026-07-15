// Test du garde `check-refs` (node --test) : une réf plantée hors borne du chapitre résolu est
// détectée, une réf valide reste silencieuse. Lancé par `npm run test:raw`.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { scanDeadRefs, countsByChapterRef, assertAgainstBaseline } from './check-refs.mjs'

// LDB 06 (Source/Warhammer v4 - Livre de base version corrigée/06 - Classes.md) fait 6 lignes
// (split('\n').length) — chapitre réel, court, stable : sert d'ancrage pour planter une réf hors
// borne sans toucher au vrai docs/raw/.
function withTempRawDir(content, fn) {
  const dir = mkdtempSync(join(tmpdir(), 'check-refs-'))
  writeFileSync(join(dir, 'fixture.md'), content, 'utf8')
  try { fn(dir) } finally { rmSync(dir, { recursive: true, force: true }) }
}

test('réf morte (ligne hors borne du chapitre résolu) → détectée', () => {
  withTempRawDir('Une citation LDB 6 l.999 hors borne.\n', (dir) => {
    const dead = scanDeadRefs(dir, new Set())
    assert.equal(dead.length, 1)
    assert.equal(dead[0].ref, 'LDB 6')
    assert.equal(dead[0].hi, 999)
    assert.ok(dead[0].chapterLines < 999)
  })
})

test('réf valide (ligne dans les bornes du chapitre résolu) → silence', () => {
  withTempRawDir('Une citation LDB 6 l.2 dans les bornes.\n', (dir) => {
    const dead = scanDeadRefs(dir, new Set())
    assert.equal(dead.length, 0)
  })
})

test('livre/chapitre introuvable → hors sujet, jamais compté (Sens A de reconcile.mjs)', () => {
  withTempRawDir('Une citation LDB 9999 l.5 vers un chapitre qui n\'existe pas.\n', (dir) => {
    const dead = scanDeadRefs(dir, new Set())
    assert.equal(dead.length, 0)
  })
})

test('plage l.X-Y : la borne HAUTE est vérifiée', () => {
  withTempRawDir('Plage LDB 6 l.1-999 qui déborde.\n', (dir) => {
    const dead = scanDeadRefs(dir, new Set())
    assert.equal(dead.length, 1)
    assert.equal(dead[0].hi, 999)
  })
})

test('fichier EXCLU (coverage.md/reconciliation.md/reanchor.md) → jamais scanné', () => {
  withTempRawDir('placeholder\n', (dir) => {
    writeFileSync(join(dir, 'coverage.md'), 'LDB 6 l.999 hors borne, mais exclu.\n', 'utf8')
    const dead = scanDeadRefs(dir, new Set(['coverage.md', 'reconciliation.md', 'reanchor.md']))
    assert.equal(dead.length, 0)
  })
})

test('countsByChapterRef + assertAgainstBaseline : hausse détectée, baisse détectée comme périmée', () => {
  const counts = countsByChapterRef([{ ref: 'LDB 6' }, { ref: 'LDB 6' }, { ref: 'AA 1' }])
  assert.deepEqual(counts, { 'LDB 6': 2, 'AA 1': 1 })

  const { over, stale } = assertAgainstBaseline(counts, { 'LDB 6': 1, 'AA 1': 1, 'ZI 1': 5 })
  assert.equal(over.length, 1) // LDB 6 : 2 > baseline 1
  assert.match(over[0], /LDB 6/)
  assert.equal(stale.length, 1) // ZI 1 : baseline 5, réel 0
  assert.match(stale[0], /ZI 1/)
})

test('conforme à la baseline exacte → ni hausse ni péremption', () => {
  const counts = { 'LDB 6': 3 }
  const { over, stale } = assertAgainstBaseline(counts, { 'LDB 6': 3 })
  assert.equal(over.length, 0)
  assert.equal(stale.length, 0)
})
