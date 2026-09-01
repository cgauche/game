// Test du garde `check-code-refs` (node --test) : une réf plantée hors borne du chapitre résolu OU
// vers un chapitre introuvable est détectée dans le CODE, une réf valide reste silencieuse, et le
// cliquet par fichier tient. Le VRAI src/ du repo reste aligné sur sa baseline. Lancé par `npm run test:raw`.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, writeFileSync, rmSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { scanDeadCodeRefs, scanEmptyLineCodeRefs, countsByFile, assertAgainstBaseline, isExcludedSrc, readBaseline, BASELINE_PATH, EMPTY_LINE_BASELINE_PATH } from './check-code-refs.mjs'

// LDB 06 (Source/…/06 - Classes.md) fait 6 lignes (split('\n').length) — chapitre réel, court, stable :
// sert d'ancrage pour planter une réf hors borne sans toucher au vrai src/.
function withTempSrcDir(name, content, fn) {
  const dir = mkdtempSync(join(tmpdir(), 'check-code-refs-'))
  writeFileSync(join(dir, name), content, 'utf8')
  try { fn(dir) } finally { rmSync(dir, { recursive: true, force: true }) }
}

test('réf morte de code (ligne hors borne du chapitre résolu) → détectée', () => {
  withTempSrcDir('x.ts', '// règle LDB 6 l.999 hors borne\n', (dir) => {
    const dead = scanDeadCodeRefs(dir)
    assert.equal(dead.length, 1)
    assert.equal(dead[0].kind, 'out-of-bounds')
    assert.equal(dead[0].hi, 999)
    assert.ok(dead[0].chapterLines < 999)
  })
})

test('réf valide (ligne dans les bornes du chapitre résolu) → silence', () => {
  withTempSrcDir('x.ts', '// règle LDB 6 l.2 dans les bornes\n', (dir) => {
    assert.equal(scanDeadCodeRefs(dir).length, 0)
  })
})

test('chapitre INTROUVABLE → détecté (kind chapter-not-found) — la garde du code échoue dessus', () => {
  withTempSrcDir('x.ts', '// règle LDB 9999 l.5 vers un chapitre inexistant\n', (dir) => {
    const dead = scanDeadCodeRefs(dir)
    assert.equal(dead.length, 1)
    assert.equal(dead[0].kind, 'chapter-not-found')
  })
})

test('plage l.X-Y : la borne HAUTE est vérifiée', () => {
  withTempSrcDir('x.ts', '// plage LDB 6 l.1-999 qui déborde\n', (dir) => {
    const dead = scanDeadCodeRefs(dir)
    assert.equal(dead.length, 1)
    assert.equal(dead[0].hi, 999)
  })
})

test('réf « autre livre » (MSRC 16 l.99999) hors borne → détectée via otherRe', () => {
  withTempSrcDir('x.ts', '// MSRC 16 l.99999 déborde franchement\n', (dir) => {
    const dead = scanDeadCodeRefs(dir)
    assert.equal(dead.length, 1)
    assert.equal(dead[0].abbr, 'MSRC')
  })
})

test('réf « autre livre » en PLAGE (MSRC 13 l.5-9999) : la borne HAUTE de la plage est vérifiée, pas juste la borne basse', () => {
  withTempSrcDir('x.ts', '// MSRC 13 l.5-9999 plage qui déborde par le HAUT\n', (dir) => {
    const dead = scanDeadCodeRefs(dir)
    assert.equal(dead.length, 1)
    assert.equal(dead[0].abbr, 'MSRC')
    assert.equal(dead[0].hi, 9999)
  })
})

test('.json scanné comme .ts/.tsx', () => {
  withTempSrcDir('data.json', '{ "note": "LDB 6 l.999" }\n', (dir) => {
    assert.equal(scanDeadCodeRefs(dir).length, 1)
  })
})

test('isExcludedSrc : art de couverture (tenues/defs/) exclu, reste inclus', () => {
  assert.equal(isExcludedSrc('src/gameIso/rig/parts/tenues/defs/Loup-blanc.ts'), true)
  assert.equal(isExcludedSrc('src/engine/combat.ts'), false)
})

