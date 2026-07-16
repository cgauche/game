// Test du garde `citation-graphy-guard` (node --test) : la graphie chapitre-relative `NN-Nom l.X`
// est détectée sur fixture, les faux positifs plausibles (dates, ids composés) n'accrochent pas,
// et le VRAI `src/` du repo est à ZÉRO (#487 lot 3 — pas de baseline, régression = échec immédiat).
// Lancé par `npm run test:raw`.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { scanGraphyViolations } from './citation-graphy-guard.mjs'

function withTempSrcDir(content, fn) {
  const dir = mkdtempSync(join(tmpdir(), 'graphy-guard-'))
  mkdirSync(join(dir, 'src'), { recursive: true })
  const file = join(dir, 'src', 'fixture.ts')
  writeFileSync(file, content, 'utf8')
  try { fn(join(dir, 'src')) } finally { rmSync(dir, { recursive: true, force: true }) }
}

test('graphie chapitre-relative simple (18-Traumatisme l.417) → détectée', () => {
  withTempSrcDir('// Faim (18-Traumatisme l.417-422) : sans nourriture ni boisson…\n', (srcDir) => {
    const v = scanGraphyViolations(srcDir)
    assert.equal(v.length, 1)
    assert.equal(v[0].row, 1)
    assert.match(v[0].text, /18-Traumatisme l\.417/)
  })
})

test('graphie abrégée (15-Dépl l.87) → détectée', () => {
  withTempSrcDir('// Sacrifier l\'Avantage (LDB 15-Dépl l.87)\n', (srcDir) => {
    const v = scanGraphyViolations(srcDir)
    assert.equal(v.length, 1)
  })
})

test('forme canonique LDB NN l.X (sans nom de chapitre) → silence', () => {
  withTempSrcDir('// Faim (LDB 18 l.337-343) : sans nourriture ni boisson…\n', (srcDir) => {
    const v = scanGraphyViolations(srcDir)
    assert.equal(v.length, 0)
  })
})

test('faux positif évité : une date ISO ne matche pas (chiffres des deux côtés du tiret)', () => {
  withTempSrcDir('// Décision utilisateur 2026-07-15 : reformulé après audit — l.42 mentionné ailleurs.\n', (srcDir) => {
    const v = scanGraphyViolations(srcDir)
    assert.equal(v.length, 0)
  })
})

test('faux positif évité : un id composé (ticket-42, variant-15) ne matche pas sans " l.<n>" collé', () => {
  withTempSrcDir("// Voir ticket-42 et variant-15 pour le contexte ; l.10 est une réf isolée sans lien.\n", (srcDir) => {
    const v = scanGraphyViolations(srcDir)
    assert.equal(v.length, 0)
  })
})

test('plusieurs fichiers, extensions .ts/.tsx/.json toutes scannées', () => {
  const dir = mkdtempSync(join(tmpdir(), 'graphy-guard-multi-'))
  mkdirSync(join(dir, 'src', 'sub'), { recursive: true })
  writeFileSync(join(dir, 'src', 'a.ts'), '// 07-Carrières l.45\n', 'utf8')
  writeFileSync(join(dir, 'src', 'sub', 'b.tsx'), '// 09-Compétences l.226\n', 'utf8')
  writeFileSync(join(dir, 'src', 'sub', 'c.json'), '{"note": "20-Maladies l.145"}\n', 'utf8')
  writeFileSync(join(dir, 'src', 'd.mjs'), '// 20-Maladies l.999 (extension hors périmètre, ignorée)\n', 'utf8')
  try {
    const v = scanGraphyViolations(join(dir, 'src'))
    assert.equal(v.length, 3)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('node_modules ignoré', () => {
  const dir = mkdtempSync(join(tmpdir(), 'graphy-guard-nm-'))
  mkdirSync(join(dir, 'src', 'node_modules'), { recursive: true })
  writeFileSync(join(dir, 'src', 'node_modules', 'x.ts'), '// 18-Traumatisme l.417\n', 'utf8')
  try {
    const v = scanGraphyViolations(join(dir, 'src'))
    assert.equal(v.length, 0)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('non-régression : le VRAI src/ du repo est à ZÉRO graphie chapitre-relative (#487 lot 1+2)', () => {
  const v = scanGraphyViolations()
  assert.deepEqual(
    v.map((x) => `${x.file}:${x.row}`),
    [],
    `graphie(s) chapitre-relative(s) survivante(s) :\n${v.map((x) => `  ${x.file}:${x.row}  ${x.text}`).join('\n')}`,
  )
})
