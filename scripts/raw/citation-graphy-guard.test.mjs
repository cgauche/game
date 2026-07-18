// Test du garde `citation-graphy-guard` (node --test) : la graphie chapitre-relative `NN-Nom l.X`
// est détectée sur fixture, les faux positifs plausibles (dates, ids composés) n'accrochent pas,
// et le VRAI `src/` du repo est à ZÉRO (#487 lot 3 — pas de baseline, régression = échec immédiat).
// Lancé par `npm run test:raw`.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, writeFileSync, mkdirSync, rmSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  scanGraphyViolations, scanDocsRawViolations, scanImplProseViolations, BOOK_NO_CHAPTER_RE,
  scanChDotViolations, scanBareFolioViolations, scanBookNoChapterSrcViolations, scanUnknownAbbrViolations,
  scanMultiFolioSplitViolations, scanChapterBoundaryFolioViolations, readBaseline, BASELINE_PATH,
} from './citation-graphy-guard.mjs'
import { otherAbbrAlternation, chapterBoundaryRisk } from './_lib.mjs'
import { countsByFile, assertAgainstBaseline } from './check-code-refs.mjs'

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
    'ok.md': 'forme canonique `AA 13 l.3574` et `MSRC 16 l.104-118`\n',
  }, (raw) => {
    const v = scanDocsRawViolations(raw).filter((x) => x.kind === 'book-no-chapter')
    assert.equal(v.length, 2)
    assert.deepEqual(v.map((x) => x.file.split('/').pop()).sort(), ['a.md', 'b.md'])
  })
})

