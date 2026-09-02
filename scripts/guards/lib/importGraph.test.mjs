// Contrat du parseur d'imports PARTAGÉ (`importGraph.mjs`) — deux points que ses consommateurs
// (`build-systemes.mjs`, `genericDomainImport.mjs`, `build-implemente.mjs`) tiennent pour acquis :
//   1. les extensions résolues couvrent ce que le dépôt écrit VRAIMENT, `.mjs`/`.cjs` compris —
//      109 imports relatifs de `src/**` vers les libs de garde de `scripts/**` en dépendent ;
//   2. la CLOSURE reste bornée à `src/` (`importGraph.mjs`, filtre `resolved.includes('/src/')`) :
//      une lib de `scripts/` résolue n'entre pas pour autant dans une closure. Le test le dit en
//      POSITIF pour qu'un élargissement de la frontière se voie ici, jamais par surprise chez un
//      consommateur.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { closureOf, resolveImport } from './importGraph.mjs'

const RACINE = fileURLToPath(new URL('../../..', import.meta.url))

test('un import relatif `.mjs` d’une lib de garde se résout vers son fichier (site réel)', () => {
  const depuis = join(RACINE, 'src', 'data', 'entity-orphans.test.ts')
  const resolu = resolveImport(depuis, '../../scripts/guards/lib/entityOrphanStock.mjs')
  assert.ok(resolu, 'l’import `.mjs` de `entity-orphans.test.ts` doit se résoudre, pas rendre null')
  assert.match(resolu, /scripts\/guards\/lib\/entityOrphanStock\.mjs$/)
})

test('l’extension `.mjs` se déduit aussi d’un spécificateur SANS extension', () => {
  const racine = mkdtempSync(join(tmpdir(), 'import-graph-'))
  try {
    mkdirSync(join(racine, 'src'), { recursive: true })
    writeFileSync(join(racine, 'src', 'a.ts'), "import { x } from './b'\n")
    writeFileSync(join(racine, 'src', 'b.mjs'), 'export const x = 1\n')
    assert.match(resolveImport(join(racine, 'src', 'a.ts'), './b'), /\/src\/b\.mjs$/)
  } finally {
    rmSync(racine, { recursive: true, force: true })
  }
})

test('un `.mjs` de `src/` entre dans la closure, avec le module qui l’importe', () => {
  const racine = mkdtempSync(join(tmpdir(), 'import-graph-'))
  try {
    mkdirSync(join(racine, 'src'), { recursive: true })
    writeFileSync(join(racine, 'src', 'a.ts'), "import { x } from './b.mjs'\n")
    writeFileSync(join(racine, 'src', 'b.mjs'), 'export const x = 1\n')
    const membres = [...closureOf([join(racine, 'src', 'a.ts')])]
    assert.equal(membres.filter((m) => m.endsWith('/src/b.mjs')).length, 1)
    assert.equal(membres.filter((m) => m.endsWith('/src/a.ts')).length, 1)
  } finally {
    rmSync(racine, { recursive: true, force: true })
  }
})

test('FRONTIÈRE : une lib hors `src/` reste hors closure, même résolue', () => {
  const racine = mkdtempSync(join(tmpdir(), 'import-graph-'))
  try {
    mkdirSync(join(racine, 'src'), { recursive: true })
    mkdirSync(join(racine, 'scripts'), { recursive: true })
    writeFileSync(join(racine, 'src', 'a.ts'), "import { s } from '../scripts/lib.mjs'\n")
    writeFileSync(join(racine, 'scripts', 'lib.mjs'), 'export const s = 1\n')
    // Résolu par `resolveImport`…
    assert.match(resolveImport(join(racine, 'src', 'a.ts'), '../scripts/lib.mjs'), /\/scripts\/lib\.mjs$/)
    // …et pourtant absent de la closure : `closureOf` ne garde que les enfants sous `src/`.
    const membres = [...closureOf([join(racine, 'src', 'a.ts')])]
    assert.deepEqual(membres.filter((m) => m.includes('/scripts/')), [])
  } finally {
    rmSync(racine, { recursive: true, force: true })
  }
})
