// Test du garde `check-entity-in-chapter` (#600, node --test) : une entrée dont le NOM est absent
// du texte du chapitre cité est détectée (réf syntaxiquement conforme mais cible fausse — la classe
// « réf fausse blanchie par la normalisation »), une entrée dont le nom est présent reste silencieuse.
// Lancé par `npm run test:raw`.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  scanMissingEntities, scanAll, countsByEntry, assertAgainstBaseline, readBaseline,
  normalizeLoose, stripArticles, entityNameFromHeader, BASELINE_PATH,
} from './check-entity-in-chapter.mjs'

// LDB 06 (Source/…/06 - Classes.md) : chapitre réel, court et stable, contient le mot « Classes ».
function withTempDoc(content, fn) {
  const dir = mkdtempSync(join(tmpdir(), 'check-entity-in-chapter-'))
  const path = join(dir, 'fixture.md')
  writeFileSync(path, content, 'utf8')
  try { fn(path) } finally { rmSync(dir, { recursive: true, force: true }) }
}

test('nom PRÉSENT dans le chapitre cité → silence', () => {
  withTempDoc('### Classes\n**Source :** LDB 6 p.48  \n**Maxi :** 1\n\nDesc.\n', (path) => {
    assert.equal(scanMissingEntities(path).length, 0)
  })
})

test('nom ABSENT du chapitre cité → détecté (réf syntaxiquement conforme, cible fausse)', () => {
  withTempDoc('### Talent Totalement Absent\n**Source :** LDB 6 p.48  \n**Maxi :** 1\n\nDesc.\n', (path) => {
    const v = scanMissingEntities(path)
    assert.equal(v.length, 1)
    assert.equal(v[0].name, 'Talent Totalement Absent')
    assert.equal(v[0].ref, 'LDB 6')
  })
})

test('réf sans chapitre numérique résoluble (AA Annexe III) → hors sujet, jamais compté', () => {
  withTempDoc('### Artilleur (mise à jour AA)\n**Source :** AA Annexe III l.4457-4460  \n', (path) => {
    assert.equal(scanMissingEntities(path).length, 0)
  })
})

test('chapitre INTROUVABLE → hors sujet ici (périmètre check-refs/check-code-refs)', () => {
  withTempDoc('### Nawak\n**Source :** LDB 9999 p.1  \n', (path) => {
    assert.equal(scanMissingEntities(path).length, 0)
  })
})

test('parenthèse finale du titre retirée avant comparaison (annotation d\'édition, pas le nom RAW)', () => {
  withTempDoc('### Classes (mise à jour AA)\n**Source :** LDB 6 p.48  \n', (path) => {
    assert.equal(scanMissingEntities(path).length, 0)
  })
})

test('titre SANS ligne Source dans les 4 lignes suivantes → pas une entrée, ignoré', () => {
  withTempDoc('### Un titre de section\n\nDu texte qui ne cite rien.\n\n### Classes\n**Source :** LDB 6 p.48  \n', (path) => {
    assert.equal(scanMissingEntities(path).length, 0)
  })
})

test('entityNameFromHeader : parenthèse finale retirée, reste conservé tel quel', () => {
  assert.equal(entityNameFromHeader('Artilleur (mise à jour AA)'), 'Artilleur')
  assert.equal(entityNameFromHeader('Commandant d\'équipe (NOUVEAU AA)'), 'Commandant d\'équipe')
  assert.equal(entityNameFromHeader('Lire/Écrire'), 'Lire/Écrire')
})

test('normalizeLoose : markdown, accents et casse dépouillés', () => {
  assert.equal(normalizeLoose('**Empreint d\'*Ulgu***'), "empreint d'ulgu")
  assert.equal(normalizeLoose('Magié'), 'magie')
})

test('stripArticles : tolère « Empreint de la Magie » vs « Empreint de Magie » (#600, EDOC 13 l.254)', () => {
  assert.equal(stripArticles('empreint de la magie'), stripArticles('empreint de magie'))
  assert.equal(stripArticles(normalizeLoose("Empreint d'Ulgu")), stripArticles(normalizeLoose("Empreint d'Ulgu")))
})

test('countsByEntry + assertAgainstBaseline : hausse détectée, baisse détectée comme périmée', () => {
  const counts = countsByEntry([
    { doc: 'a.md', name: 'X' }, { doc: 'a.md', name: 'X' }, { doc: 'a.md', name: 'Y' },
  ])
  assert.deepEqual(counts, { 'a.md::X': 2, 'a.md::Y': 1 })
  const { over, stale } = assertAgainstBaseline(counts, { 'a.md::X': 1, 'a.md::Y': 1, 'a.md::Z': 5 })
  assert.equal(over.length, 1)
  assert.match(over[0], /a\.md::X/)
  assert.equal(stale.length, 1)
  assert.match(stale[0], /a\.md::Z/)
})

test('readBaseline : fichier absent → {} (zéro-tolérance nominale)', () => {
  assert.deepEqual(readBaseline(join(tmpdir(), 'inexistant-entity-in-chapter.json')), {})
})

test('non-régression : la VRAIE docs/raw/talents.md du repo est alignée sur sa baseline (#600 solde)', () => {
  assert.equal(BASELINE_PATH.endsWith('entity-in-chapter-baseline.json'), true)
  const counts = countsByEntry(scanAll())
  const { over, stale } = assertAgainstBaseline(counts, readBaseline())
  assert.deepEqual(over, [], `entrées dont le nom est absent du chapitre cité (tolérance baseline) :\n${over.join('\n')}`)
  assert.deepEqual(stale, [], `baseline(s) périmée(s) à abaisser :\n${stale.join('\n')}`)
})
