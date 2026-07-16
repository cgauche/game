// Test du garde `citation-graphy-guard` (node --test) : la graphie chapitre-relative `NN-Nom l.X`
// est détectée sur fixture, les faux positifs plausibles (dates, ids composés) n'accrochent pas,
// et le VRAI `src/` du repo est à ZÉRO (#487 lot 3 — pas de baseline, régression = échec immédiat).
// Lancé par `npm run test:raw`.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { scanGraphyViolations, scanDocsRawViolations } from './citation-graphy-guard.mjs'

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

// --- scans docs/raw (#434) : plage à tiret cadratin (a) + réf de livre sans chapitre (b) ---
function withTempRawDir(files, fn) {
  const dir = mkdtempSync(join(tmpdir(), 'graphy-docs-'))
  mkdirSync(join(dir, 'raw'), { recursive: true })
  for (const [name, content] of Object.entries(files)) writeFileSync(join(dir, 'raw', name), content, 'utf8')
  try { fn(join(dir, 'raw')) } finally { rmSync(dir, { recursive: true, force: true }) }
}

test('docs/raw (a) : plage à tiret cadratin (l.417–422 / l.417—422) → détectée, tiret-moins silencieux', () => {
  withTempRawDir({
    'en.md': 'Faim (LDB 18 l.417–422) en cadratin\n',   // en-dash U+2013
    'em.md': 'Soif (LDB 18 l.417—422) em-cadratin\n',    // em-dash U+2014
    'ok.md': 'Faim (LDB 18 l.417-422) tiret-moins\n',     // hyphen-minus → canonique
  }, (raw) => {
    const v = scanDocsRawViolations(raw).filter((x) => x.kind === 'emdash-range')
    assert.equal(v.length, 2)
    assert.deepEqual(v.map((x) => x.file.split('/').pop()).sort(), ['em.md', 'en.md'])
  })
})

test('docs/raw (b) : réf de livre SANS chapitre (AA l.4395, ADE II l.653) → détectée ; avec chapitre → silence', () => {
  withTempRawDir({
    'a.md': 'Art (Écriture) (AA l.3574)\n',
    'b.md': 'ogres : Langue Magick (ADE II l.653)\n',
    'ok.md': 'forme canonique `AA 13 l.3574` et `T2C 16 l.104-118`\n',
  }, (raw) => {
    const v = scanDocsRawViolations(raw).filter((x) => x.kind === 'book-no-chapter')
    assert.equal(v.length, 2)
    assert.deepEqual(v.map((x) => x.file.split('/').pop()).sort(), ['a.md', 'b.md'])
  })
})

test('docs/raw : LDB sans chapitre HORS périmètre (b) ; EDO/EDOC & T2/T2C désambiguïsés', () => {
  withTempRawDir({
    'x.md': ['LDB l.162 (LDB hors classe b, non listé)', 'EDOC l.101', 'EDO l.5', 'T2C l.71', 'T3 l.9'].join('\n') + '\n',
  }, (raw) => {
    const kinds = scanDocsRawViolations(raw).filter((x) => x.kind === 'book-no-chapter').map((x) => x.text)
    assert.equal(kinds.length, 4) // EDOC, EDO, T2C, T3 — pas LDB
    assert.ok(!kinds.some((t) => /^LDB /.test(t)))
  })
})

test('docs/raw (c) : nom de fichier de chapitre en backticks (`08 - Titre.md` l.89) → détecté ; réf nue → silence', () => {
  withTempRawDir({
    'a.md': '**Source :** ADE II `08 - Le théâtre de la guerre.md` l.89-131.\n',
    'b.md': '**Source :** ADE II `09 - Annexe I.md` l.32-33.\n',
    'ok.md': 'forme canonique `ADE II 8 l.89-131`.\n',
  }, (raw) => {
    const v = scanDocsRawViolations(raw).filter((x) => x.kind === 'backtick-file')
    assert.equal(v.length, 2)
    assert.deepEqual(v.map((x) => x.file.split('/').pop()).sort(), ['a.md', 'b.md'])
  })
})

test('docs/raw : rapports (coverage/reconciliation/reanchor) et épreuves exclus des scans', () => {
  withTempRawDir({
    'coverage.md': 'AA l.4395\n',
    'reconciliation.md': 'AA l.4395\n',
    'reanchor.md': 'AA l.4395\n',
    'epreuve-x.md': 'AA l.4395\n',
    'combat.md': 'AA l.4395\n',
  }, (raw) => {
    const v = scanDocsRawViolations(raw)
    assert.equal(v.length, 1)
    assert.equal(v[0].file.split('/').pop(), 'combat.md')
  })
})

test('non-régression : le VRAI src/ du repo est à ZÉRO graphie chapitre-relative (#487 lot 1+2)', () => {
  const v = scanGraphyViolations()
  assert.deepEqual(
    v.map((x) => `${x.file}:${x.row}`),
    [],
    `graphie(s) chapitre-relative(s) survivante(s) :\n${v.map((x) => `  ${x.file}:${x.row}  ${x.text}`).join('\n')}`,
  )
})
