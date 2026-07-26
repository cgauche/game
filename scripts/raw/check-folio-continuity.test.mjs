// Test de la garde `check-folio-continuity` (node --test) : une séquence data-folio non
// consécutive est détectée, une séquence consécutive reste silencieuse, et un folio attendu APRÈS
// la dernière ancre du fichier ne passe plus entre les mailles (#833). Lancé par `npm run test:raw`.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { folioGapsInText, chapterFolioSpan, scanBookDir, scanAllBooks } from './check-folio-continuity.mjs'

function span(folio) { return `<span id="page-x-0" data-folio="${folio}"></span>` }

function withTempBookDir(files, fn) {
  const dir = mkdtempSync(join(tmpdir(), 'folio-continuity-'))
  try {
    for (const [name, content] of Object.entries(files)) writeFileSync(join(dir, name), content, 'utf8')
    fn(dir)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

test('folioGapsInText : séquence consécutive → aucun saut', () => {
  const text = `a ${span(10)} b\nc ${span(11)} d\ne ${span(12)} f\n`
  assert.deepEqual(folioGapsInText(text), [])
})

test('folioGapsInText : saut (page manquante) → détecté', () => {
  const text = `a ${span(10)} b\nc ${span(13)} d\n`
  const gaps = folioGapsInText(text)
  assert.equal(gaps.length, 1)
  assert.deepEqual(gaps[0], { from: 10, to: 13, delta: 3 })
})

test('folioGapsInText : plusieurs sauts dans le même fichier → tous détectés', () => {
  const text = `${span(1)} ${span(2)} ${span(5)} ${span(6)} ${span(9)}`
  const gaps = folioGapsInText(text)
  assert.equal(gaps.length, 2)
  assert.deepEqual(gaps[0], { from: 2, to: 5, delta: 3 })
  assert.deepEqual(gaps[1], { from: 6, to: 9, delta: 3 })
})

test('folioGapsInText : aucune ancre → aucun saut (hors sujet)', () => {
  assert.deepEqual(folioGapsInText('rien ici.\n'), [])
})

test('scanBookDir : ne scanne que les fichiers chapitre `NN - *.md`, ignore le reste', () => {
  withTempBookDir({
    '01 - Chapitre.md': `${span(1)} ${span(4)}`,
    'notes.md': `${span(1)} ${span(99)}`, // pas un fichier chapitre → ignoré
  }, (dir) => {
    const gaps = scanBookDir('TEST', dir)
    assert.equal(gaps.length, 1)
    assert.equal(gaps[0].file, '01 - Chapitre.md')
    assert.equal(gaps[0].ref, 'TEST 1')
    assert.equal(gaps[0].abbr, 'TEST')
    assert.equal(gaps[0].nn, 1)
  })
})

test('scanBookDir : dossier introuvable → aucun saut (hors sujet)', () => {
  assert.deepEqual(scanBookDir('TEST', join(tmpdir(), 'dossier-inexistant-xyz')), [])
})

test('scanAllBooks : agrège plusieurs livres', () => {
  const parent = mkdtempSync(join(tmpdir(), 'folio-continuity-books-'))
  const dirA = join(parent, 'A'); mkdirSync(dirA)
  const dirB = join(parent, 'B'); mkdirSync(dirB)
  try {
    writeFileSync(join(dirA, '01 - X.md'), `${span(1)} ${span(3)}`, 'utf8')
    writeFileSync(join(dirB, '02 - Y.md'), `${span(1)} ${span(2)}`, 'utf8')
    const gaps = scanAllBooks([['A', dirA], ['B', dirB]])
    assert.equal(gaps.length, 1)
    assert.equal(gaps[0].ref, 'A 1')
  } finally {
    rmSync(parent, { recursive: true, force: true })
  }
})

// ---------- volet FIN de fichier (#833) ----------

function chapter(pdfLo, pdfHi, folios, offset = 1) {
  const body = folios.map((f) => `<span id="page-${f + offset}-0" data-folio="${f}"></span>prose du folio ${f}`).join('\n')
  return `*Pages PDF ${pdfLo}-${pdfHi}*\n\n${body}\n`
}

test('chapterFolioSpan : plage attendue (en-tête + offset lu sur les ancres) et dernier folio ancré', () => {
  assert.deepEqual(chapterFolioSpan(chapter(25, 36, [23, 24, 25])), { expectedHi: 34, last: 25 })
})

test('chapterFolioSpan : sans en-tête, sans ancre, ou offset non unique → null', () => {
  assert.equal(chapterFolioSpan('pas d’en-tête\n'), null)
  assert.equal(chapterFolioSpan('*Pages PDF 25-36*\n\nprose sans ancre\n'), null)
  const bancal = '*Pages PDF 25-36*\n\n<span id="page-24-0" data-folio="23"></span>a\n<span id="page-30-0" data-folio="25"></span>b\n'
  assert.equal(chapterFolioSpan(bancal), null)
})

test('scanBookDir : folio attendu APRÈS la dernière ancre et ancré nulle part → trou rapporté', () => {
  withTempBookDir({ '15 - Fin.md': chapter(217, 228, [215, 216, 217]) }, (dir) => {
    const gaps = scanBookDir('TEST', dir).filter((g) => g.kind === 'fin')
    assert.equal(gaps.length, 1)
    assert.deepEqual([gaps[0].from, gaps[0].to, gaps[0].delta], [217, 226, 9])
    assert.equal(gaps[0].ref, 'TEST 15')
  })
})

test('scanBookDir : folio de fin ancré dans le chapitre SUIVANT (page partagée) → aucun trou', () => {
  withTempBookDir({
    '01 - A.md': chapter(10, 13, [8, 9, 10]),        // attend 8..11, s'arrête à 10
    '02 - B.md': chapter(13, 16, [11, 12, 13, 14]),  // le folio 11 vit ici
  }, (dir) => {
    assert.deepEqual(scanBookDir('TEST', dir).filter((g) => g.kind === 'fin'), [])
  })
})

test('scanBookDir : la séquence SEULE est aveugle en fin de fichier — le second volet la couvre', () => {
  withTempBookDir({ '15 - Fin.md': chapter(217, 228, [215, 216, 217]) }, (dir) => {
    const text = chapter(217, 228, [215, 216, 217])
    assert.deepEqual(folioGapsInText(text), [], 'aucun delta ≠ 1 : le trou est APRÈS la dernière ancre')
    assert.equal(scanBookDir('TEST', dir).length, 1)
  })
})
