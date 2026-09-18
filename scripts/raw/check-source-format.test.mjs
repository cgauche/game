// Test de la garde `check-source-format` (node --test, joué par `npm run test:raw`). Les sept
// familles MORDENT — d'abord sur des dossiers SYNTHÉTIQUES (le détecteur est PUR au grain du
// dossier), puis sur de VRAIS dossiers fabriqués sous `os.tmpdir()` (le chemin disque : listing,
// lecture, chemin POSIX) —, la clé de site ne porte aucune position, et le stock COMMITTÉ est
// exactement le rendu des écarts mesurés sur l'arbre, dans les deux sens.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  sitesDuDossier, scanDossier, scanAll, dossiersFR, formeDeLigne1, estNomDeSignet, estSeparateur,
  comptesDeTables, balisesResiduelles, liensDIndex, entreesDe, stockDe, ecartDuStock, comptesParFamille,
  FAMILLES, STOCK_PATH, LIGNE1_CANONIQUE, PREFIXES_FR,
} from './check-source-format.mjs'
import { readStock } from './stockNominatif.mjs'
import { BOOKS } from './_lib.mjs'

const DIR = 'Source/Livre'
const familles = (fichiers) => sitesDuDossier(DIR, fichiers).map((s) => s.famille).sort()

/** Un chapitre au format CANONIQUE : ligne 1 `*Pages PDF a-b*`, ancre INLINE, table séparée. */
const chapitreCanonique = (nom = '01 - Chapitre.md', folio = 3) => ({
  nom,
  texte: [
    `*Pages PDF ${folio + 3}-${folio + 5}*`,
    '',
    `<span id="page-${folio + 2}-0" data-folio="${folio}"></span># **TITRE**`,
    '',
    '| Lancer | Effet |',
    '| --- | --- |',
    '| 01-10 | Rien |',
    '',
  ].join('\n'),
})

const indexVivant = (cibles) => ({
  nom: '00 - Index.md',
  texte: ['# Index', '', ...cibles.map((c) => `- [x](<${c}>) — folio 3`)].join('\n'),
})

test('un dossier au FORMAT canonique ne rend AUCUN écart', () => {
  const fichiers = [chapitreCanonique(), indexVivant(['01 - Chapitre.md'])]
  assert.deepEqual(sitesDuDossier(DIR, fichiers), [])
})

test('ligne1-hors-format : `*Folio N+*` et `# Titre` sont NOMMÉS, la tranche d’UNE page est canonique', () => {
  assert.equal(formeDeLigne1('*Pages PDF 10-23*'), null)
  // Un chapitre d'UNE page rend `*Pages PDF 48*` (LDB `06 - Classes.md` l.1) : canonique aussi.
  assert.equal(formeDeLigne1('*Pages PDF 48*'), null)
  assert.ok(LIGNE1_CANONIQUE.test('*Pages PDF 48*'))
  assert.equal(formeDeLigne1('*Folio 3+*'), '*Folio N+*')
  assert.equal(formeDeLigne1('# CRÉDITS'), '# Titre')
  assert.equal(formeDeLigne1(''), '(ligne vide)')
  assert.equal(formeDeLigne1('Du texte nu'), 'autre')

  const scan = { nom: '01 - Credits.md', texte: '*Folio 3+*\n\n# CRÉDITS\n' }
  const sites = sitesDuDossier(DIR, [scan, { ...scan, nom: '02 - Suite.md' }])
  const l1 = sites.filter((s) => s.famille === 'ligne1-hors-format')
  assert.deepEqual(l1.map((s) => s.ref), ['*Folio N+* ×2'], 'une entrée par FORME, avec son compte')
})

test('sans-folio : un chapitre sans aucune ancre `data-folio` est compté ; l’index ne l’est jamais', () => {
  const sansAncre = { nom: '01 - X.md', texte: '*Pages PDF 6-8*\n\n# X\n' }
  const sites = sitesDuDossier(DIR, [sansAncre, indexVivant(['01 - X.md'])])
  assert.deepEqual(
    sites.filter((s) => s.famille === 'sans-folio').map((s) => s.ref),
    ['1 chapitre(s)'],
  )
  // L'index lui-même n'a pas d'ancre et ne compte pas : sinon TOUT dossier serait hors format.
  assert.deepEqual(sitesDuDossier(DIR, [chapitreCanonique(), indexVivant([])])
    .filter((s) => s.famille === 'sans-folio'), [])
})

