// Test du garde `reconcile` (node --test). Lancé par `npm run test:raw`.
// CONTRAT vérifié ici, sur le VRAI dépôt (#434 défaut 9) : le sens A du LDB ne porte AUCUN trou dur,
// et AUCUN chapitre ne reste « à lignes non pinées » — la liste attendue est VIDE. Le cliquet ne
// verrouille que la DIRECTION : une HAUSSE est une régression (un chapitre dont les réfs de code
// retombent hors des plages pinées de l'Atlas, ±TOL=20) ; une baisse ne vaut que PROUVÉE par des
// réfs ré-ancrées au `Source/`, jamais par un artefact de mesure.
// Les tests suivants fixent le vocabulaire de couverture : une fiche qui ne cite QU'en graphie FOLIO
// (`ABBR NN p.X`, #585/#606) crédite son chapitre via `folioSpan`/`folioRange`, à l'égal d'une réf ligne.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { computeReconciliation } from './reconcile.mjs'

test('non-régression : Sens A LDB sur le vrai repo = 0 trous dur + 0 chapitre à lignes non pinées', () => {
  const data = computeReconciliation()
  assert.equal(data.hardA.length, 0)
  assert.deepEqual(
    data.softA.map((s) => s.ch).sort(),
    [], // baseline à la baisse : si ce test casse par HAUSSE → régression réelle
  )
})

test("Sens A LDB (#606) : une fiche qui ne cite QU'en folio (`ABBR NN p.X`) credite bien son chapitre", () => {
  // `folioSpan`/`folioRange` resolvent contre le VRAI `Source/` (via `books.json`, pas les dirs isolés
  // de `withFixtures`) : le folio 132 du LDB tombe reellement dans le chapitre 10 (Talents), l.3-89 --
  // un code fixture citant une ligne DANS cette plage doit se retrouver couvert par la seule ref folio.
  withFixtures(
    { 'a.ts': '// règle LDB 10 l.50\n' },
    { 'fiche.md': 'LDB 10 p.132\n' },
    ({ srcDir, rawDir }) => {
      const data = computeReconciliation({ srcDir, rawDir })
      assert.equal(data.hardA.length, 0)
      assert.equal(data.softA.length, 0)
    },
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

test('Sens A LDB : chapitre zéro-préfixé au CODE, catalogue non préfixé → exemption catalogue VIVANTE (#1156)', () => {
  withFixtures(
    { 'a.ts': '// règle LDB 08 l.500\n' },
    { 'catalogue-x.md': '## [LDB 8] Statut\ndonnées verbatim\n' },
    ({ srcDir, rawDir }) => {
      const data = computeReconciliation({ srcDir, rawDir })
      assert.equal(data.hardA.length, 0)
      assert.equal(data.softA.length, 0)
    },
  )
})

test('Sens A LDB : Atlas zéro-préfixé, code non préfixé → la ligne est pinée (graphies croisées, #1156)', () => {
  withFixtures(
    { 'a.ts': '// règle LDB 8 l.500\n' },
    { 'fiche.md': 'LDB 08 l.3-600\n' },
    ({ srcDir, rawDir }) => {
      const data = computeReconciliation({ srcDir, rawDir })
      assert.equal(data.hardA.length, 0)
      assert.equal(data.softA.length, 0)
    },
  )
})

test('Sens A LDB : chapitre RÉELLEMENT absent (numéro différent) reste un trou dur malgré la normalisation (#1156)', () => {
  withFixtures(
    { 'a.ts': '// règle LDB 09 l.3\n' },
    { 'catalogue-x.md': '## [LDB 8] Statut\ndonnées verbatim\n' },
    ({ srcDir, rawDir }) => {
      const data = computeReconciliation({ srcDir, rawDir })
      assert.equal(data.hardA.length, 1)
      assert.equal(data.hardA[0].ch, '9')
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
