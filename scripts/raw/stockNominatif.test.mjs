// Test des primitives PARTAGÉES des stocks nominatifs de `scripts/raw` (node --test) : la CLÉ d'un
// site, l'ordinal d'occurrence, la lecture d'un stock absent, et les deux sens de l'écart. Ce que
// vérifient ici les quatre gardes qui en dépendent (check-code-refs, citation-graphy-guard, reanchor,
// check-refs) est le CONTRAT, jamais un compte : les plafonds vivent dans le test de chaque garde.
// Lancé par `npm run test:raw`.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { readStock, sitesEnEntrees, cleDeSite, ecartDuVolet } from './stockNominatif.mjs'

function withTempDir(fn) {
  const dir = mkdtempSync(join(tmpdir(), 'stock-nominatif-'))
  try { fn(dir) } finally { rmSync(dir, { recursive: true, force: true }) }
}

test('sitesEnEntrees : deux sites de la MÊME réf dans le MÊME fichier se distinguent par leur OCCURRENCE', () => {
  const entrees = sitesEnEntrees([
    { file: 'src/a.ts', ref: 'LDB 6 l.2' },
    { file: 'src/a.ts', ref: 'LDB 6 l.2' },
    { file: 'src/b.ts', ref: 'LDB 6 l.2' },
  ])
  assert.deepEqual(entrees.map((e) => e.occurrence), [1, 2, 1])
  assert.equal(new Set(entrees.map(cleDeSite)).size, entrees.length, 'la clé doit distinguer chaque site')
})

// La LIGNE DU FICHIER PORTEUR n'entre pas dans la clé : deux sites de même (fichier, réf) écrits à
// des lignes différentes ne se distinguent QUE par leur occurrence — c'est ce qui rend une entrée
// survivante à l'édition du fichier qui la porte. La ligne CITÉE (`l.2`, dans `Source/`), elle,
// appartient à la réf, donc à la clé.
test('cleDeSite : la ligne du fichier PORTEUR n’entre pas dans la clé — seule l’occurrence sépare deux homonymes', () => {
  const enHaut = sitesEnEntrees([{ file: 'src/a.ts', ref: 'LDB 6 l.2', row: 12 }, { file: 'src/a.ts', ref: 'LDB 6 l.2', row: 300 }])
  const deplaces = sitesEnEntrees([{ file: 'src/a.ts', ref: 'LDB 6 l.2', row: 480 }, { file: 'src/a.ts', ref: 'LDB 6 l.2', row: 902 }])
  assert.deepEqual(enHaut.map(cleDeSite), deplaces.map(cleDeSite), 'déplacer les deux sites dans leur fichier ne change aucune clé')
  assert.deepEqual(enHaut.map(cleDeSite), [' :: src/a.ts :: LDB 6 l.2 :: 1', ' :: src/a.ts :: LDB 6 l.2 :: 2'])
  assert.equal(
    ecartDuVolet({ sites: [{ file: 'src/a.ts', ref: 'LDB 6 l.2', row: 902 }], stock: [{ fichier: 'src/a.ts', ref: 'LDB 6 l.2', occurrence: 1 }], ou: 'x-stock.json' }).neuves.length,
    0, 'un site déplacé dans son fichier reste couvert par son entrée',
  )
  assert.equal(
    ecartDuVolet({ sites: [{ file: 'src/a.ts', ref: 'LDB 6 l.3' }], stock: [{ fichier: 'src/a.ts', ref: 'LDB 6 l.2', occurrence: 1 }], ou: 'x-stock.json' }).neuves.length,
    1, 'la ligne CITÉE, elle, appartient à la clé : l.2 → l.3 est un autre site',
  )
})

test('écart : un site hors du stock est NEUF, une entrée sans site est SOLDÉE, les deux nommés', () => {
  const stock = [{ fichier: 'src/a.ts', ref: 'LDB 6 l.2', occurrence: 1 }, { fichier: 'src/c.ts', ref: 'LDB 6 l.2', occurrence: 1 }]
  const { neuves, perimees } = ecartDuVolet({
    sites: [{ file: 'src/a.ts', ref: 'LDB 6 l.2' }, { file: 'src/b.ts', ref: 'LDB 6 l.2' }],
    stock, ou: 'x-stock.json',
  })
  assert.equal(neuves.length, 1)
  assert.match(neuves[0], /src\/b\.ts/)
  assert.match(neuves[0], /site NEUF/)
  assert.match(neuves[0], /CLIQUET:/)
  assert.equal(perimees.length, 1)
  assert.match(perimees[0], /src\/c\.ts/)
  assert.match(perimees[0], /entrée SOLDÉE/)
})

test('écart : un stock qui décrit EXACTEMENT les sites observés ne dit rien', () => {
  const { neuves, perimees } = ecartDuVolet({
    sites: [{ file: 'src/a.ts', ref: 'LDB 6 l.2' }, { file: 'src/a.ts', ref: 'LDB 6 l.2' }],
    stock: [
      { fichier: 'src/a.ts', ref: 'LDB 6 l.2', occurrence: 1 },
      { fichier: 'src/a.ts', ref: 'LDB 6 l.2', occurrence: 2 },
    ],
    ou: 'x-stock.json',
  })
  assert.deepEqual([neuves, perimees], [[], []])
})

test('readStock : fichier absent → aucune entrée (zéro-tolérance), fichier présent → ses entrées', () => {
  assert.deepEqual(readStock(join(tmpdir(), 'inexistant-stock-nominatif.json')), [])
  withTempDir((dir) => {
    const path = join(dir, 'stock.json')
    writeFileSync(path, '{"entrees":[{"fichier":"src/a.ts","ref":"LDB 6 l.2","occurrence":1}]}', 'utf8')
    assert.deepEqual(readStock(path).map(cleDeSite), [' :: src/a.ts :: LDB 6 l.2 :: 1'])
  })
})
