// Tests de l'amorce d'ancrage `folio-bootstrap` (node --test) : lecture du folio imprimé, offset
// K−folio, plage de corpus, compactage en runs (#833). Lancé par `npm run test:raw`.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { readPrintedFolio, resolveOffsetFromPdf, corpusRange, folioRuns } from './folio-bootstrap.mjs'

function withTempBookDir(files, fn) {
  const dir = mkdtempSync(join(tmpdir(), 'folio-bootstrap-'))
  try {
    for (const [name, content] of Object.entries(files)) writeFileSync(join(dir, name), content, 'utf8')
    return fn(dir)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

// ---------- readPrintedFolio ----------

test('readPrintedFolio : nombre nu en TÊTE de page → folio lu', () => {
  assert.equal(readPrintedFolio('24\nIV\nWARHAMMER FANTASY\nDu texte de prose.'), 24)
})

test('readPrintedFolio : nombre nu en PIED de page → folio lu', () => {
  assert.equal(readPrintedFolio('Du texte de prose.\nencore du texte\nsuite\nfin de page\nII\n137'), 137)
})

test('readPrintedFolio : aucun nombre nu isolé → null, jamais une valeur devinée', () => {
  assert.equal(readPrintedFolio('Page 24 sur 300\nUn Test de Calme (+20) et 1d10 dégâts.'), null)
  assert.equal(readPrintedFolio(''), null)
  assert.equal(readPrintedFolio(null), null)
})

test('readPrintedFolio : un nombre nu au MILIEU de la page est hors portée de la sonde', () => {
  const page = ['tete', 'a', 'b', 'c', '99', 'd', 'e', 'f', 'pied'].join('\n')
  assert.equal(readPrintedFolio(page), null)
})

// ---------- resolveOffsetFromPdf ----------

test('resolveOffsetFromPdf : offset K−folio constant → accepté, avec ses lectures', () => {
  const pages = [[10, '7\ntexte'], [11, '8\ntexte'], [12, '9\ntexte']]
  const off = resolveOffsetFromPdf(pages)
  assert.equal(off.ok, true)
  assert.equal(off.offset, 3)
  assert.deepEqual(off.reads.map((r) => r.folio), [7, 8, 9])
})

test('resolveOffsetFromPdf : page sans folio lisible → ignorée, jamais fatale', () => {
  const off = resolveOffsetFromPdf([[10, '7\ntexte'], [11, 'planche pleine page'], [12, '9\ntexte']])
  assert.equal(off.ok, true)
  assert.equal(off.offset, 3)
  assert.equal(off.reads.length, 2)
})

test('resolveOffsetFromPdf : offset NON unique → abandon (jamais rattrapé par une majorité)', () => {
  const off = resolveOffsetFromPdf([[10, '7\na'], [11, '8\nb'], [12, '4\nc']])
  assert.equal(off.ok, false)
  assert.match(off.reason, /non unique/)
})

test('resolveOffsetFromPdf : aucune page folioée → abandon', () => {
  const off = resolveOffsetFromPdf([[10, 'planche'], [11, 'planche']])
  assert.equal(off.ok, false)
  assert.match(off.reason, /aucun folio imprimé/)
})

// ---------- corpusRange ----------

test('corpusRange : min/max des en-têtes `*Pages PDF N[-M]*`, en K (0-based)', () => {
  const range = withTempBookDir({
    '01 - A.md': '*Pages PDF 10-23*\n\ntexte',
    '02 - B.md': '*Pages PDF 24-40*\n\ntexte',
    '03 - C.md': '*Pages PDF 41*\n\ntexte',
  }, corpusRange)
  assert.deepEqual(range, { lo: 9, hi: 40 })
})

test('corpusRange : fichier sans en-tête ignoré ; aucun en-tête du tout → null', () => {
  const withOne = withTempBookDir({ '01 - A.md': '*Pages PDF 10-23*\n', '02 - B.md': 'sans en-tête\n' }, corpusRange)
  assert.deepEqual(withOne, { lo: 9, hi: 22 })
  assert.equal(withTempBookDir({ '01 - A.md': 'sans en-tête\n' }, corpusRange), null)
})

// ---------- folioRuns ----------

test('folioRuns : suite continue → un seul run', () => {
  const reads = [{ k: 10, folio: 7 }, { k: 11, folio: 8 }, { k: 12, folio: 9 }]
  assert.deepEqual(folioRuns(reads), [{ kFrom: 10, kTo: 12, folioFrom: 7, folioTo: 9 }])
})

test('folioRuns : une rupture (page non folioée) ouvre un nouveau run', () => {
  const reads = [{ k: 10, folio: 7 }, { k: 11, folio: 8 }, { k: 13, folio: 10 }]
  assert.deepEqual(folioRuns(reads), [
    { kFrom: 10, kTo: 11, folioFrom: 7, folioTo: 8 },
    { kFrom: 13, kTo: 13, folioFrom: 10, folioTo: 10 },
  ])
})

test('folioRuns : aucune lecture → aucun run', () => {
  assert.deepEqual(folioRuns([]), [])
})