test('ancre-seule : une ancre SEULE sur sa ligne est un écart, la même INLINE ne l’est pas', () => {
  const seule = {
    nom: '01 - X.md',
    texte: '*Pages PDF 6-8*\n\n<span id="page-5-0" data-folio="3"></span>\nDu texte.\n',
  }
  const sites = sitesDuDossier(DIR, [seule])
  assert.deepEqual(sites.filter((s) => s.famille === 'ancre-seule').map((s) => s.ref), ['1 ancres seules / 1'])
  // Forme canonique : l'ancre PRÉFIXE le paragraphe qu'elle ouvre.
  assert.deepEqual(
    sitesDuDossier(DIR, [{ ...seule, texte: seule.texte.replace('</span>\n', '</span>') }])
      .filter((s) => s.famille === 'ancre-seule'),
    [],
  )
})

test('nom-de-signet : un titre de fichier qui est un signet Word est NOMMÉ, fichier par fichier', () => {
  assert.ok(estNomDeSignet('_GoBack'))
  assert.ok(estNomDeSignet('_gjdgxs'))
  assert.ok(estNomDeSignet('Sans titre'))
  assert.ok(!estNomDeSignet('Combat'))

  const sites = sitesDuDossier(DIR, [
    { ...chapitreCanonique(), nom: '01 - _GoBack.md' },
    { ...chapitreCanonique(), nom: '02 - Combat.md' },
  ])
  assert.deepEqual(
    sites.filter((s) => s.famille === 'nom-de-signet').map((s) => s.ref),
    ['1 fichier(s) : 01 - _GoBack.md'],
  )
})

test('html-residuel : `<sup>` est compté UNE fois par élément ; `<br>` et les ancres ne le sont pas', () => {
  assert.deepEqual([...balisesResiduelles('a<sup>1</sup> b<sup>2</sup>')], [['sup', 2]])
  assert.deepEqual([...balisesResiduelles('a<br>b<br/>c')], [])
  assert.deepEqual([...balisesResiduelles('<span id="page-5-0" data-folio="3"></span>texte')], [])
  // Une ancre SANS `data-folio` (le cas AU1) reste hors de cette famille : `sans-folio` la nomme.
  assert.deepEqual([...balisesResiduelles('<span id="page-5-0"></span>texte')], [])

  const sites = sitesDuDossier(DIR, [{ nom: '01 - X.md', texte: '*Pages PDF 6-8*\n\n<span id="page-5-0" data-folio="3"></span>a<sup>1</sup>\n' }])
  assert.deepEqual(sites.filter((s) => s.famille === 'html-residuel').map((s) => s.ref), ['<sup> ×1'])
})

test('index-mort : un lien relatif vers un fichier ABSENT est un écart ; un lien externe ne l’est pas', () => {
  assert.deepEqual(liensDIndex('- [x](<01 - X.md>)\n- [y](02%20-%20Y.md)\n- [z](https://x)\n'), [
    '01 - X.md', '02 - Y.md',
  ])
  const chap = chapitreCanonique('01 - X.md')
  const sites = sitesDuDossier(DIR, [chap, indexVivant(['01 - X.md', '17 - _GoBack.md'])])
  assert.deepEqual(sites.filter((s) => s.famille === 'index-mort').map((s) => s.ref), ['1 lien(s)'])
})

test('table-sans-separateur : un bloc de table sans ligne `|---|` est compté, sur le total des tables', () => {
  assert.ok(estSeparateur('| --- | --- |'))
  assert.ok(estSeparateur('|--|--|--|'))
  assert.ok(!estSeparateur('| 01-10 | Rien |'))
  assert.deepEqual(comptesDeTables('| A | B |\n| --- | --- |\n| 1 | 2 |\n'), { total: 1, sansSeparateur: 0 })
  assert.deepEqual(comptesDeTables('| A | B |\n| 1 | 2 |\n'), { total: 1, sansSeparateur: 1 })
  // Une ancre qui OUVRE la ligne de table n'empêche pas de la voir (le cas `span-colle` de #1384).
  assert.deepEqual(
    comptesDeTables('<span id="page-5-0" data-folio="3"></span>| A | B |\n| --- | --- |\n'),
    { total: 1, sansSeparateur: 0 },
  )
  const sites = sitesDuDossier(DIR, [{ nom: '01 - X.md', texte: '*Pages PDF 6-8*\n\n<span id="page-5-0" data-folio="3"></span>a\n\n| A | B |\n| 1 | 2 |\n' }])
  assert.deepEqual(sites.filter((s) => s.famille === 'table-sans-separateur').map((s) => s.ref), ['1/1 tables'])
})

