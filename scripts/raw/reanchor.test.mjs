// Test du GATE `reanchor.mjs` (#434 défaut 1 — « une réf verte peut pointer sur le mauvais texte »,
// node --test). Le cas réel (`e0cf886a` → `c54ba899`) : une réf `ZI 13 l.954` pointait sur un texte
// hors-sujet, quand le vrai passage vivait en `ZI 2 l.68` — `reanchor.mjs` l'avait dans son rapport
// (LOW + « texte trouvé en ZI 2 l.68 ») mais ne bloquait rien. Lancé par `npm run test:raw`.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { basename, join } from 'node:path'
import { ecartDuVolet } from '../guards/lib/stock.mjs'
import { readStock } from './stockNominatif.mjs'
import { buildIndex, classifyQuote, continuations, scan, sitesLow, RAWDIR, LOW_STOCK_PATH } from './reanchor.mjs'
import { avecAtlasFixture } from './atlasFixture.mjs'

// La fiche vit SOUS un cœur : un Atlas est PARTITIONNÉ, et la couture refuse une page de règles
// posée à sa racine. Fabrique PARTAGÉE avec les autres bancs de lecteurs (`atlasFixture.mjs`).
const withTempRawDir = (content, fn) =>
  avecAtlasFixture({ 'fixture.md': content }, (dir, coeur) => fn(dir, `${coeur}/fixture.md`), { prefixe: 'reanchor-' })

// ---------- classifyQuote (pur, fixtures synthétiques — reproduit la FORME du bug réel) ----------

test('citation absente ici mais présente dans un AUTRE chapitre → LOW, réf trouvée pointée en réponse (cas réel ZI 13→ZI 2)', () => {
  // « chapitre 13 » ne contient PAS le texte cité (topic Fouissement hors-sujet, comme le vrai bug).
  const li13 = buildIndex(['Introduction du chapitre.', '**DR nécessaires :** 18', 'Suite sans rapport.'])
  // « chapitre 2 » contient le VRAI texte, à la ligne 68 dans le cas réel — ici une ligne connue de la fixture.
  const _li2 = buildIndex(['pad', 'Cette créature peut se déplacer en creusant un tunnel dans le sol meuble.'])
  const findCross = () => ({ label: 'ZI 2 l.68' })   // simule crossChapter() ayant trouvé l'unique occurrence
  const r = classifyQuote(li13, 954, 'Cette créature peut se déplacer en creusant un tunnel dans le sol meuble.', findCross)
  assert.equal(r.status, 'LOW')
  assert.match(r.reason, /texte trouvé en ZI 2 l\.68/)
})

test('citation absente ici et nulle part ailleurs → LOW, "aucune occurrence"', () => {
  const li = buildIndex(['Rien à voir avec la citation cherchée.'])
  const r = classifyQuote(li, 1, 'Une phrase suffisamment longue pour être une ancre verbatim valide.', () => null)
  assert.equal(r.status, 'LOW')
  assert.equal(r.reason, 'aucune occurrence')
})

test('citation juste à la ligne citée → OK, silencieux', () => {
  const li = buildIndex(['avant', 'Une phrase suffisamment longue pour être une ancre verbatim valide.', 'après'])
  const r = classifyQuote(li, 2, 'Une phrase suffisamment longue pour être une ancre verbatim valide.', () => null)
  assert.equal(r.status, 'OK')
})

test('citation présente mais à une AUTRE ligne du MÊME chapitre → DRIFT (réparable --apply)', () => {
  const li = buildIndex(['avant', 'Une phrase suffisamment longue pour être une ancre verbatim valide.', 'après'])
  const r = classifyQuote(li, 3, 'Une phrase suffisamment longue pour être une ancre verbatim valide.', () => null)
  assert.equal(r.status, 'DRIFT')
  assert.equal(r.foundStart, 2)
})

test('citation dupliquée (occurrences multiples) → MEDIUM, jamais auto-résolu', () => {
  const li = buildIndex([
    'Une phrase suffisamment longue pour être une ancre verbatim valide.',
    'x',
    'Une phrase suffisamment longue pour être une ancre verbatim valide.',
  ])
  const r = classifyQuote(li, 1, 'Une phrase suffisamment longue pour être une ancre verbatim valide.', () => null)
  assert.equal(r.status, 'MEDIUM')
  assert.deepEqual(r.candidates, [1, 3])
})

// ---------- scan() bout en bout (docs/raw temporaire + chapitre RÉEL LDB 6, patron check-refs.test.mjs) ----------

const LDB6_LINE5 = "*(Page 48 partagée avec un chapitre voisin — le contenu de cette section figure dans le chapitre adjacent de l'extraction Marker.)*"

test('scan() : citation juste → silencieuse (pas de ligne LOW, pas dans lowRows)', () => {
  const md = `Une note.\n> « ${LDB6_LINE5} »\n> \`LDB 6 l.5\`\n`
  withTempRawDir(md, (dir) => {
    const r = scan(dir, {})
    assert.equal(r.tally.OK, 1)
    assert.equal(r.tally.LOW, 0)
    assert.equal(r.lowRows.length, 0)
  })
})

