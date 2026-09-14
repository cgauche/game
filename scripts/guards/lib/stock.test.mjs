// Test de la PRIMITIVE de stock nominatif (node --test) : la CLÉ d'un site, l'ordinal d'occurrence,
// et les deux sens de l'écart avec leur REMÈDE. Ce que vérifient ici les gardes qui en dépendent
// (check-code-refs, citation-graphy-guard, reanchor, check-refs, check-folio-continuity, le cliquet
// `littéral == jeton` des tenues) est le CONTRAT, jamais un compte : les plafonds vivent dans le test
// de chaque garde — quand il en reste un. Lancé par `npm run test:hooks`.
// `ecartsDeStock`, `champsAveugles`, `couvertureDuBalayage` et `lignesMalQualifiees` du même module
// sont tenus par `src/stock-primitive.test.ts` (vitest).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { cleDeSite, ecartDuVolet, sitesEnEntrees } from './stock.mjs'

test('sitesEnEntrees : deux sites de la MÊME réf dans le MÊME fichier se distinguent par leur OCCURRENCE', () => {
  const entrees = sitesEnEntrees([
    { file: 'src/a.ts', ref: 'LDB 6 l.2' },
    { file: 'src/a.ts', ref: 'LDB 6 l.2' },
    { file: 'src/b.ts', ref: 'LDB 6 l.2' },
  ])
  assert.deepEqual(entrees.map((e) => e.occurrence), [1, 2, 1])
  assert.equal(new Set(entrees.map(cleDeSite)).size, entrees.length, 'la clé doit distinguer chaque site')
})

// La LIGNE DU FICHIER PORTEUR n'entre pas dans la clé : deux sites de même (fichier, réf) écrits à
// des lignes différentes ne se distinguent QUE par leur occurrence — c'est ce qui rend une entrée
// survivante à l'édition du fichier qui la porte. La ligne CITÉE (`l.2`, dans `Source/`), elle,
// appartient à la réf, donc à la clé.
test('cleDeSite : la ligne du fichier PORTEUR n’entre pas dans la clé — seule l’occurrence sépare deux homonymes', () => {
  const enHaut = sitesEnEntrees([{ file: 'src/a.ts', ref: 'LDB 6 l.2', row: 12 }, { file: 'src/a.ts', ref: 'LDB 6 l.2', row: 300 }])
  const deplaces = sitesEnEntrees([{ file: 'src/a.ts', ref: 'LDB 6 l.2', row: 480 }, { file: 'src/a.ts', ref: 'LDB 6 l.2', row: 902 }])
  assert.deepEqual(enHaut.map(cleDeSite), deplaces.map(cleDeSite), 'déplacer les deux sites dans leur fichier ne change aucune clé')
  assert.deepEqual(enHaut.map(cleDeSite), [' :: src/a.ts :: LDB 6 l.2 :: 1', ' :: src/a.ts :: LDB 6 l.2 :: 2'])
  assert.equal(
    ecartDuVolet({ sites: [{ file: 'src/a.ts', ref: 'LDB 6 l.2', row: 902 }], stock: [{ fichier: 'src/a.ts', ref: 'LDB 6 l.2', occurrence: 1 }], ou: 'x-stock.json' }).neuves.length,
    0, 'un site déplacé dans son fichier reste couvert par son entrée',
  )
  assert.equal(
    ecartDuVolet({ sites: [{ file: 'src/a.ts', ref: 'LDB 6 l.3' }], stock: [{ fichier: 'src/a.ts', ref: 'LDB 6 l.2', occurrence: 1 }], ou: 'x-stock.json' }).neuves.length,
    1, 'la ligne CITÉE, elle, appartient à la clé : l.2 → l.3 est un autre site',
  )
})

// La clé NOMME son fichier, et c'est ce qui rend l'entrée visible à la porte de plage
// (`croissanceDesStocks`) : une entrée dont le `fichier` ne serait pas un chemin ne coûterait rien à
// ajouter. La mesure de cette visibilité vit sur les porteurs réels
// (`scripts/hooks/stocks-nominatifs.test.mjs`) ; ici, le contrat de la clé.
test('cleDeSite : le FICHIER est dans la clé, avant la réf et l’occurrence', () => {
  assert.equal(
    cleDeSite({ fichier: 'src/gameIso/rig/parts/tenues/defs/Bailli.ts', ref: 'bailli:torse:front', occurrence: 3 }),
    ' :: src/gameIso/rig/parts/tenues/defs/Bailli.ts :: bailli:torse:front :: 3',
  )
  assert.equal(
    cleDeSite({ famille: 'graphy', fichier: 'src/a.ts', ref: 'LDB 6 l.2', occurrence: 1 }),
    'graphy :: src/a.ts :: LDB 6 l.2 :: 1', 'la famille ouvre la clé quand la garde en distingue',
  )
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

// Une entrée dont AUCUN champ ne nomme (faute de saisie, champ renommé) rend une clé réduite à ses
// séparateurs : le refus désigne alors une entrée que le lecteur ne peut pas retrouver dans son
// fichier de stock. Le remède la CITE en JSON — le seul texte qui la localise.
test('écart : une entrée périmée qui ne NOMME rien est citée en JSON, jamais par une clé vide', () => {
  const bidon = { occurrence: 1, lot: '#1711', date: '2026-09-12' }
  const { perimees } = ecartDuVolet({ sites: [], stock: [bidon], ou: 'x-stock.json' })
  assert.equal(perimees.length, 1)
  assert.ok(
    perimees[0].startsWith(JSON.stringify(bidon)),
    `le refus doit citer l’entrée elle-même, il dit : ${perimees[0]}`,
  )
  assert.match(perimees[0], /entrée SOLDÉE/)
  const nommee = ecartDuVolet({ sites: [], stock: [{ fichier: 'src/a.ts', ref: 'LDB 6 l.2', occurrence: 1 }], ou: 'x-stock.json' })
  assert.match(nommee.perimees[0], /^ :: src\/a\.ts :: LDB 6 l\.2 :: 1 —/, 'une entrée qui nomme garde sa CLÉ')
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
