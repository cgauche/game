// Test du détecteur `check-implemente` (node --test) : un topic dont l'Atlas déclare la
// non-implémentation alors que le code cite une des réfs du topic est une CONTRADICTION (#434,
// cœur). Lancé par `npm run test:raw`.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  declaresNonImpl, scanDeclarations, scanContradictions, countsByDoc, assertAgainstBaseline,
} from './check-implemente.mjs'

function withFixture(rawFiles, srcFiles, fn) {
  const root = mkdtempSync(join(tmpdir(), 'check-implemente-'))
  const rawDir = join(root, 'raw')
  const srcDir = join(root, 'src')
  mkdirSync(rawDir, { recursive: true })
  mkdirSync(join(srcDir, 'engine'), { recursive: true })
  for (const [name, content] of Object.entries(rawFiles)) writeFileSync(join(rawDir, name), content, 'utf8')
  for (const [name, content] of Object.entries(srcFiles)) writeFileSync(join(srcDir, name), content, 'utf8')
  try { return fn({ rawDir, srcDir }) } finally { rmSync(root, { recursive: true, force: true }) }
}

test('declaresNonImpl : marqueur AVANT toute réf de code (ou aucune réf) → déclaration', () => {
  assert.equal(declaresNonImpl('non implémenté.'), true)
  assert.equal(declaresNonImpl('(non implémenté) — seul `src/state/x.ts` existe pour un autre aspect.'), true)
  assert.equal(declaresNonImpl("n'est pas implémentée"), true)
  assert.equal(declaresNonImpl('non câblé'), true)
  assert.equal(declaresNonImpl('non-implémenté (variante graphie tiret)'), true)
})

test('declaresNonImpl : réf de code AVANT le marqueur → aveu PARTIEL, pas une déclaration', () => {
  assert.equal(declaresNonImpl('`src/engine/foo.ts` implémente la règle ; un détail annexe non implémenté.'), false)
  assert.equal(declaresNonImpl('`src/state/x.ts` — la restriction Y n\'est pas implémentée.'), false)
})

test('declaresNonImpl : aucun marqueur → silence (implémenté)', () => {
  assert.equal(declaresNonImpl('`src/engine/foo.ts` implémente la règle en entier.'), false)
})

const FIXTURE_RAW_DETECTED = `## Sujet Empoignade-like

**Sources RAW** : \`LDB 6 l.1-2\`

**Implémente** :
- Partie A : \`src/engine/foo.ts\` implémentée.
- Partie B (option) : \`(non implémenté)\` — rien dans le code pour cette partie.
`

const FIXTURE_SRC_CITES = `// Implémente la Partie A (LDB 6 l.1).
export const foo = 1
`

test('topic « non implémenté » + code citant la MÊME réf (LDB) → CONTRADICTION détectée', () => {
  withFixture(
    { 'combat.md': FIXTURE_RAW_DETECTED },
    { 'engine/foo.ts': FIXTURE_SRC_CITES },
    ({ rawDir, srcDir }) => {
      const contradictions = scanContradictions({ rawDir, srcDir })
      assert.equal(contradictions.length, 1)
      assert.match(contradictions[0].text, /Partie B/)
      assert.equal(contradictions[0].hits[0].ref, 'LDB 6')
    },
  )
})

test('topic « non implémenté » SANS aucune citation de code → silencieux (vrai trou)', () => {
  withFixture(
    { 'combat.md': FIXTURE_RAW_DETECTED },
    { 'engine/foo.ts': '// aucune réf ici\nexport const foo = 1\n' },
    ({ rawDir, srcDir }) => {
      const contradictions = scanContradictions({ rawDir, srcDir })
      assert.equal(contradictions.length, 0)
      // mais la déclaration existe bien (silencieuse faute de citation code) :
      const decls = scanDeclarations(rawDir)
      assert.equal(decls.length, 1)
    },
  )
})

const FIXTURE_RAW_PARTIAL = `## Sujet Partiel

**Sources RAW** : \`LDB 6 l.1-2\`

**Implémente** : \`src/engine/foo.ts\` implémente la règle. Le détail annexe n'est pas implémentée.
`

test('champ PARTIEL (code cité PUIS aveu de trou) → PAS une contradiction, même si le code cite la réf', () => {
  withFixture(
    { 'combat.md': FIXTURE_RAW_PARTIAL },
    { 'engine/foo.ts': FIXTURE_SRC_CITES },
    ({ rawDir, srcDir }) => {
      const contradictions = scanContradictions({ rawDir, srcDir })
      assert.equal(contradictions.length, 0)
    },
  )
})

test('champ Implémente sans bullet, une seule ligne : marqueur seul → déclaration pleine', () => {
  withFixture(
    { 'talents.md': '## Solo\n\n**Sources RAW** : `LDB 6 l.1`\n\n**Implémente :** non implémenté.\n' },
    { 'engine/foo.ts': FIXTURE_SRC_CITES },
    ({ rawDir, srcDir }) => {
      const contradictions = scanContradictions({ rawDir, srcDir })
      assert.equal(contradictions.length, 1)
    },
  )
})

test('tableau de BILAN (`| Mécanique | Module | État |`) → jamais scanné comme un champ', () => {
  withFixture(
    { 'activites.md': '## Implémente\n\n| Mécanique | Module | État |\n|---|---|---|\n| X | — | Non implémenté |\n' },
    { 'engine/foo.ts': FIXTURE_SRC_CITES },
    ({ rawDir, srcDir }) => {
      assert.equal(scanDeclarations(rawDir).length, 0)
    },
  )
})

test('graphies multiples du libellé de champ (Implemente sans accent, Implémenté, ponctuation `.`)', () => {
  withFixture(
    {
      'a.md': '## A\n\n**Sources RAW** : `LDB 6 l.1`\n\n**Implemente** : non implémenté.\n',
      'b.md': '## B\n\n**Sources RAW** : `LDB 6 l.1`\n\n**Implémenté** : non implémenté.\n',
      'c.md': '## C\n\n**Sources RAW.** `LDB 6 l.1`. **Implémente.** non implémenté.\n',
    },
    { 'engine/foo.ts': FIXTURE_SRC_CITES },
    ({ rawDir, srcDir }) => {
      const contradictions = scanContradictions({ rawDir, srcDir })
      assert.equal(contradictions.length, 3)
    },
  )
})

test('countsByDoc + assertAgainstBaseline : hausse détectée, baisse détectée comme périmée', () => {
  const counts = countsByDoc([{ doc: 'combat.md' }, { doc: 'combat.md' }, { doc: 'magie.md' }])
  assert.deepEqual(counts, { 'combat.md': 2, 'magie.md': 1 })
  const { over, stale } = assertAgainstBaseline(counts, { 'combat.md': 1, 'magie.md': 1, 'tests.md': 3 })
  assert.equal(over.length, 1)
  assert.match(over[0], /combat\.md/)
  assert.equal(stale.length, 1)
  assert.match(stale[0], /tests\.md/)
})

test('fichier EXCLU (reconciliation.md/coverage.md/reanchor.md) → jamais scanné', () => {
  withFixture(
    { 'reconciliation.md': FIXTURE_RAW_DETECTED },
    { 'engine/foo.ts': FIXTURE_SRC_CITES },
    ({ rawDir, srcDir }) => {
      assert.equal(scanContradictions({ rawDir, srcDir }).length, 0)
    },
  )
})