test('scan() : citation introuvable dans le chapitre cité → LOW, alimente lowRows (unité du cliquet)', () => {
  const md = `Une note.\n> « Une phrase qui n'existe nulle part dans ce chapitre source. »\n> \`LDB 6 l.5\`\n`
  withTempRawDir(md, (dir, relatif) => {
    const r = scan(dir, {})
    assert.equal(r.tally.LOW, 1)
    assert.equal(r.lowRows.length, 1)
    assert.equal(basename(r.lowRows[0].doc), 'fixture.md', 'le site NOMME la fiche où la réf est lue')
    assert.equal(r.lowRows[0].doc, `${dir.split('\\').join('/')}/${relatif}`, 'chemin de la fiche depuis la racine du balayage, CŒUR COMPRIS, en séparateurs /')
    assert.equal(r.lowRows[0].full, 'LDB 6 l.5', 'et la RÉF CITÉE telle qu’écrite')
    assert.deepEqual(sitesLow(r.lowRows), [{ file: r.lowRows[0].doc, ref: 'LDB 6 l.5' }])
  })
})

test('scan() : citation présente mais à une autre ligne du chapitre RÉEL → DRIFT (réparable, jamais silencieux)', () => {
  const md = `Une note.\n> « ${LDB6_LINE5} »\n> \`LDB 6 l.3\`\n`
  withTempRawDir(md, (dir) => {
    const r = scan(dir, {})
    assert.equal(r.tally.DRIFT, 1)
    assert.equal(r.tally.OK, 0)
  })
})

// ---------- cliquet NOMINATIF (mêmes primitives que check-code-refs.mjs / citation-graphy-guard.mjs) ----------

test('écart : un site ❌ LOW hors du stock est NEUF, une entrée sans site est SOLDÉE, les deux nommés', () => {
  const { neuves, perimees } = ecartDuVolet({
    sites: sitesLow([{ doc: 'docs/raw/4e/bestiaire.md', full: 'ZI 13 l.954' }]),
    stock: [{ fichier: 'docs/raw/4e/magie.md', ref: 'LDB 6 l.5', occurrence: 1 }],
    ou: 'reanchor-low-stock.json',
  })
  assert.equal(neuves.length, 1)
  assert.match(neuves[0], /docs\/raw\/[\w-]+\/bestiaire\.md :: ZI 13 l\.954 :: 1 — site NEUF/)
  assert.match(neuves[0], /CLIQUET:/)
  assert.equal(perimees.length, 1)
  assert.match(perimees[0], /docs\/raw\/[\w-]+\/magie\.md/)
  assert.match(perimees[0], /entrée SOLDÉE/)
})

test('écart : deux sites de la MÊME réf dans la MÊME fiche se distinguent par leur OCCURRENCE', () => {
  const sites = sitesLow([
    { doc: 'docs/raw/4e/bestiaire.md', full: 'ZI 13 l.954' },
    { doc: 'docs/raw/4e/bestiaire.md', full: 'ZI 13 l.954' },
  ])
  const stock = [
    { fichier: 'docs/raw/4e/bestiaire.md', ref: 'ZI 13 l.954', occurrence: 1 },
    { fichier: 'docs/raw/4e/bestiaire.md', ref: 'ZI 13 l.954', occurrence: 2 },
  ]
  const couvert = ecartDuVolet({ sites, stock, ou: 'reanchor-low-stock.json' })
  assert.deepEqual([couvert.neuves, couvert.perimees], [[], []], 'deux entrées d’occurrences distinctes couvrent les deux sites')
  const { neuves } = ecartDuVolet({ sites, stock: stock.slice(0, 1), ou: 'reanchor-low-stock.json' })
  assert.equal(neuves.length, 1, 'le second site n’est pas couvert par l’entrée du premier')
})