test('docs/raw : LDB sans chapitre HORS périmètre (b) ; EDO/EDOC & MSR/MSRC désambiguïsés', () => {
  withTempRawDir({
    'x.md': ['LDB l.162 (LDB hors classe b, non listé)', 'EDOC l.101', 'EDO l.5', 'MSRC l.71', 'MSR l.9'].join('\n') + '\n',
  }, (raw) => {
    const kinds = scanDocsRawViolations(raw).filter((x) => x.kind === 'book-no-chapter').map((x) => x.text)
    assert.equal(kinds.length, 4) // EDOC, EDO, MSRC, MSR — pas LDB
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

test('docs/raw (b) : BOOK_NO_CHAPTER_RE DÉRIVE de otherAbbrAlternation (_lib.mjs), pas un duplicata (#434 défaut 10)', () => {
  assert.equal(BOOK_NO_CHAPTER_RE().source, `\\b(${otherAbbrAlternation()}) l\\.\\d`)
})

test('docs/raw (b) : identité stricte (#585 lot B) — MDG canonique détecté, anciennes graphies ADEII/Midd invisibles (hors alternation)', () => {
  withTempRawDir({
    'mdg.md': 'Requins-taureaux (MDG l.812)\n',
    'adeii.md': 'ogres : Langue Magick (ADEII l.653)\n',
    'midd.md': 'Loup Blanc (Midd l.3)\n',
  }, (raw) => {
    const v = scanDocsRawViolations(raw).filter((x) => x.kind === 'book-no-chapter')
    assert.deepEqual(v.map((x) => x.file.split('/').pop()).sort(), ['mdg.md'])
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

// --- scan (d) : prose d'état d'implémentation hors bloc de champ généré `**Implémente**` ---
test('docs/raw (d) singulier : « n\'est pas implémenté » / « non implémentée » hors champ → détecté', () => {
  withTempRawDir({
    'a.md': '## Sujet\n\nCe passage n\'est pas implémenté dans le moteur.\n',
    'b.md': '## Autre\n\nLa table n\'est pas encore implémentée côté code.\n',
  }, (raw) => {
    const v = scanImplProseViolations(raw)
    assert.equal(v.length, 2)
    assert.deepEqual(v.map((x) => x.file.split('/').pop()).sort(), ['a.md', 'b.md'])
  })
})

test('docs/raw (d) PLURIEL : « ne sont pas implémentés » (graphie qui échappait au regex historique) → détecté', () => {
  withTempRawDir({ 'a.md': '## Sujet\n\nCes effets ne sont pas implémentés.\n' }, (raw) => {
    assert.equal(scanImplProseViolations(raw).length, 1)
  })
})

test('docs/raw (d) : « non câblé / pas encore câblés » → détecté', () => {
  withTempRawDir({
    'a.md': '## X\n\nLe déclencheur est non câblé.\n',
    'b.md': '## Y\n\nCes triggers sont pas encore câblés.\n',
  }, (raw) => {
    assert.equal(scanImplProseViolations(raw).length, 2)
  })
})

test('docs/raw (d) : ligne DANS le bloc de champ généré `**Implémente**` → ignorée', () => {
  withTempRawDir({
    'a.md': '## Sujet\n\n**Implémente :** (non implémenté)\n- dette : #123\n\nProse RAW sans état.\n',
  }, (raw) => {
    assert.equal(scanImplProseViolations(raw).length, 0)
  })
})

test('docs/raw (d) : prose d\'état APRÈS la fin du bloc de champ (ligne vide) → détectée', () => {
  withTempRawDir({
    'a.md': '## Sujet\n\n**Implémente :** (non implémenté)\n\nCette règle n\'est pas implémentée par ailleurs.\n',
  }, (raw) => {
    const v = scanImplProseViolations(raw)
    assert.equal(v.length, 1)
    assert.match(v[0].text, /n'est pas implémentée/)
  })
})

test('docs/raw (d) : 00-index.md exclu (sa ligne de garde décrit le marqueur)', () => {
  withTempRawDir({
    '00-index.md': 'Le champ vaut `(non implémenté)` sinon — description du marqueur.\n',
    'combat.md': '## X\n\nCe passage n\'est pas implémenté.\n',
  }, (raw) => {
    const v = scanImplProseViolations(raw)
    assert.equal(v.length, 1)
    assert.equal(v[0].file.split('/').pop(), 'combat.md')
  })
})

test('docs/raw (d) : rapports (coverage/reconciliation/reanchor) et épreuves exclus', () => {
  withTempRawDir({
    'coverage.md': 'X n\'est pas implémenté\n',
    'reconciliation.md': 'X n\'est pas implémenté\n',
    'reanchor.md': 'X n\'est pas implémenté\n',
    'epreuve-x.md': 'X n\'est pas implémenté\n',
    'combat.md': '## S\n\nX n\'est pas implémenté\n',
  }, (raw) => {
    const v = scanImplProseViolations(raw)
    assert.equal(v.length, 1)
    assert.equal(v[0].file.split('/').pop(), 'combat.md')
  })
})

test('non-régression : le VRAI docs/raw/ du repo est à ZÉRO prose d\'état d\'implémentation (#487 suite, lot 1)', () => {
  const v = scanImplProseViolations()
  assert.deepEqual(
    v.map((x) => `${x.file}:${x.row}`),
    [],
    `prose(s) d'état d'implémentation survivante(s) :\n${v.map((x) => `  ${x.file}:${x.row}  ${x.text}`).join('\n')}`,
  )
})

test('non-régression : le VRAI docs/raw/ du repo est à ZÉRO graphie de fiche (#434 défaut 10)', () => {
  const v = scanDocsRawViolations()
  assert.deepEqual(
    v.map((x) => `${x.file}:${x.row}`),
    [],
    `graphie(s) de fiche survivante(s) :\n${v.map((x) => `  ${x.file}:${x.row}  [${x.kind}]  ${x.text}`).join('\n')}`,
  )
})

test('non-régression : le VRAI src/ du repo est à ZÉRO graphie chapitre-relative (#487 lot 1+2)', () => {
  const v = scanGraphyViolations()
  assert.deepEqual(
    v.map((x) => `${x.file}:${x.row}`),
    [],
    `graphie(s) chapitre-relative(s) survivante(s) :\n${v.map((x) => `  ${x.file}:${x.row}  ${x.text}`).join('\n')}`,
  )
})


// --- (#585 lot A) scan (e) : ch. cosmétique ---
function withTempSrcAndRawDir(srcFiles, rawFiles, fn) {
  const dir = mkdtempSync(join(tmpdir(), 'graphy-585-'))
  mkdirSync(join(dir, 'src'), { recursive: true })
  mkdirSync(join(dir, 'raw'), { recursive: true })
  for (const [name, content] of Object.entries(srcFiles)) writeFileSync(join(dir, 'src', name), content, 'utf8')
  for (const [name, content] of Object.entries(rawFiles)) writeFileSync(join(dir, 'raw', name), content, 'utf8')
  try { fn(join(dir, 'src'), join(dir, 'raw')) } finally { rmSync(dir, { recursive: true, force: true }) }
}

test('(e) ch. cosmétique : détecté en src (LDB ch.6) et en docs/raw (AA ch.7), forme sans ch. silencieuse', () => {
  withTempSrcAndRawDir(
    { 'x.ts': '// LDB ch.6 l.2 : forme déviante\n// LDB 6 l.2 : forme canonique, silence\n' },
    { 'combat.md': 'AA ch.7 l.4 déviant\nAA 7 l.4 canonique, silence\n' },
    (srcDir, rawDir) => {
      const v = scanChDotViolations(srcDir, ['.ts', '.tsx', '.json'], rawDir)
      assert.equal(v.length, 2)
      assert.deepEqual(v.map((x) => x.row).sort(), [1, 1])
    },
  )
})

test('(e) ch. cosmétique : rapports générés (coverage/reconciliation/reanchor) exclus des docs/raw', () => {
  withTempSrcAndRawDir({}, { 'coverage.md': 'AA ch.7 l.4\n' }, (srcDir, rawDir) => {
    assert.equal(scanChDotViolations(srcDir, ['.ts', '.tsx', '.json'], rawDir).length, 0)
  })
})

// --- (#585 lot A) scan (f) : folio NU ---
test('(f) folio nu : commentaire .ts détecté, titre de test (describe/it) hors périmètre (pas un commentaire)', () => {
  withTempSrcAndRawDir(
    {
      'x.ts': '// Amphibie (LDB p.338) : bonus au DR\n',
      'y.test.ts': "describe('Amphibie (LDB p.338)', () => {})\n",
    },
    {},
    (srcDir) => {
      const v = scanBareFolioViolations(srcDir, ['.ts', '.tsx', '.json'])
      assert.equal(v.length, 1)
      assert.equal(v[0].file.endsWith('x.ts'), true)
    },
  )
})

test('(f) folio nu : champ JSON "ref" détecté, "desc"/"source.note" hors périmètre (verbatim / convention folio-imprimé)', () => {
  withTempSrcAndRawDir({}, {}, (srcDir) => {
    const content = [
      '{',
      '  "ref": "LDB p.174",',
      '  "desc": "Une citation verbatim qui mentionne LDB p.174 dans le texte.",',
      '  "source": { "book": "livre-de-base", "page": 174, "note": "section continue LDB p.174-179" }',
      '}',
    ].join('\n') + '\n'
    writeFileSync(join(srcDir, 'a.json'), content, 'utf8')
    const v = scanBareFolioViolations(srcDir, ['.ts', '.tsx', '.json'])
    assert.equal(v.length, 1)
    assert.equal(v[0].row, 2)
  })
})

// --- (#585 lot A) scan (b) étendu à src ---
test('(b) étendu à src : réf de livre SANS chapitre détectée en .ts, forme avec chapitre silencieuse', () => {
  withTempSrcAndRawDir(
    { 'x.ts': '// EDOC l.172 : règle libre\n// EDOC 8 l.172 : forme canonique, silence\n' },
    {},
    (srcDir) => {
      const v = scanBookNoChapterSrcViolations(srcDir, ['.ts', '.tsx', '.json'])
      assert.equal(v.length, 1)
      assert.equal(v[0].row, 1)
    },
  )
})

// --- (#454 DoD) scans (b)/(f) étendus à docs/raw : la garde était auparavant AVEUGLE à ces fiches ---
test('(#454) (f) folio nu : détecté dans docs/raw (toute ligne, pas seulement commentaire/champ "ref"), forme chapitrée silencieuse', () => {
  withTempSrcAndRawDir(
    {},
    { 'combat.md': '**Source :** LDB p.339\n', 'ok.md': '**Source :** LDB 85 l.90\n' },
    (srcDir, rawDir) => {
      const v = scanBareFolioViolations(srcDir, ['.ts', '.tsx', '.json'], rawDir)
      assert.equal(v.length, 1)
      assert.equal(v[0].file.endsWith('combat.md'), true)
    },
  )
})

test('(#454) (f) folio nu : rapports générés (coverage/reconciliation/reanchor) et épreuves exclus de docs/raw', () => {
  withTempSrcAndRawDir({}, { 'coverage.md': 'LDB p.339\n' }, (srcDir, rawDir) => {
    assert.equal(scanBareFolioViolations(srcDir, ['.ts', '.tsx', '.json'], rawDir).length, 0)
  })
})

test('(#454) (b) étendu à docs/raw : réf de livre SANS chapitre détectée, forme avec chapitre silencieuse', () => {
  withTempSrcAndRawDir(
    {},
    { 'combat.md': 'EDOC l.172 : règle libre\n', 'ok.md': 'EDOC 8 l.172 : forme canonique, silence\n' },
    (srcDir, rawDir) => {
      const v = scanBookNoChapterSrcViolations(srcDir, ['.ts', '.tsx', '.json'], rawDir)
      assert.equal(v.length, 1)
      assert.equal(v[0].file.endsWith('combat.md'), true)
    },
  )
})

// --- (#585 lot A) scan (g) : abréviation INCONNUE (zéro tolérance, pas de baseline) ---
test('(g) abréviation inconnue : détectée nominativement, abréviation connue (LDB) silencieuse', () => {
  withTempSrcAndRawDir(
    { 'x.ts': '// RAW 16 l.105 : abréviation inventée\n// LDB 16 l.105 : abréviation connue, silence\n' },
    {},
    (srcDir, rawDir) => {
      const v = scanUnknownAbbrViolations(srcDir, ['.ts', '.tsx', '.json'], rawDir)
      assert.equal(v.length, 1)
      assert.equal(v[0].abbr, 'RAW')
    },
  )
})

test('(g) abréviation inconnue : ancienne graphie ADEII (tout capitales) EST désormais une inconnue (identité stricte, #585 lot B) ; "Midd" reste hors format (casse mixte, invisible d\'UNKNOWN_ABBR_RE)', () => {
  withTempSrcAndRawDir(
    { 'x.ts': '// ADEII 5 l.10, Midd 3 l.4 : anciennes graphies, plus tolérées\n' },
    {},
    (srcDir, rawDir) => {
      const v = scanUnknownAbbrViolations(srcDir, ['.ts', '.tsx', '.json'], rawDir)
      assert.equal(v.length, 1)
      assert.deepEqual(v.map((x) => x.abbr), ['ADEII'])
    },
  )
})

// --- (#522 juge adversarial) scan (h) : multi-folios à cheval sur un AUTRE chapitre ---
test('(h) multi-folio : LDB 64 p.301/303 (folios en chapitres DIFFÉRENTS : 64 vs 67) → détecté', () => {
  withTempSrcAndRawDir(
    { 'x.ts': '// Contenant d\'eau (Outre à eau/Seau, LDB 64 p.301/303) : forme fautive\n' },
    {},
    (srcDir) => {
      const v = scanMultiFolioSplitViolations(srcDir, ['.ts', '.tsx', '.json'])
      assert.equal(v.length, 1)
      assert.equal(v[0].row, 1)
      // 301 résout ch63 (l'ancre de folio vit dans le chapitre PRÉCÉDENT, ch64 n'a pas d'ancre propre)
      // et 303 résout ch66 — les deux diffèrent du chapitre ÉCRIT (64), donc tous deux fautifs.
      assert.deepEqual(v[0].folios.map((f) => f.folio), [301, 303])
    },
  )
})

test('(h) multi-folio : LDB 85 p.338-343 (même chapitre 85) → silence (forme saine)', () => {
  withTempSrcAndRawDir(
    { 'x.ts': '// Registre des Traits de créature (LDB 85 p.338-343) : forme saine\n' },
    {},
    (srcDir) => {
      const v = scanMultiFolioSplitViolations(srcDir, ['.ts', '.tsx', '.json'])
      assert.equal(v.length, 0)
    },
  )
})

test('(h) multi-folio : titre de test (describe/it) et hors-champ JSON hors périmètre (pas un commentaire/"ref")', () => {
  withTempSrcAndRawDir(
    { 'x.test.ts': "describe('Outre à eau (LDB 64 p.301/303)', () => {})\n" },
    {},
    (srcDir) => {
      assert.equal(scanMultiFolioSplitViolations(srcDir, ['.ts', '.tsx', '.json']).length, 0)
    },
  )
})

test('non-régression : le VRAI src/ du repo est à ZÉRO multi-folio à cheval sur un autre chapitre (#522)', () => {
  const v = scanMultiFolioSplitViolations()
  assert.deepEqual(
    v.map((x) => `${x.file}:${x.row}`),
    [],
    `multi-folio(s) fautif(s) survivant(s) :\n${v.map((x) => `  ${x.file}:${x.row}  ${JSON.stringify(x.folios)}  ${x.text}`).join('\n')}`,
  )
})

// --- (#454 juge adversarial) scan (i) : folio simple en fin de chapitre (AVERTISSEMENT cliqueté) ---
test('(i) chapterBoundaryRisk (pur, fixture synthétique) : dernier folio de N + N+1 ouvre sur X → risque', () => {
  const map = new Map([
    [10, [{ ch: 1, lo: 1, hi: 5 }]],
    [11, [{ ch: 1, lo: 6, hi: 10 }, { ch: 2, lo: 11, hi: 20 }]], // ch2 s'ouvre AUSSI sur 11 (même folio, contenu à cheval)
  ])
  assert.equal(chapterBoundaryRisk(map, 1, 11), true)
})

test('(i) chapterBoundaryRisk (pur) : N+1 ouvre sur X+1 (cas prouvé LDB 48→49 p.255→256) → risque', () => {
  const map = new Map([
    [10, [{ ch: 1, lo: 1, hi: 5 }]],
    [11, [{ ch: 1, lo: 6, hi: 10 }]],  // dernier folio du ch1 = 11
    [12, [{ ch: 2, lo: 11, hi: 20 }]], // ch2 s'ouvre sur 12 = X+1
  ])
  assert.equal(chapterBoundaryRisk(map, 1, 11), true)
})

test('(i) chapterBoundaryRisk (pur) : folio milieu de chapitre (pas le dernier) → pas de risque', () => {
  const map = new Map([
    [10, [{ ch: 1, lo: 1, hi: 5 }]],
    [11, [{ ch: 1, lo: 6, hi: 10 }]],
    [12, [{ ch: 2, lo: 11, hi: 20 }]],
  ])
  assert.equal(chapterBoundaryRisk(map, 1, 10), false)
})

test('(i) chapterBoundaryRisk (pur) : dernier folio de N mais N+1 s\'ouvre loin (X+5) → pas de risque', () => {
  const map = new Map([
    [10, [{ ch: 1, lo: 1, hi: 5 }]],
    [11, [{ ch: 1, lo: 6, hi: 10 }]],
    [16, [{ ch: 2, lo: 11, hi: 20 }]],
  ])
  assert.equal(chapterBoundaryRisk(map, 1, 11), false)
})

test('(i) scan : LDB 48 p.255 (cas PROUVÉ — Mauvais œil réellement en 49) → détecté ; LDB 49 p.255 (forme corrigée) → silence', () => {
  withTempSrcAndRawDir(
    { 'x.ts': '// Mauvais œil (LDB 48 p.255) forme fautive\n// Mauvais œil (LDB 49 p.255) forme corrigée\n' },
    {},
    (srcDir, rawDir) => {
      const v = scanChapterBoundaryFolioViolations(srcDir, ['.ts', '.tsx', '.json'], rawDir)
      assert.equal(v.length, 1)
      assert.equal(v[0].row, 1)
      assert.equal(v[0].abbr, 'LDB')
      assert.equal(v[0].ch, 48)
      assert.equal(v[0].folio, 255)
    },
  )
})

test('(i) scan : couverture étendue à docs/raw (fiches scannées, patron chDot/bareFolio)', () => {
  withTempSrcAndRawDir(
    {},
    { 'combat.md': 'Mauvais œil (LDB 48 p.255) forme fautive\n', 'ok.md': 'Mauvais œil (LDB 49 p.255) forme corrigée\n' },
    (srcDir, rawDir) => {
      const v = scanChapterBoundaryFolioViolations(srcDir, ['.ts', '.tsx', '.json'], rawDir)
      assert.equal(v.length, 1)
      assert.equal(v[0].file.endsWith('combat.md'), true)
    },
  )
})

test('(i) scan : forme multi-folio (LDB 64 p.301/303) hors périmètre (déjà couverte par le scan (h))', () => {
  withTempSrcAndRawDir(
    { 'x.ts': '// LDB 48 p.255/256 : suffixe multi-folio, jamais compté ici\n' },
    {},
    (srcDir, rawDir) => {
      assert.equal(scanChapterBoundaryFolioViolations(srcDir, ['.ts', '.tsx', '.json'], rawDir).length, 0)
    },
  )
})

// --- (#585 lot A) baseline PAR FICHIER, cliquetée (patron check-code-refs.mjs) ---
test('baseline graphy : hausse détectée, baisse détectée comme périmée (assertAgainstBaseline réutilisé)', () => {
  const counts = countsByFile([{ file: 'src/a.ts' }, { file: 'src/a.ts' }, { file: 'src/b.ts' }])
  const { over, stale } = assertAgainstBaseline(counts, { 'src/a.ts': 1, 'src/b.ts': 1, 'src/c.ts': 5 })
  assert.equal(over.length, 1)
  assert.equal(stale.length, 1)
})

test('non-régression : les 4 familles cliquetées (#585, #454) du VRAI repo sont alignées sur graphy-baseline.json', () => {
  const baseline = readBaseline()
  const families = [
    ['chDot', scanChDotViolations()],
    ['bareFolio', scanBareFolioViolations()],
    ['bookNoChapterSrc', scanBookNoChapterSrcViolations()],
    ['chapterBoundaryFolio', scanChapterBoundaryFolioViolations()],
  ]
  for (const [family, violations] of families) {
    const counts = countsByFile(violations)
    const { over, stale } = assertAgainstBaseline(counts, baseline[family] ?? {})
    assert.deepEqual(over, [], `${family} — hausse par fichier :\n${over.join('\n')}`)
    assert.deepEqual(stale, [], `${family} — baseline(s) périmée(s) :\n${stale.join('\n')}`)
  }
})

test('graphy-baseline.json existe (#585 lot A)', () => {
  assert.equal(existsSync(BASELINE_PATH), true)
})
