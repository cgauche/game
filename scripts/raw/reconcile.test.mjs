// Test du garde `reconcile` (node --test). Lancé par `npm run test:raw`.
// Non-régression softA (#434 défaut 9) : baseline des chapitres LDB couverts à lignes non pinées.
// La baseline se met à jour à la BAISSE UNIQUEMENT — un ré-ancrage au Source pine une ligne de plus,
// jamais de nouveau trou : une HAUSSE = régression réelle (échec attendu). Ce cliquet ne verrouille
// QUE la direction (décrue) : toute baisse constatée fait foi si elle est PROUVÉE par de vraies réfs
// ré-ancrées (jamais un artefact de mesure). Mesurée à 2 après d92d8329/2ed2acff (ref #526/#583) :
// LDB 12/15 sortent de la liste — les réfs LDB 12 (activities.ts/skills.ts/policy.ts/fortune.test.ts…)
// et LDB 15 (jump.test.ts/jumpMove.ts/social.ts/combatFlow.ts…) étaient re-pointées sur de MAUVAISES
// lignes (ex. `LDB 12 l.229` → `l.202-206`, `LDB 15 l.117-122` → `l.78-84`) ; ré-ancrées au texte
// Source, elles tombent désormais dans les plages pinées de l'Atlas (±TOL=20). Était 4 : LDB 05/11
// pinés avant ça.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { computeReconciliation } from './reconcile.mjs'

test('non-régression : Sens A LDB sur le vrai repo = 0 trou dur · 2 chapitres à lignes non pinées', () => {
  const data = computeReconciliation()
  assert.equal(data.hardA.length, 0)
  assert.deepEqual(
    data.softA.map((s) => s.ch).sort(),
    ['10', '46'], // baseline à la baisse : si ce test casse par HAUSSE → régression réelle
  )
})

test('Sens B2 : le crédit FOLIO retire les chapitres-données ; normalisation dédoublonne 06/6', () => {
  const data = computeReconciliation()
  // le crédit folio réduit strictement la liste hors-code
  assert.ok(data.atlasOnly.length < data.atlasOnlyBefore.length)
  // crédités et résiduels sont DISJOINTS
  const after = new Set(data.atlasOnly)
  assert.ok(data.atlasOnlyFolioCredited.every((c) => !after.has(c)))
  // chapitres de carrières (LDB 26-35) crédités par `source:{book,page}`, jamais résiduels
  for (const c of ['26', '30', '35']) {
    assert.ok(data.atlasOnlyFolioCredited.includes(c), `LDB ${c} devrait être crédité par folio`)
    assert.ok(!after.has(c))
  }
  // normalisation `chKey` : pas de doublon, pas de forme zéro-préfixée `06`
  assert.deepEqual([...new Set(data.atlasOnlyBefore)], data.atlasOnlyBefore)
  assert.ok(!data.atlasOnlyBefore.includes('06'))
})

function withFixtures(srcFiles, docFiles, fn) {
  const root = mkdtempSync(join(tmpdir(), 'reconcile-'))
  const srcDir = join(root, 'src')
  const rawDir = join(root, 'raw')
  mkdirSync(srcDir, { recursive: true })
  mkdirSync(rawDir, { recursive: true })
  for (const [name, content] of Object.entries(srcFiles)) {
    const p = join(srcDir, name)
    mkdirSync(join(p, '..'), { recursive: true })
    writeFileSync(p, content, 'utf8')
  }
  for (const [name, content] of Object.entries(docFiles)) writeFileSync(join(rawDir, name), content, 'utf8')
  try { fn({ srcDir, rawDir }) } finally { rmSync(root, { recursive: true, force: true }) }
}

test('Sens A LDB : chapitre absent de l\'Atlas → trou dur', () => {
  withFixtures(
    { 'a.ts': '// règle LDB 6 l.3\n' },
    { 'fiche.md': 'rien à voir\n' },
    ({ srcDir, rawDir }) => {
      const data = computeReconciliation({ srcDir, rawDir })
      assert.equal(data.hardA.length, 1)
      assert.equal(data.hardA[0].ch, '6')
    },
  )
})

test('Sens A LDB : chapitre cité, ligne hors tolérance → trou fin', () => {
  withFixtures(
    { 'a.ts': '// règle LDB 6 l.500\n' },
    { 'fiche.md': 'LDB 6 l.3\n' },
    ({ srcDir, rawDir }) => {
      const data = computeReconciliation({ srcDir, rawDir })
      assert.equal(data.hardA.length, 0)
      assert.equal(data.softA.length, 1)
      assert.equal(data.softA[0].missCount, 1)
    },
  )
})

test('Sens A LDB : chapitre cité, ligne dans ±TOL → couvert', () => {
  withFixtures(
    { 'a.ts': '// règle LDB 6 l.10\n' },
    { 'fiche.md': 'LDB 6 l.3\n' },
    ({ srcDir, rawDir }) => {
      const data = computeReconciliation({ srcDir, rawDir })
      assert.equal(data.hardA.length, 0)
      assert.equal(data.softA.length, 0)
    },
  )
})

