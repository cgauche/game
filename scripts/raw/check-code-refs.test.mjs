// Test du garde `check-code-refs` (node --test) : une réf plantée hors borne du chapitre résolu OU
// vers un chapitre introuvable est détectée dans le CODE, une réf valide reste silencieuse, et le
// cliquet NOMINATIF tient dans les deux sens. Le PLAFOND du stock vit ici, jamais dans la garde : un
// stock vide où la dette est encore ouverte serait une perte de mesure, et ce test la nomme.
// L'alignement du VRAI src/ sur ses stocks est mesuré ici ET par la gate `npm run raw:check-code-refs`
// (`main()` de check-code-refs.mjs). Lancé par `npm run test:raw`.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, writeFileSync, rmSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  scanDeadCodeRefs, scanEmptyLineCodeRefs, isExcludedSrc, readStock, sitesEnEntrees, cleDeSite,
  ecartDuVolet, STOCK_PATH, EMPTY_LINE_STOCK_PATH,
} from './check-code-refs.mjs'

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

test('sitesEnEntrees : deux sites de la MÊME réf dans le MÊME fichier se distinguent par leur OCCURRENCE', () => {
  const entrees = sitesEnEntrees([
    { file: 'src/a.ts', ref: 'LDB 6 l.2' },
    { file: 'src/a.ts', ref: 'LDB 6 l.2' },
    { file: 'src/b.ts', ref: 'LDB 6 l.2' },
  ])
  assert.deepEqual(entrees.map((e) => e.occurrence), [1, 2, 1])
  assert.equal(new Set(entrees.map(cleDeSite)).size, entrees.length, 'la clé doit distinguer chaque site')
  assert.equal(entrees.every((e) => !/:\d+$/.test(cleDeSite(e))), true, 'aucun numéro de ligne dans la clé')
})

test('écart : un site hors du stock est NEUF, une entrée sans site est SOLDÉE, les deux nommés', () => {
  const stock = [{ fichier: 'src/a.ts', ref: 'LDB 6 l.2', occurrence: 1 }, { fichier: 'src/c.ts', ref: 'LDB 6 l.2', occurrence: 1 }]
  const { neuves, perimees } = ecartDuVolet({
    sites: [{ file: 'src/a.ts', ref: 'LDB 6 l.2' }, { file: 'src/b.ts', ref: 'LDB 6 l.2' }],
    stock, ou: 'x-stock.json',
  })
  assert.equal(neuves.length, 1)
  assert.match(neuves[0], /src\/b\.ts/)
  assert.match(neuves[0], /site NEUF/)
  assert.match(neuves[0], /CLIQUET:/)
  assert.equal(perimees.length, 1)
  assert.match(perimees[0], /src\/c\.ts/)
  assert.match(perimees[0], /entrée SOLDÉE/)
})

test('écart : un stock qui décrit EXACTEMENT les sites observés ne dit rien', () => {
  const { neuves, perimees } = ecartDuVolet({
    sites: [{ file: 'src/a.ts', ref: 'LDB 6 l.2' }, { file: 'src/a.ts', ref: 'LDB 6 l.2' }],
    stock: [
      { fichier: 'src/a.ts', ref: 'LDB 6 l.2', occurrence: 1 },
      { fichier: 'src/a.ts', ref: 'LDB 6 l.2', occurrence: 2 },
    ],
    ou: 'x-stock.json',
  })
  assert.deepEqual([neuves, perimees], [[], []])
})

test('readStock : fichier absent → aucune entrée (zéro-tolérance), fichier présent → ses entrées', () => {
  assert.deepEqual(readStock(join(tmpdir(), 'inexistant-check-code-refs.json')), [])
  withTempSrcDir('_unused.ts', '', (dir) => {
    const path = join(dir, 'stock.json')
    writeFileSync(path, '{"entrees":[{"fichier":"src/a.ts","ref":"LDB 6 l.2","occurrence":1}]}', 'utf8')
    assert.deepEqual(readStock(path).map(cleDeSite), [' :: src/a.ts :: LDB 6 l.2 :: 1'])
  })
})

// Les QUATRE gestes qu'un auteur peut faire sur le stock RÉEL, et ce que chaque porte en dit (sonde
// du juge de diff, 2026-09-12, promue). Le stock sert de MODÈLE de sites : rien n'est écrit sur le
// disque, et aucun cardinal n'est figé — c'est la RELATION entre geste et verdict qui est le contrat.
test('stock réel — les quatre gestes : site neuf, entrée ajoutée, occurrence relevée, stock vidé', () => {
  const stock = readStock(EMPTY_LINE_STOCK_PATH)
  assert.ok(stock.length > 0, 'stock vide : la sonde jugerait par vacuité')
  const sitesDuStock = stock.map((e) => ({ file: e.fichier, ref: e.ref }))
  const ou = 'empty-line-code-refs-stock.json'

  const neuf = ecartDuVolet({ sites: [...sitesDuStock, { file: 'src/engine/ops.ts', ref: 'LDB 99 l.1' }], stock, ou })
  assert.equal(neuf.neuves.length, 1, 'un site jamais déclaré doit sortir SEUL')
  assert.match(neuf.neuves[0], /src\/engine\/ops\.ts :: LDB 99 l\.1 :: 1 — site NEUF/)
  assert.deepEqual(neuf.perimees, [])

  const declare = ecartDuVolet({
    sites: [...sitesDuStock, { file: 'src/engine/ops.ts', ref: 'LDB 99 l.1' }],
    stock: [...stock, { fichier: 'src/engine/ops.ts', ref: 'LDB 99 l.1', occurrence: 1 }], ou,
  })
  assert.deepEqual([declare.neuves, declare.perimees], [[], []], 'déclarer l’entrée éteint la garde — et la porte de plage, elle, compte la ligne ajoutée')

  const releve = ecartDuVolet({
    sites: sitesDuStock,
    stock: stock.map((e, i) => (i === 0 ? { ...e, occurrence: e.occurrence + 1 } : e)), ou,
  })
  assert.equal(releve.neuves.length, 1, 'une occurrence relevée découvre le site qu’elle abandonne')
  assert.equal(releve.perimees.length, 1, 'et laisse une entrée que plus aucun site ne porte')

  const vide = ecartDuVolet({ sites: sitesDuStock, stock: [], ou })
  assert.equal(vide.neuves.length, sitesDuStock.length, 'stock vidé : tolérance ZÉRO, chaque site redevient neuf')
  assert.deepEqual(vide.perimees, [])
})

test('non-régression : les sites de réf sur ligne VIDE du VRAI src/ sont exactement ceux du stock', () => {
  const stock = readStock(EMPTY_LINE_STOCK_PATH)
  assert.ok(stock.length > 0, 'le stock des réfs sur ligne vide est une dette encore ouverte : un stock vide ici serait une perte de mesure')
  const { neuves, perimees } = ecartDuVolet({
    sites: scanEmptyLineCodeRefs(), stock, ou: 'empty-line-code-refs-stock.json',
  })
  assert.deepEqual(neuves, [], `site(s) NEUF(s) :\n${neuves.join('\n')}`)
  assert.deepEqual(perimees, [], `entrée(s) SOLDÉE(s) :\n${perimees.join('\n')}`)
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

test('régime ZÉRO-TOLÉRANCE (#583) : dead-code-refs-stock.json reste ABSENT', () => {
  assert.equal(existsSync(STOCK_PATH), false, 'dead-code-refs-stock.json doit rester ABSENT (zéro-tolérance) — sa réapparition doit porter, dans chaque entrée, le résidu irréductible qu\'elle déclare')
})
