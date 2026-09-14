// Test de la garde `check-source-tables` (node --test, joué par `npm run test:raw`). Les cinq
// familles MORDENT sur des chapitres synthétiques (le détecteur est PUR au grain du chapitre), la
// clé de site ne porte aucune position, et le stock COMMITTÉ est exactement le rendu des sites
// mesurés sur l'arbre — dans les deux sens.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  sitesDuChapitre, scanAllBooks, scanBookDir, refDeTable, cleDeLigne, entreesDe, ecartDuStock,
  comptesParFamille, FAMILLES, STOCK_PATH,
} from './check-source-tables.mjs'
import { readStock } from './stockNominatif.mjs'
import { BOOKS } from './_lib.mjs'

const FICHIER = 'Source/Livre/01 - Fixture.md'
const familles = (texte) => sitesDuChapitre(texte, FICHIER).map((s) => s.famille).sort()

test('br-litteral : un `<br>` dans une CELLULE est un site ; sans lui, rien', () => {
  const avec = [
    '## Tables',
    '',
    '| Lancer | Effet |',
    '| --- | --- |',
    '| 01-10 | Gagnez 3 États<br>Assourdi |',
  ].join('\n')
  assert.deepEqual(familles(avec), ['br-litteral'])
  assert.deepEqual(familles(avec.replace('<br>', ' ')), [])
})

test('span-colle : un marqueur de folio COLLÉ à une ligne de table est un site, et sa réf est le FOLIO', () => {
  const texte = [
    '## Tables',
    '',
    '<span id="page-9-0" data-folio="7"></span>| Lancer | Effet |',
    '| --- | --- |',
    '| 01-10 | Rien |',
  ].join('\n')
  const sites = sitesDuChapitre(texte, FICHIER)
  assert.deepEqual(sites.map((s) => s.famille), ['span-colle'])
  assert.equal(sites[0].ref, 'folio 7')
  // Le marqueur SEUL sur sa ligne (la forme réparée) n'est plus un site.
  assert.deepEqual(familles(texte.replace('></span>|', '></span>\n|')), [])
})

test('donnee-en-tete : une continuation de table dont les « en-têtes » sont une fourchette est un site', () => {
  const texte = ['## Tables', '', '| 81-85 | Bouche explosée |', '| --- | --- |', '| 86-90 | Pire |'].join('\n')
  assert.deepEqual(familles(texte), ['donnee-en-tete'])
})

test('banniere-suspecte : la bannière que le parseur REFUSE est un site ; celle qu’il absorbe, non', () => {
  const suspecte = ['## Tables', '', '| Effet |  |', '| --- | --- |', '| Le personnage tombe. |  |'].join('\n')
  assert.deepEqual(familles(suspecte), ['banniere-suspecte'])

  const absorbee = [
    '## Tables',
    '',
    '|  | TABLEAU DES MOUVEMENTS |  |',
    '|--|--|--|',
    '| Mouvement | Marche | Course |',
    '| 1 | 2 | 4 |',
  ].join('\n')
  assert.deepEqual(familles(absorbee), [])

  // Bandeau MAJUSCULE devant une table SANS en-têtes : refusé par le parseur, donc `banniere-suspecte`
  // — et JAMAIS `donnee-en-tete`, qui serait un site FABRIQUÉ par une absorption de trop.
  const sansEnTetes = [
    '## Tables',
    '',
    '|  | TABLEAU DES INCANTATIONS |  |',
    '|--|--|--|',
    '| 01-05 | Signe de Sorcière |  |',
    '| 06-10 | Lait caillé |  |',
  ].join('\n')
  assert.deepEqual(familles(sansEnTetes), ['banniere-suspecte'])
})

