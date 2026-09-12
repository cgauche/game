// Test du garde `reconcile` (node --test). Lancé par `npm run test:raw`.
// CONTRAT vérifié ici, sur le VRAI dépôt (#434 défaut 9) : aucun chapitre ne reste « à lignes non
// pinées » — la liste attendue est VIDE. Le cliquet ne verrouille que la DIRECTION : une HAUSSE est
// une régression (un chapitre dont les réfs de code retombent hors des plages pinées de l'Atlas,
// ±TOL=20) ; une baisse ne vaut que PROUVÉE par des réfs ré-ancrées au `Source/`, jamais par un
// artefact de mesure.
// Les TROUS DURS sont jugés par le CLIQUET de `raw:reconcile` contre le STOCK NOMINATIF
// `reconciliation-stock.json` (#1709 D2) ; ce banc juge la direction FINE et le régime du cliquet.
// Le LDB n'a pas de voie de stock : son sens A est à tolérance ZÉRO, dans la GATE
// (`ecartsTrousDurs`, volet `pivot`) et verrouillé ici en régime, jamais en nombre.
// Les tests suivants fixent le vocabulaire de couverture : une fiche qui ne cite QU'en graphie FOLIO
// (`ABBR NN p.X`, #585/#606) crédite son chapitre via `folioSpan`/`folioRange`, à l'égal d'une réf ligne.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { computeReconciliation, trousDurs, ecartsTrousDurs, lireStock, STOCK_PATH } from './reconcile.mjs'