// --- Le chemin DISQUE, sur de VRAIS dossiers jetables (aucune écriture dans l'arbre) ---

/** Fabrique un dossier de livre sous `os.tmpdir()`. @returns {string} son chemin */
function dossierJetable(nom, fichiers) {
  const racine = mkdtempSync(join(tmpdir(), 'wfrp-format-'))
  const dir = join(racine, nom)
  mkdirSync(dir, { recursive: true })
  for (const { nom: f, texte } of fichiers) writeFileSync(join(dir, f), texte, 'utf8')
  return { racine, dir }
}

test('DISQUE : un dossier au format ne rend rien ; un dossier « scan/folio », un signet et un index mort mordent', () => {
  const conforme = dossierJetable('Warhammer v4 - Conforme', [
    chapitreCanonique('01 - Chapitre.md'),
    indexVivant(['01 - Chapitre.md']),
  ])
  try {
    assert.deepEqual(scanDossier(conforme.dir), [])
  } finally { rmSync(conforme.racine, { recursive: true, force: true }) }

  const casse = dossierJetable('WH - V4 - Scan', [
    { nom: '01 - Credits.md', texte: '*Folio 3+*\n\n<span id="page-5-0" data-folio="3"></span>\nDu texte.\n' },
    { nom: '02 - _GoBack.md', texte: '*Folio 4+*\n\n<span id="page-6-0" data-folio="4"></span>\nAutre.\n' },
    indexVivant(['01 - Credits.md', '17 - _GoBack.md']),
  ])
  try {
    const sites = scanDossier(casse.dir)
    assert.deepEqual(sites.map((s) => s.famille), [
      'ligne1-hors-format', 'ancre-seule', 'nom-de-signet', 'index-mort',
    ])
    assert.deepEqual(sites.map((s) => s.ref), [
      '*Folio N+* ×2', '2 ancres seules / 2', '1 fichier(s) : 02 - _GoBack.md', '1 lien(s)',
    ])
    // Le `fichier` nomme le PREMIER chapitre fautif de la famille (l'index pour `index-mort`) :
    // sans `.md`, l'entrée serait invisible aux portes de croissance (stocksNominatifs.mjs).
    assert.deepEqual(sites.map((s) => s.file.split('/').pop()), [
      '01 - Credits.md', '01 - Credits.md', '02 - _GoBack.md', '00 - Index.md',
    ])
    for (const s of sites) {
      assert.ok(!s.file.includes('\\'), `chemin POSIX attendu : ${s.file}`)
      assert.match(s.file, /\.md$/, `le stock doit nommer un fichier : ${s.file}`)
    }
  } finally { rmSync(casse.racine, { recursive: true, force: true }) }
})

test('DISQUE : le BALAYAGE voit les 16 livres à `dir` ET les dossiers FR hors registre', () => {
  const dossiers = dossiersFR()
  for (const [abbr, dir] of BOOKS) {
    assert.ok(dossiers.includes(dir.split('\\').join('/')), `livre ${abbr} absent du balayage`)
  }
  // Les quatre dossiers PRÉ-PIPELINE ne sont dans aucun `dir` de `books.json` : sans le balayage
  // par préfixe, ils échapperaient à toute garde (c'est le trou que cette garde ferme).
  const horsRegistre = dossiers.filter((d) => !BOOKS.some(([, dir]) => dir.split('\\').join('/') === d))
  assert.deepEqual(horsRegistre, [
    "Source/Boite d'Initiation WFRP 4e Edition VF",
    'Source/WH4_FR_BI_Livre_Aventure',
    'Source/WH4_FR_BI_Livre_Ubersreik',
    'Source/Warhammer - Habitants & Creatures  du Vieux-Monde (Discord) PDF',
  ])
  for (const p of PREFIXES_FR) assert.ok(dossiers.some((d) => d.startsWith(`Source/${p}`)), `préfixe muet : ${p}`)
})