test('cle-de-ligne-ambigue : une clé partagée par DEUX tables de la même section est un site, une par clé', () => {
  const texte = [
    '## Traumatisme',
    '',
    '| Lancer | Effet tête |',
    '| --- | --- |',
    '| 01-10 | Écorchure |',
    '| 11-20 | Coupure |',
    '',
    '| Lancer | Effet bras |',
    '| --- | --- |',
    '| 01-10 | Contusion |',
    '| 21-30 | Fracture |',
  ].join('\n')
  const sites = sitesDuChapitre(texte, FICHIER).filter((s) => s.famille === 'cle-de-ligne-ambigue')
  assert.deepEqual(sites.map((s) => s.ref), ['traumatisme#1 :: 01-10'])
  // Une seule table dans la section : aucune ambiguïté INTER-tables à nommer.
  assert.deepEqual(familles(texte.split('\n').slice(0, 6).join('\n')), [])
})

test('deux SECTIONS distinctes ne partagent pas leurs clés (l’ambiguïté est bornée à la section)', () => {
  const texte = [
    '## Tête', '', '| Lancer | Effet |', '| --- | --- |', '| 01-10 | Écorchure |', '',
    '## Bras', '', '| Lancer | Effet |', '| --- | --- |', '| 01-10 | Contusion |',
  ].join('\n')
  assert.deepEqual(familles(texte), [])
})

test('la CLÉ de site porte du CONTENU, jamais une position — deux tables de mêmes en-têtes se départagent par l’OCCURRENCE', () => {
  const table = ['| Lancer | Effet |', '| --- | --- |', '| 01-10 | Gagnez 1 État<br>Sonné |'].join('\n')
  const texte = ['## Tables', '', table, '', table].join('\n')
  const sites = sitesDuChapitre(texte, FICHIER).filter((s) => s.famille === 'br-litteral')
  assert.equal(sites.length, 2)
  assert.equal(sites[0].ref, sites[1].ref, 'même contenu → même réf ; c’est l’occurrence qui les sépare')
  assert.equal(sites[0].ref, refDeTable('tables', 1, ['Lancer', 'Effet']))
  assert.deepEqual(entreesDe(sites, { lot: 'x', date: 'y' }).map((e) => e.occurrence), [1, 2])
  // Un paragraphe INSÉRÉ avant les tables ne change aucune réf : la clé ne compte ni les lignes ni
  // les tables qui précèdent.
  const decale = ['## Tables', '', 'Un paragraphe de plus.', '', table, '', table].join('\n')
  assert.deepEqual(
    sitesDuChapitre(decale, FICHIER).filter((s) => s.famille === 'br-litteral').map((s) => s.ref),
    sites.map((s) => s.ref),
  )
})

test('la réf d’une table NEUTRALISE le `<br>` : la clé survit à la réparation qui soldera son site (lot B2)', () => {
  assert.equal(refDeTable('s', 1, ['Nombre de sorts<br>connus']), refDeTable('s', 1, ['Nombre de sorts connus']))
})

test('cleDeLigne : la première cellule NON VIDE, normalisée', () => {
  // `normText` replie la casse et les espaces, jamais les ACCENTS (le match français doit être exact).
  assert.equal(cleDeLigne(['', '  Bouche Explosée ', 'x']), 'bouche explosée')
  assert.equal(cleDeLigne(['', '']), '')
})

test('scanBookDir : le `fichier` d’un site est le chapitre extrait, en POSIX depuis la racine du dépôt', () => {
  const [, dir] = BOOKS[0]
  const sites = scanBookDir(dir)
  assert.ok(sites.length > 0, 'le premier livre porte au moins un site mesuré')
  for (const s of sites.slice(0, 20)) assert.match(s.file, /^Source\/[^\\]+\/[^\\]+\.md$/)
})

test('stock COMMITTÉ : chaque site mesuré y a son entrée, et aucune entrée n’est soldée', () => {
  const { neuves, perimees } = ecartDuStock(scanAllBooks(), readStock(STOCK_PATH))
  assert.deepEqual(neuves, [], `site(s) hors du stock :\n${neuves.join('\n')}`)
  assert.deepEqual(perimees, [], `entrée(s) SOLDÉE(s) à retirer :\n${perimees.join('\n')}`)
})