test('non-régression : Sens A LDB sur le vrai repo = 0 chapitre à lignes non pinées', () => {
  const data = computeReconciliation()
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

// --- CLIQUET des trous durs (#1709 lot D2, #925) : la gate rougit, et le stock décroît ---
// Les fixtures vivent DANS les tests : un littéral de PORTÉE MODULE qui nomme un fichier
// (`sample: [{ file: 'src/a.ts' }]`) est une entrée de stock pour la porte de plage
// (`scripts/guards/lib/stocksNominatifs.mjs`, `PORTEURS` couvre `scripts/**.test.mjs`) — seul le
// stock RAW doit être compté par cette porte.

test('cliquet : `trousDurs` nomme les TROIS familles (Sens A LDB, Sens A autres livres, Sens B2)', () => {
  const e = trousDurs({
    hardA: [{ ch: '6', count: 2, sample: [{ file: 'src/a.ts', row: 12 }] }],
    hardAOther: [{ book: 'AA', ch: '7', count: 1, sample: [{ file: 'src/b.ts', row: 3 }] }],
    atlasOnly: ['38'],
  })
  assert.deepEqual(e.map((x) => x.cle), ['LDB 6', 'AA 7', 'B2 LDB 38'])
  assert.deepEqual(e[0].sites, ['src/a.ts:12'])
  assert.deepEqual(e[2].sites, [])
})

test('cliquet : stock EXACT → aucun écart (ni neuve, ni périmée)', () => {
  const e = trousDurs({ hardAOther: [{ book: 'AA', ch: '7', count: 1, sample: [] }], atlasOnly: ['38'] })
  const { neuves, perimees } = ecartsTrousDurs(e, { 'AA 7': { quoi: 'dette instruite' }, 'B2 LDB 38': { quoi: 'dette instruite' } })
  assert.deepEqual(neuves, [])
  assert.deepEqual(perimees, [])
})

test('cliquet : trou dur NEUF (hors stock) → écart NOMINATIF portant le chapitre et ses sites', () => {
  const e = trousDurs({ hardAOther: [{ book: 'AA', ch: '7', count: 1, sample: [{ file: 'src/b.ts', row: 3 }] }] })
  const { neuves, perimees } = ecartsTrousDurs(e, {})
  assert.equal(neuves.length, 1)
  assert.match(neuves[0], /^AA 7 — 1 réf\(s\) de code, 0 dans l'Atlas · src\/b\.ts:3$/)
  assert.deepEqual(perimees, [])
})

test('cliquet : chapitre B2 neuf (Atlas hors-code) → écart nominatif, clé préfixée `B2`', () => {
  const { neuves } = ecartsTrousDurs(trousDurs({ atlasOnly: ['38'] }), {})
  assert.equal(neuves.length, 1)
  assert.match(neuves[0], /^B2 LDB 38 — chapitre décrit par l'Atlas/)
})

test('cliquet à DOUBLE SENS : entrée du stock SOLDÉE (plus de trou mesuré) → refus « stock à décroître »', () => {
  const stock = { 'AA 7': { quoi: 'dette soldée depuis', lot: '#1709 D2' } }
  const { neuves, perimees } = ecartsTrousDurs(trousDurs({}), stock)
  assert.deepEqual(neuves, [])
  assert.deepEqual(perimees, ['AA 7 — dette soldée depuis (#1709 D2)'])
})

test('cliquet : le livre PIVOT (LDB) n\'a PAS de voie de stock en Sens A — tolérance ZÉRO', () => {
  // CLAUDE.md règle 1 : « devoir rouvrir `Source/` = un défaut de l'Atlas à corriger ». Le LDB est le
  // livre pivot, couvert fiche à fiche par l'Atlas : un chapitre qu'il cite et que l'Atlas ignore se
  // CORRIGE. Les 14 autres livres n'ont pas cette couverture — leur dette se stocke, nommée et datée.
  for (const cle of Object.keys(lireStock())) assert.ok(!/^LDB /.test(cle), `le stock admet ${cle} : le LDB se corrige, il ne se stocke pas`)
  // (a) trou LDB observé, stock VIDE → refus nominatif par la GATE (volet `pivot`), pas seulement ici
  const trouLdb = trousDurs({ hardA: [{ ch: '6', count: 1, sample: [{ file: 'src/a.ts', row: 1 }] }] })
  const observe = ecartsTrousDurs(trouLdb, {})
  assert.deepEqual(observe.pivot, ["LDB 6 — 1 réf(s) de code, 0 dans l'Atlas · src/a.ts:1"])
  assert.deepEqual(observe.neuves, ["LDB 6 — 1 réf(s) de code, 0 dans l'Atlas · src/a.ts:1"])
  // (b) le stock qui PORTE `LDB 6` ne l'absout pas : l'entrée elle-même est refusée
  const stocke = ecartsTrousDurs(trouLdb, { 'LDB 6': { quoi: 'dette prétendue' } })
  assert.deepEqual(stocke.neuves, [], 'la clé est bien au stock…')
  assert.deepEqual(stocke.pivot, [
    "LDB 6 — 1 réf(s) de code, 0 dans l'Atlas · src/a.ts:1",
    'LDB 6 — entrée de stock INADMISSIBLE (dette prétendue)',
  ], '…et pourtant la gate refuse : le livre pivot se corrige, il ne se stocke pas')
  // (c) le sens B2 n'est PAS concerné : `B2 LDB 38` reste stockable
  assert.deepEqual(ecartsTrousDurs(trousDurs({ atlasOnly: ['38'] }), { 'B2 LDB 38': { quoi: 'dette instruite' } }).pivot, [])
})

test('cliquet : le STOCK COMMITTÉ couvre EXACTEMENT les trous durs du vrai repo (aucun neuf, aucun périmé)', () => {
  // Doublon ASSUMÉ du verdict de `npm run raw:reconcile` : cette lane-ci (`test:raw`) tourne dans la
  // lane des lecteurs de `docs/raw/`, l'autre en phase SÉRIE — un stock périmé par un commit voisin
  // se voit ici sans attendre l'écrivain, et le message nomme le remède au lieu d'un exit nu.
  const { neuves, perimees } = ecartsTrousDurs(trousDurs(computeReconciliation()), lireStock())
  assert.deepEqual(neuves, [], 'trou dur neuf : couvrir le chapitre dans l\'Atlas, ou instruire la dette au stock')
  assert.deepEqual(perimees, [], 'entrée périmée : retirer l\'entrée de reconciliation-stock.json')
})

test('cliquet : chaque entrée du stock nomme ses SITES, son LOT et sa DATE (jamais un régime)', () => {
  for (const [cle, e] of Object.entries(lireStock())) {
    assert.ok(Array.isArray(e.sites) && e.sites.length, `${cle} : aucun site nommé`)
    assert.ok(e.lot && /#\d+/.test(e.lot), `${cle} : lot absent`)
    assert.match(e.date ?? '', /^\d{4}-\d{2}-\d{2}$/, `${cle} : date absente`)
    assert.ok(e.quoi, `${cle} : dette non dite`)
  }
})

test('cliquet : le fichier de stock ABSENT vaut tolérance ZÉRO (lireStockJson), jamais un stock ouvert', () => {
  assert.deepEqual(lireStock(join(tmpdir(), 'stock-qui-nexiste-pas.json')), {})
  assert.ok(STOCK_PATH.endsWith('reconciliation-stock.json'))
})