test('un livre de `books.json` dont le dossier MANQUE lève — un corpus amputé rendrait un vert muet', () => {
  assert.throws(
    () => dossiersFR('Source', [['FANTOME', 'Source/Ce dossier n existe pas']]),
    /FANTOME/,
  )
})

// --- Le STOCK committé ---

test('stock COMMITTÉ : chaque écart mesuré y a son entrée, et aucune entrée n’est soldée', () => {
  const { neuves, perimees } = ecartDuStock(scanAll(), readStock(STOCK_PATH))
  assert.deepEqual(neuves, [], `écart(s) hors du stock :\n${neuves.join('\n')}`)
  assert.deepEqual(perimees, [], `entrée(s) SOLDÉE(s) à retirer :\n${perimees.join('\n')}`)
})

// AUCUN GÉNÉRATEUR SÉPARÉ : le fichier de stock EST le rendu de `entreesDe(scanAll())`, écrit par
// `node scripts/raw/check-source-format.mjs --ecrire-stock`. Ce test le vérifie à la clé ET à
// l'ORDRE, là où l'écart ci-dessus ne juge que les ensembles.
test('stock COMMITTÉ : le rendu EXACT et ORDONNÉ des écarts mesurés sur l’arbre', () => {
  const cle = (e) => `${e.famille} :: ${e.fichier} :: ${e.ref} :: ${e.occurrence}`
  const attendu = entreesDe(scanAll(), { lot: '', date: '' })
  assert.deepEqual(readStock(STOCK_PATH).map(cle), attendu.map(cle))
})

// PLAFOND de la dette (jamais dans la lib de stock : il vit ICI, cf. `scripts/guards/lib/stock.mjs`).
// Il ne monte QUE par une édition de cette ligne, sous `CLIQUET:`.
// 57 → 58 au train #1820 : +1 `sans-folio` pour le Core Rulebook 5e, enregistré SANS ancre de folio
// (ses 18 chapitres) — l'entrée sort quand la chaîne canonique lui pose ses folios (#1739).
const PLAFOND = 58

test('stock COMMITTÉ : PLAFOND de la dette de format — le relever exige de changer CE test', () => {
  const entrees = readStock(STOCK_PATH)
  assert.ok(
    entrees.length <= PLAFOND,
    `${entrees.length} entrée(s) pour un plafond de ${PLAFOND} : une dette de format ne grossit pas`,
  )
  for (const e of entrees) {
    assert.ok(FAMILLES.includes(e.famille), `famille inconnue : ${JSON.stringify(e)}`)
    assert.match(e.fichier, /^Source\/[^\\]+\/[^\\]+\.md$/, `entrée sans chapitre nommé : ${JSON.stringify(e)}`)
    assert.ok(e.ref && e.occurrence >= 1, `entrée sans réf ni occurrence : ${JSON.stringify(e)}`)
  }
})

test('stock TRUQUÉ : une entrée retirée rend son site NEUF, une entrée sans écart est SOLDÉE', () => {
  const sites = scanAll()
  const stock = readStock(STOCK_PATH)
  const ampute = ecartDuStock(sites, stock.slice(1))
  assert.equal(ampute.neuves.length, 1)
  assert.match(ampute.neuves[0], /site NEUF/)
  assert.ok(ampute.neuves[0].includes(stock[0].fichier), `le rouge NOMME le chapitre : ${ampute.neuves[0]}`)
  assert.deepEqual(ampute.perimees, [])

  // Un livre RÉ-EXTRAIT : son écart disparaît, son entrée devient soldée et doit se retirer.
  const fantome = { ...stock[0], fichier: `${stock[0].fichier} (ré-extrait)` }
  const gonfle = ecartDuStock(sites, [...stock, fantome])
  assert.deepEqual(gonfle.neuves, [])
  assert.equal(gonfle.perimees.length, 1)
  assert.match(gonfle.perimees[0], /entrée SOLDÉE/)
})

