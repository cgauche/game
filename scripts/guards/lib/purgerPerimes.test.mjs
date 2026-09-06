// Contrats de `purgerPerimes` (#1679 L3b) : la source unique du bornage des dossiers de cache,
// appelée par `scripts/test/run.mjs` (captures) et `scripts/gates/toutes.mjs` (sorties de gate).
import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, mkdtempSync, rmSync, utimesSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { PEREMPTION_MS, purgerPerimes } from './purgerPerimes.mjs'

const atelier = () => mkdtempSync(join(tmpdir(), 'purger-perimes-'))

/** Pose un fichier daté de `ageJours` jours (mtime ET atime : `utimesSync` exige les deux). */
const poser = (dossier, nom, ageJours) => {
  const cible = join(dossier, nom)
  writeFileSync(cible, 'x')
  const t = (Date.now() - ageJours * 24 * 60 * 60 * 1000) / 1000
  utimesSync(cible, t, t)
  return cible
}

test('un fichier plus vieux que l’âge ET qui matche le motif est effacé', () => {
  const dossier = atelier()
  try {
    const vieux = poser(dossier, 'vitest-run-123.txt', 30)
    const efface = purgerPerimes({ dossier, motif: /^vitest-run-\d+\.txt$/, ageMs: PEREMPTION_MS })
    assert.equal(efface, 1)
    assert.equal(existsSync(vieux), false)
  } finally {
    rmSync(dossier, { recursive: true, force: true })
  }
})

test('un fichier JEUNE est gardé, même s’il matche', () => {
  const dossier = atelier()
  try {
    const jeune = poser(dossier, 'vitest-run-456.txt', 1)
    const efface = purgerPerimes({ dossier, motif: /^vitest-run-\d+\.txt$/, ageMs: PEREMPTION_MS })
    assert.equal(efface, 0)
    assert.equal(existsSync(jeune), true)
  } finally {
    rmSync(dossier, { recursive: true, force: true })
  }
})

test('un fichier vieux HORS motif est gardé', () => {
  const dossier = atelier()
  try {
    const hors = poser(dossier, 'durees.json', 30)
    const efface = purgerPerimes({ dossier, motif: /-\d+\.txt$/, ageMs: PEREMPTION_MS })
    assert.equal(efface, 0)
    assert.equal(existsSync(hors), true)
  } finally {
    rmSync(dossier, { recursive: true, force: true })
  }
})

test('un dossier ABSENT est un no-op (premier run d’un arbre neuf)', () => {
  const dossier = join(atelier(), 'jamais-cree')
  assert.equal(existsSync(dossier), false)
  assert.equal(purgerPerimes({ dossier, motif: /.*/, ageMs: PEREMPTION_MS }), 0)
})

test('les deux appelants réels passent leur propre motif — la fonction n’en connaît aucun', () => {
  const dossier = atelier()
  try {
    poser(dossier, 'vitest-run-1.txt', 30) // capture de suite
    const sortie = poser(dossier, 'typecheck-2.txt', 30) // sortie de gate
    assert.equal(purgerPerimes({ dossier, motif: /^vitest-run-\d+\.txt$/, ageMs: PEREMPTION_MS }), 1)
    assert.equal(existsSync(sortie), true)
    assert.equal(purgerPerimes({ dossier, motif: /-\d+\.txt$/, ageMs: PEREMPTION_MS }), 1)
    assert.equal(existsSync(sortie), false)
  } finally {
    rmSync(dossier, { recursive: true, force: true })
  }
})