// AUCUN GÉNÉRATEUR SÉPARÉ : le fichier de stock EST le rendu de `entreesDe(scanAllBooks())`, écrit
// par `node scripts/raw/check-source-tables.mjs --ecrire-stock`. Ce test le vérifie à la clé ET à
// l'ORDRE, là où l'écart ci-dessus ne juge que les ensembles — un stock réordonné à la main rougit.
test('stock COMMITTÉ : le rendu EXACT et ORDONNÉ des sites mesurés sur l’arbre', () => {
  const cle = (e) => `${e.famille} :: ${e.fichier} :: ${e.ref} :: ${e.occurrence}`
  const attendu = entreesDe(scanAllBooks(), { lot: '', date: '' })
  assert.deepEqual(readStock(STOCK_PATH).map(cle), attendu.map(cle))
})

// PLAFOND de la dette (jamais dans la lib de stock : il vit ICI, cf. `scripts/guards/lib/stock.mjs`).
// Il ne monte QUE par une édition de cette ligne, sous `CLIQUET:` — il n'est pas le compte du jour,
// il est la borne que le jour ne doit pas franchir.
const PLAFOND = 687

test('stock COMMITTÉ : PLAFOND de la dette de forme — le relever exige de changer CE test', () => {
  const entrees = readStock(STOCK_PATH)
  assert.ok(
    entrees.length <= PLAFOND,
    `${entrees.length} entrée(s) pour un plafond de ${PLAFOND} : une dette de forme ne grossit pas`,
  )
  for (const e of entrees) {
    assert.ok(FAMILLES.includes(e.famille), `famille inconnue : ${JSON.stringify(e)}`)
    assert.match(e.fichier, /^Source\/.+\.md$/, `entrée sans chapitre extrait : ${JSON.stringify(e)}`)
    assert.ok(e.ref && e.occurrence >= 1, `entrée sans réf ni occurrence : ${JSON.stringify(e)}`)
  }
})

test('stock TRUQUÉ : une entrée retirée rend son site NEUF, une entrée sans site est SOLDÉE', () => {
  const sites = scanAllBooks()
  const stock = readStock(STOCK_PATH)
  const ampute = ecartDuStock(sites, stock.slice(1))
  assert.equal(ampute.neuves.length, 1)
  assert.match(ampute.neuves[0], /site NEUF/)
  assert.ok(ampute.neuves[0].includes(stock[0].ref), `le rouge NOMME le site : ${ampute.neuves[0]}`)
  assert.deepEqual(ampute.perimees, [])

  const fantome = { ...stock[0], ref: `${stock[0].ref} (fantôme)` }
  const gonfle = ecartDuStock(sites, [...stock, fantome])
  assert.deepEqual(gonfle.neuves, [])
  assert.equal(gonfle.perimees.length, 1)
  assert.match(gonfle.perimees[0], /entrée SOLDÉE/)
})

test('l’écart est jugé FAMILLE PAR FAMILLE : le stock d’une famille ne solde pas les sites d’une autre', () => {
  const sites = sitesDuChapitre(
    ['## Tables', '', '| 81-85 | Effet<br>long |', '| --- | --- |', '| 86-90 | Pire |'].join('\n'),
    FICHIER,
  )
  assert.deepEqual(comptesParFamille(sites)['br-litteral'], 1)
  assert.deepEqual(comptesParFamille(sites)['donnee-en-tete'], 1)
  const stockPartiel = entreesDe(sites, { lot: 'x', date: 'y' }).filter((e) => e.famille === 'br-litteral')
  const { neuves, perimees } = ecartDuStock(sites, stockPartiel)
  assert.equal(neuves.length, 1, 'la famille NON couverte reste neuve')
  assert.match(neuves[0], /^donnee-en-tete ::/)
  assert.deepEqual(perimees, [], 'la famille couverte n’est pas déclarée soldée pour autant')
})

test('comptesParFamille nomme TOUTES les familles, même à zéro (une famille muette resterait invisible)', () => {
  assert.deepEqual(Object.keys(comptesParFamille([])), FAMILLES)
  assert.deepEqual(Object.values(comptesParFamille([])), FAMILLES.map(() => 0))
})