test('Sens A LDB : chapitre couvert par un catalogue → jamais un trou de ligne', () => {
  withFixtures(
    { 'a.ts': '// règle LDB 6 l.500\n' },
    { 'catalogue-x.md': 'LDB 6 mentionné, données verbatim\n' },
    ({ srcDir, rawDir }) => {
      const data = computeReconciliation({ srcDir, rawDir })
      assert.equal(data.hardA.length, 0)
      assert.equal(data.softA.length, 0)
    },
  )
})

test('Sens A (autres livres) : chapitre absent de l\'Atlas → trou dur PAR LIVRE', () => {
  withFixtures(
    { 'a.ts': '// règle AA 07 l.3\n' },
    { 'fiche.md': 'rien à voir\n' },
    ({ srcDir, rawDir }) => {
      const data = computeReconciliation({ srcDir, rawDir })
      assert.equal(data.hardAOther.length, 1)
      assert.equal(data.hardAOther[0].book, 'AA')
      assert.equal(data.hardAOther[0].ch, '7')
      assert.equal(data.bookStats.get('AA').hard, 1)
    },
  )
})

test('Sens A (autres livres) : chapitre zéro-préfixé au CODE, non préfixé à l\'ATLAS → PAS un trou (#434)', () => {
  withFixtures(
    { 'a.ts': '// règle AA 02 l.3\n' },
    { 'fiche.md': '## [AA 2] INTRODUCTION\nAA 2 l.3\n' },
    ({ srcDir, rawDir }) => {
      const data = computeReconciliation({ srcDir, rawDir })
      assert.equal(data.hardAOther.length, 0)
      assert.equal(data.softAOther.length, 0)
    },
  )
})

test('Sens A (autres livres) : chapitre RÉELLEMENT absent (numéro différent) reste un trou dur malgré la normalisation', () => {
  withFixtures(
    { 'a.ts': '// règle AA 09 l.3\n' },
    { 'fiche.md': '## [AA 2] INTRODUCTION\nAA 2 l.3\n' },
    ({ srcDir, rawDir }) => {
      const data = computeReconciliation({ srcDir, rawDir })
      assert.equal(data.hardAOther.length, 1)
      assert.equal(data.hardAOther[0].book, 'AA')
      assert.equal(data.hardAOther[0].ch, '9')
    },
  )
})

test('Sens A (autres livres) : chapitre cité, ligne hors tolérance → trou fin PAR LIVRE', () => {
  withFixtures(
    { 'a.ts': '// règle AA 07 l.500\n' },
    { 'fiche.md': 'AA 07 l.3\n' },
    ({ srcDir, rawDir }) => {
      const data = computeReconciliation({ srcDir, rawDir })
      assert.equal(data.hardAOther.length, 0)
      assert.equal(data.softAOther.length, 1)
      assert.equal(data.softAOther[0].book, 'AA')
      assert.equal(data.bookStats.get('AA').soft, 1)
    },
  )
})

test('Sens A (autres livres) : réf SANS chapitre (`AA l.X`) → comptée à part, jamais un trou', () => {
  withFixtures(
    { 'a.ts': '// règle AA l.4395\n' },
    { 'fiche.md': 'rien à voir\n' },
    ({ srcDir, rawDir }) => {
      const data = computeReconciliation({ srcDir, rawDir })
      assert.equal(data.hardAOther.length, 0)
      assert.equal(data.softAOther.length, 0)
      assert.equal(data.codeOtherNoCh.get('AA').length, 1)
      assert.equal(data.bookStats.get('AA').noCh, 1)
    },
  )
})

test('Sens A (autres livres) : chapitre couvert par un catalogue (autre livre) → jamais un trou de ligne', () => {
  withFixtures(
    { 'a.ts': '// règle AA 07 l.500\n' },
    { 'catalogue-x.md': 'AA 07 mentionné, données verbatim\n' },
    ({ srcDir, rawDir }) => {
      const data = computeReconciliation({ srcDir, rawDir })
      assert.equal(data.hardAOther.length, 0)
      assert.equal(data.softAOther.length, 0)
    },
  )
})

test('Sens A (autres livres) : Atlas en PLAGE (AA 07 l.3-600) couvre toute la plage, pas juste la borne basse (#586 jumeau)', () => {
  withFixtures(
    { 'a.ts': '// règle AA 07 l.500\n' },
    { 'fiche.md': 'AA 07 l.3-600\n' },
    ({ srcDir, rawDir }) => {
      const data = computeReconciliation({ srcDir, rawDir })
      assert.equal(data.hardAOther.length, 0)
      assert.equal(data.softAOther.length, 0)
    },
  )
})

test('Sens A (autres livres) : deux livres distincts n\'interfèrent pas l\'un avec l\'autre', () => {
  withFixtures(
    { 'a.ts': '// règles AA 07 l.3 et ZI 02 l.9\n' },
    { 'fiche.md': 'AA 07 l.3 couvert. rien pour ZI.\n' },
    ({ srcDir, rawDir }) => {
      const data = computeReconciliation({ srcDir, rawDir })
      assert.equal(data.hardAOther.length, 1)
      assert.equal(data.hardAOther[0].book, 'ZI')
      assert.equal(data.softAOther.length, 0)
    },
  )
})
