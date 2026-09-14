// Test du LECTEUR de stock nominatif sur disque (node --test) : un fichier absent ne tolère rien, un
// fichier présent rend ses entrées. Le CONTRAT de la clé et de l'écart vit avec la primitive
// (`scripts/guards/lib/stock.test.mjs`). Lancé par `npm run test:hooks`, avec la primitive.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { cleDeSite } from '../guards/lib/stock.mjs'
import { lireStockJson, readStock } from './stockNominatif.mjs'

function withTempDir(fn) {
  const dir = mkdtempSync(join(tmpdir(), 'stock-nominatif-'))
  try { fn(dir) } finally { rmSync(dir, { recursive: true, force: true }) }
}

test('readStock : fichier absent → aucune entrée (zéro-tolérance), fichier présent → ses entrées', () => {
  assert.deepEqual(readStock(join(tmpdir(), 'inexistant-stock-nominatif.json')), [])
  withTempDir((dir) => {
    const path = join(dir, 'stock.json')
    writeFileSync(path, '{"entrees":[{"fichier":"src/a.ts","ref":"LDB 6 l.2","occurrence":1}]}', 'utf8')
    assert.deepEqual(readStock(path).map(cleDeSite), [' :: src/a.ts :: LDB 6 l.2 :: 1'])
  })
})

test('lireStockJson : un stock absent rend un document VIDE, un stock présent rend son JSON entier', () => {
  assert.deepEqual(lireStockJson(join(tmpdir(), 'inexistant-stock-nominatif.json')), {})
  withTempDir((dir) => {
    const path = join(dir, 'stock.json')
    writeFileSync(path, '{"quoi":"fixture","entrees":[]}', 'utf8')
    assert.deepEqual(lireStockJson(path), { quoi: 'fixture', entrees: [] })
  })
})