test('l’écart est jugé FAMILLE PAR FAMILLE : le stock d’une famille ne solde pas les écarts d’une autre', () => {
  const sites = sitesDuDossier(DIR, [{ nom: '01 - _GoBack.md', texte: '*Folio 3+*\n\n<span id="page-5-0" data-folio="3"></span>x\n' }])
  assert.equal(comptesParFamille(sites)['ligne1-hors-format'], 1)
  assert.equal(comptesParFamille(sites)['nom-de-signet'], 1)
  const partiel = entreesDe(sites, { lot: 'x', date: 'y' }).filter((e) => e.famille === 'ligne1-hors-format')
  const { neuves, perimees } = ecartDuStock(sites, partiel)
  assert.equal(neuves.length, 1, 'la famille NON couverte reste neuve')
  assert.match(neuves[0], /^nom-de-signet ::/)
  assert.deepEqual(perimees, [], 'la famille couverte n’est pas déclarée soldée pour autant')
})

test('comptesParFamille nomme TOUTES les familles, même à zéro (une famille muette resterait invisible)', () => {
  assert.deepEqual(Object.keys(comptesParFamille([])), FAMILLES)
  assert.deepEqual(Object.values(comptesParFamille([])), FAMILLES.map(() => 0))
})

test('familles() n’est pas AVEUGLE : un dossier tout-défaut les rend TOUTES', () => {
  const fichiers = [
    { nom: '01 - _GoBack.md', texte: '# Titre\n\n| A | B |\n| 1 | 2 |\n\nx<sup>1</sup>\n' },
    { nom: '02 - X.md', texte: '*Folio 4+*\n\n<span id="page-6-0" data-folio="4"></span>\ny\n' },
    indexVivant(['99 - Absent.md']),
  ]
  assert.deepEqual([...new Set(familles(fichiers))].sort(), [...FAMILLES].sort())
})

// SURVIE de l'échéance (#1820) : régénérer pour ajouter UNE entrée ne redate pas les autres. La
// règle est `survieDeLecheance` (`scripts/guards/lib/stock.mjs`) ; ce test-ci tient son CÂBLAGE —
// `entreesDe`, puis `stockDe`, qui est ce que `--ecrire-stock` écrit sur le disque.
test('--ecrire-stock CONSERVE l’échéance d’une entrée existante, à clé identique', () => {
  const sites = sitesDuDossier(DIR, [{ nom: '01 - _GoBack.md', texte: '*Folio 3+*\n\n<span id="page-5-0" data-folio="3"></span>x\n' }])
  const ancien = entreesDe(sites, { lot: '#1739 H-0', date: '2026-09-14' })
  const rendu = entreesDe(sites, { lot: '#9999 Z', date: '2030-01-01', ancien })
  assert.deepEqual(rendu, ancien, 'une régénération ne rajeunit pas une entrée inchangée')
  assert.ok(
    stockDe(sites, { lot: '#9999 Z', date: '2030-01-01', dossiers: 1, ancien }).includes('"date": "2026-09-14"'),
    'le FICHIER écrit porte la date d’origine, pas celle du run',
  )

  // Une entrée NEUVE (aucune ancienne à sa clé) prend le lot et la date du run, l'autre garde les siens.
  const neuve = entreesDe(sites, { lot: '#9999 Z', date: '2030-01-01', ancien: ancien.slice(0, 1) })
  assert.deepEqual(neuve.map((e) => [e.famille, e.lot, e.date]), [
    [ancien[0].famille, '#1739 H-0', '2026-09-14'],
    ['nom-de-signet', '#9999 Z', '2030-01-01'],
  ])
})

// La `preuve` est un champ HUMAIN : la survie la porte partout où elle existe, y compris sur ce
// stock-ci, dont aucune entrée n'en porte aujourd'hui.
test('survie : une `preuve` posée à la main sur une entrée de format lui survit', () => {
  const sites = sitesDuDossier(DIR, [{ nom: '01 - X.md', texte: '*Folio 3+*\n\n<span id="page-5-0" data-folio="3"></span>x\n' }])
  const ancien = entreesDe(sites, { lot: '#1739 H-0', date: '2026-09-14' }).map((e) => ({ ...e, preuve: 'PDF p.9 : lu.' }))
  assert.deepEqual(entreesDe(sites, { lot: '#9999 Z', date: '2030-01-01', ancien }), ancien)
})
