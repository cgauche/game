// Le MARQUEUR d'intégration d'un livre : ce qu'`apply-livre.mjs` ÉCRIT doit être ce que
// `build-catalogs.mjs` / `merge-docs.mjs` RELISENT — pour TOUT sigle du registre, pas pour ceux
// dont la graphie tombait par chance dans une classe de caractères écrite à la main.
// Le défaut mesuré : `/^<!-- ([A-Z0-9_-]+-INTEGRATION) -->/` laissait tomber en SILENCE tout sigle
// à espace, à minuscule ou à point — le correctif manuel disparaissait à la régénération suivante.
// Aucun sigle en dur ici : la boucle parcourt le registre RÉEL.
import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { REGISTRE_LIVRES, estLivreExtrait, marqueurIntegration, marqueurIntegrationFin } from './_lib.mjs'
import { BLOCK_START, extractPreservedBlocks } from './build-catalogs.mjs'

const SIGLES = REGISTRE_LIVRES.filter(estLivreExtrait).map((b) => b.abbr)

test('registre : au moins un sigle porte une graphie hors `[A-Z0-9_-]` (le défaut n’est pas théorique)', () => {
  const hors = SIGLES.filter((a) => !/^[A-Z0-9_-]+$/.test(a))
  assert.ok(hors.length > 0, `aucun sigle hors classe — la garde ne mesurerait rien (sigles : ${SIGLES.join(', ')})`)
})

test('marqueur : pour CHAQUE livre extrait du registre, le bloc écrit est relu par extractPreservedBlocks', () => {
  const dir = mkdtempSync(join(tmpdir(), 'apply-livre-'))
  try {
    const rates = []
    for (const abbr of SIGLES) {
      const debut = marqueurIntegration(abbr)
      const path = join(dir, 'catalogue-fixture.md')
      writeFileSync(path, [
        '# Catalogue fixture', '', '## [X 1] Un chapitre', 'corps', '',
        '---', debut, 'correctif MANUEL', marqueurIntegrationFin(abbr), '',
      ].join('\n'), 'utf8')
      const blocs = extractPreservedBlocks(path)
      if (blocs.length !== 1 || !blocs[0].includes(debut) || !BLOCK_START.test(debut)) rates.push(`${abbr} (${blocs.length} bloc(s))`)
    }
    assert.deepEqual(rates, [], `marqueurs écrits mais NON relus — leur correctif manuel serait effacé : ${rates.join(', ')}`)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('marqueur : le tag capturé est le sigle, et un sigle HORS registre n’ouvre aucun bloc', () => {
  assert.equal(BLOCK_START.exec(marqueurIntegration(SIGLES[0]))[1], `${SIGLES[0]}-INTEGRATION`)
  assert.equal(BLOCK_START.test(marqueurIntegration('SIGLE-QUI-NEXISTE-PAS')), false)
})

test('estLivreExtrait : un livre sans `dir` est refusé par le même prédicat que le périmètre', () => {
  const sansDir = REGISTRE_LIVRES.filter((b) => b.abbr && !estLivreExtrait(b))
  assert.ok(sansDir.length > 0, 'le registre ne porte aucun livre sans extraction — le cas n’est pas mesuré')
  assert.deepEqual(sansDir.filter(estLivreExtrait), [])
})
