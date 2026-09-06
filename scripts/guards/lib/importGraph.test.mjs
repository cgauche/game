// Contrat du parseur d'imports PARTAGÉ (`importGraph.mjs`) — deux points que ses consommateurs
// (`build-systemes.mjs`, `genericDomainImport.mjs`, `build-implemente.mjs`) tiennent pour acquis :
//   1. les extensions résolues couvrent ce que le dépôt écrit VRAIMENT, `.mjs`/`.cjs` compris —
//      109 imports relatifs de `src/**` vers les libs de garde de `scripts/**` en dépendent ;
//   2. la CLOSURE reste bornée à `src/` — la borne est le PRÉDICAT que `closureOf` passe à la marche
//      (`clotureDImports`), pas une propriété de la marche : une lib de `scripts/` résolue n'entre pas
//      pour autant dans une closure. Le test le dit en POSITIF pour qu'un élargissement de la frontière
//      se voie ici, jamais par surprise chez un consommateur ;
//   3. la MARCHE NON BORNÉE (`clotureDImports` sans prédicat) atteint, elle, les libs de `scripts/` —
//      c'est ce que `lister.test.mjs` (#1679 L3b) exige pour voir un listing dans une lib de garde
//      atteinte par un générateur, là où `closureOf` ne rend AUCUN module `scripts/`.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { clotureDImports, closureOf, resolveImport } from './importGraph.mjs'

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

test('un import À EFFET DE BORD (`import \'./x\'`, sans `from`) entre dans la marche', () => {
  const racine = mkdtempSync(join(tmpdir(), 'import-graph-'))
  try {
    mkdirSync(join(racine, 'src'), { recursive: true })
    writeFileSync(join(racine, 'src', 'a.ts'), "import './b.mjs'\n")
    writeFileSync(join(racine, 'src', 'b.mjs'), 'export const x = 1\n')
    const membres = [...closureOf([join(racine, 'src', 'a.ts')])]
    assert.equal(membres.filter((m) => m.endsWith('/src/b.mjs')).length, 1,
      'un module tiré par un import à effet de bord reste invisible de la marche — donc du mur d’ordre total (#1679 L3b)')
  } finally {
    rmSync(racine, { recursive: true, force: true })
  }
})

test('MARCHE NON BORNÉE : depuis une racine de `scripts/`, `clotureDImports` atteint une lib de `scripts/guards/lib/`', () => {
  const racine = mkdtempSync(join(tmpdir(), 'import-graph-'))
  try {
    mkdirSync(join(racine, 'scripts', 'docs'), { recursive: true })
    mkdirSync(join(racine, 'scripts', 'guards', 'lib'), { recursive: true })
    mkdirSync(join(racine, 'src'), { recursive: true })
    writeFileSync(join(racine, 'scripts', 'docs', 'g.mjs'),
      "import { c } from '../guards/lib/conso.mjs'\nimport { d } from '../../src/d.ts'\n")
    writeFileSync(join(racine, 'scripts', 'guards', 'lib', 'conso.mjs'), 'export const c = 1\n')
    writeFileSync(join(racine, 'src', 'd.ts'), 'export const d = 1\n')
    const marche = [...clotureDImports([join(racine, 'scripts', 'docs', 'g.mjs')])]
    assert.equal(marche.filter((m) => m.endsWith('/scripts/guards/lib/conso.mjs')).length, 1,
      'la marche non bornée doit voir la lib de garde atteinte par le générateur')
    assert.equal(marche.filter((m) => m.endsWith('/src/d.ts')).length, 1)
    // Contre-épreuve : la MEME racine sous `closureOf` ne rend AUCUN module `scripts/`.
    const bornee = [...closureOf([join(racine, 'scripts', 'docs', 'g.mjs')])]
    assert.deepEqual(bornee.filter((m) => m.includes('/scripts/guards/')), [])
  } finally {
    rmSync(racine, { recursive: true, force: true })
  }
})