test('countsByFile + assertAgainstBaseline : hausse détectée, baisse détectée comme périmée', () => {
  const counts = countsByFile([
    { file: 'src/a.ts' }, { file: 'src/a.ts' }, { file: 'src/b.ts' },
  ])
  assert.deepEqual(counts, { 'src/a.ts': 2, 'src/b.ts': 1 })

  const { over, stale } = assertAgainstBaseline(counts, { 'src/a.ts': 1, 'src/b.ts': 1, 'src/c.ts': 5 })
  assert.equal(over.length, 1) // a.ts : 2 > baseline 1
  assert.match(over[0], /src\/a\.ts/)
  assert.equal(stale.length, 1) // c.ts : baseline 5, réel 0
  assert.match(stale[0], /src\/c\.ts/)
})

test('conforme à la baseline exacte → ni hausse ni péremption', () => {
  const { over, stale } = assertAgainstBaseline({ 'src/a.ts': 3 }, { 'src/a.ts': 3 })
  assert.equal(over.length, 0)
  assert.equal(stale.length, 0)
})

test('readBaseline : fichier absent → {} (mode zéro-tolérance), fichier présent → parsé', () => {
  assert.deepEqual(readBaseline(join(tmpdir(), 'inexistant-check-code-refs.json')), {})
  withTempSrcDir('_unused.ts', '', (dir) => {
    const path = join(dir, 'baseline.json')
    writeFileSync(path, '{"src/a.ts":2}', 'utf8')
    assert.deepEqual(readBaseline(path), { 'src/a.ts': 2 })
  })
})

// LDB 06 l.1 porte `*Pages PDF 48*`, LDB 06 l.2 est BLANCHE — ancrage réel du contrôle « ligne non vide ».
test('réf dans les bornes mais sur une ligne VIDE → détectée', () => {
  withTempSrcDir('x.ts', '// règle LDB 6 l.2 tombe sur du blanc\n', (dir) => {
    const vides = scanEmptyLineCodeRefs(dir)
    assert.equal(vides.length, 1)
    assert.equal(vides[0].lo, 2)
    assert.equal(vides[0].hi, 2)
    assert.equal(scanDeadCodeRefs(dir).length, 0, 'la ligne est dans les bornes : le contrôle de bornes doit rester muet')
  })
})

test('réf sur une ligne NON vide → silence du contrôle « ligne non vide »', () => {
  withTempSrcDir('x.ts', '// règle LDB 6 l.1 porte du texte\n', (dir) => {
    assert.equal(scanEmptyLineCodeRefs(dir).length, 0)
  })
})

test('réf HORS BORNE : affaire du contrôle de bornes, jamais comptée deux fois par « ligne vide »', () => {
  withTempSrcDir('x.ts', '// règle LDB 6 l.999 hors borne\n', (dir) => {
    assert.equal(scanDeadCodeRefs(dir).length, 1)
    assert.equal(scanEmptyLineCodeRefs(dir).length, 0)
  })
})

test('plage l.X-Y : vide seulement si TOUTE la plage est blanche', () => {
  withTempSrcDir('a.ts', '// plage LDB 6 l.1-2 dont une ligne porte du texte\n', (dir) => {
    assert.equal(scanEmptyLineCodeRefs(dir).length, 0)
  })
})

test('non-régression : le VRAI src/ du repo est aligné sur la baseline des réfs sur ligne vide (cliquet DÉCROISSANT)', () => {
  const counts = countsByFile(scanEmptyLineCodeRefs())
  const { over, stale } = assertAgainstBaseline(counts, readBaseline(EMPTY_LINE_BASELINE_PATH))
  assert.deepEqual(over, [], `réf(s) de code tombée(s) sur une ligne VIDE en hausse :\n${over.join('\n')}`)
  assert.deepEqual(stale, [], `baseline(s) périmée(s) à ABAISSER dans empty-line-code-refs-baseline.json :\n${stale.join('\n')}`)
})

test('non-régression : le VRAI src/ du repo est aligné sur le régime ZÉRO-TOLÉRANCE (#583 : baseline soldée)', () => {
  // Solde #583 : dead-code-refs-baseline.json est ABSENT en régime nominal — toute réf morte échoue.
  assert.equal(existsSync(BASELINE_PATH), false, 'dead-code-refs-baseline.json doit rester ABSENT (zéro-tolérance) — sa réapparition doit porter un diagnostic de résidu irréductible')
  const counts = countsByFile(scanDeadCodeRefs())
  const { over, stale } = assertAgainstBaseline(counts, readBaseline())
  assert.deepEqual(over, [], `réfs de code mortes détectées (tolérance zéro) :\n${over.join('\n')}`)
  assert.deepEqual(stale, [], `baseline(s) périmée(s) à abaisser :\n${stale.join('\n')}`)
})