// Les QUATRE gestes qu'un auteur peut faire sur le stock RÉEL, et ce que chaque porte en dit. Le
// stock sert de MODÈLE de sites : rien n'est écrit sur le disque, et aucun cardinal n'est figé —
// c'est la RELATION entre geste et verdict qui est le contrat.
test('stock réel — les quatre gestes : site neuf, entrée ajoutée, occurrence relevée, stock vidé', () => {
  const stock = readStock(LOW_STOCK_PATH)
  assert.ok(stock.length > 0, 'stock vide : la sonde jugerait par vacuité')
  const sitesDuStock = stock.map((e) => ({ file: e.fichier, ref: e.ref }))
  const ou = 'reanchor-low-stock.json'

  const neuf = ecartDuVolet({ sites: [...sitesDuStock, { file: 'docs/raw/4e/combat.md', ref: 'LDB 99 l.1' }], stock, ou })
  assert.equal(neuf.neuves.length, 1, 'un site jamais déclaré doit sortir SEUL')
  assert.match(neuf.neuves[0], /docs\/raw\/[\w-]+\/combat\.md :: LDB 99 l\.1 :: 1 — site NEUF/)
  assert.deepEqual(neuf.perimees, [])

  const declare = ecartDuVolet({
    sites: [...sitesDuStock, { file: 'docs/raw/4e/combat.md', ref: 'LDB 99 l.1' }],
    stock: [...stock, { fichier: 'docs/raw/4e/combat.md', ref: 'LDB 99 l.1', occurrence: 1 }], ou,
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

// ---------- auto-cohérence sur le VRAI Atlas (le cliquet vaut pour de vrai, pas seulement en fixture) ----------

test('scan(RAWDIR) réel : les sites ❌ LOW mesurés sont EXACTEMENT les entrées de reanchor-low-stock.json', () => {
  const r = scan(RAWDIR, {})
  const stock = readStock(LOW_STOCK_PATH)
  assert.ok(stock.length > 0, 'le stock des réfs ❌ LOW est une dette encore ouverte : un stock vide ici serait une perte de mesure')
  const { neuves, perimees } = ecartDuVolet({ sites: sitesLow(r.lowRows), stock, ou: 'reanchor-low-stock.json' })
  assert.deepEqual(neuves, [], `site(s) NEUF(s) :\n${neuves.join('\n')}`)
  assert.deepEqual(perimees, [], `entrée(s) SOLDÉE(s) :\n${perimees.join('\n')}`)
  assert.equal(stock.every((e) => e.fichier.startsWith('docs/raw/')), true, 'chaque entrée NOMME sa fiche : c’est ce que la porte de plage lit')
})

// ---------- --remap : carte de lignes EXACTE (#1739), continuations nues comprises ----------
// La carte est INJECTÉE (`carteDe`) : aucun diff git n'est lu. Le chapitre `CRB 075` réel ne sert
// qu'aux bornes (46 lignes) ; les réfs n'y portent aucune citation — ce sont des réfs de SYNTHÈSE.

test('continuations : un `l.N` nu hérite de la réf qui le PRÉCÈDE sur sa ligne, jamais au-delà d’une cellule de table', () => {
  assert.deepEqual(continuations('- `CRB 075 l.24`, `l.26` — texte').map((c) => [c.abbr, c.ch, c.depart]), [['CRB', '075', 26]])
  assert.deepEqual(continuations('| `CRB 075 l.24` | `l.26` |'), [], 'autre cellule : aucun hôte')
  assert.deepEqual(continuations('- `l.26` seul'), [], 'sans réf qui précède : pas une réf')
  assert.deepEqual(continuations('(`CRB 024 l.7-9`, `l.29-31`)').map((c) => c.full), ['l.29-31'])
})

// Carte forgée : l.24 → l.23 (une ligne ôtée avant), l.26 → l.25, l.30 supprimée, l.32 dans un hunk ambigu.
const CARTE_FORGEE = (n) => n === 30 ? { supprimee: true } : n === 32 ? { ambigue: true, candidates: [30, 31] } : { ligne: n - 1 }

test('--remap : réf directe ET continuation nue réécrites par la carte', () => {
  const md = '- `CRB 075 l.24`, `l.26` — synthèse\n'
  withTempRawDir(md, (dir, relatif) => {
    const r = scan(dir, { remap: true, carteDe: () => CARTE_FORGEE })
    assert.deepEqual(r.nonRemappees, [])
    assert.equal(r.remappedTotal, 2)
    assert.equal(readFileSync(join(dir, relatif), 'utf8'), '- `CRB 075 l.23`, `l.25` — synthèse\n')
  })
})

test('--remap : une réf vers une ligne SUPPRIMÉE ou AMBIGUË est RAPPORTÉE avec son site, jamais réécrite', () => {
  const md = '- `CRB 075 l.30`, `l.32` — synthèse\n'
  withTempRawDir(md, (dir, relatif) => {
    const r = scan(dir, { remap: true, carteDe: () => CARTE_FORGEE })
    assert.deepEqual(r.nonRemappees.map((n) => [basename(n.doc), n.ligne, n.full, n.detail]), [
      ['fixture.md', 1, 'CRB 075 l.30', 'l.30 : ligne supprimée'],
      ['fixture.md', 1, 'l.32', 'l.32 : hunk ambigu, candidates l.30/31'],
    ])
    assert.equal(r.remappedTotal, 0)
    assert.equal(readFileSync(join(dir, relatif), 'utf8'), md)
  })
})

test('--remap : une réf dont le chapitre n’a PAS de carte (absent de HEAD) est RAPPORTÉE, jamais passée sous silence', () => {
  const md = '- `CRB 075 l.24`, `l.26` — synthèse\n'
  withTempRawDir(md, (dir, relatif) => {
    const r = scan(dir, { remap: true, carteDe: () => null })
    assert.deepEqual(r.nonRemappees.map((n) => [n.full, n.detail]), [
      ['CRB 075 l.24', 'chapitre absent de HEAD'],
      ['l.26', 'chapitre absent de HEAD'],
    ])
    assert.equal(readFileSync(join(dir, relatif), 'utf8'), md)
  })
})
