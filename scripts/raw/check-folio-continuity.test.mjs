// Test de la garde `check-folio-continuity` (node --test) : une séquence data-folio non
// consécutive est détectée, une séquence consécutive reste silencieuse, et un folio attendu APRÈS
// la dernière ancre du fichier ne passe plus entre les mailles (#833). Lancé par `npm run test:raw`.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  folioGapsInText, chapterFolioSpan, scanBookDir, scanAllBooks,
  emptyFolioAnchorsInText, scanEmptyFoliosInBook, scanAllEmptyFolios,
  assertEmptyFoliosAgainstStock, emptyFolioKey, EMPTY_STOCK_PATH, chapterTexts,
} from './check-folio-continuity.mjs'
import { BOOKS } from './_lib.mjs'

function span(folio) { return `<span id="page-x-0" data-folio="${folio}"></span>` }

function withTempBookDir(files, fn) {
  const dir = mkdtempSync(join(tmpdir(), 'folio-continuity-'))
  try {
    for (const [name, content] of Object.entries(files)) writeFileSync(join(dir, name), content, 'utf8')
    fn(dir)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

test('folioGapsInText : séquence consécutive → aucun saut', () => {
  const text = `a ${span(10)} b\nc ${span(11)} d\ne ${span(12)} f\n`
  assert.deepEqual(folioGapsInText(text), [])
})

test('folioGapsInText : saut (page manquante) → détecté', () => {
  const text = `a ${span(10)} b\nc ${span(13)} d\n`
  const gaps = folioGapsInText(text)
  assert.equal(gaps.length, 1)
  assert.deepEqual(gaps[0], { from: 10, to: 13, delta: 3 })
})

test('folioGapsInText : plusieurs sauts dans le même fichier → tous détectés', () => {
  const text = `${span(1)} ${span(2)} ${span(5)} ${span(6)} ${span(9)}`
  const gaps = folioGapsInText(text)
  assert.equal(gaps.length, 2)
  assert.deepEqual(gaps[0], { from: 2, to: 5, delta: 3 })
  assert.deepEqual(gaps[1], { from: 6, to: 9, delta: 3 })
})

test('folioGapsInText : aucune ancre → aucun saut (hors sujet)', () => {
  assert.deepEqual(folioGapsInText('rien ici.\n'), [])
})

test('scanBookDir : ne scanne que les fichiers chapitre `NN - *.md`, ignore le reste', () => {
  withTempBookDir({
    '01 - Chapitre.md': `${span(1)} ${span(4)}`,
    'notes.md': `${span(1)} ${span(99)}`, // pas un fichier chapitre → ignoré
  }, (dir) => {
    const gaps = scanBookDir('TEST', dir)
    assert.equal(gaps.length, 1)
    assert.equal(gaps[0].file, '01 - Chapitre.md')
    assert.equal(gaps[0].ref, 'TEST 1')
    assert.equal(gaps[0].abbr, 'TEST')
    assert.equal(gaps[0].nn, 1)
  })
})

test('scanBookDir : dossier introuvable → aucun saut (hors sujet)', () => {
  assert.deepEqual(scanBookDir('TEST', join(tmpdir(), 'dossier-inexistant-xyz')), [])
})

test('scanAllBooks : agrège plusieurs livres', () => {
  const parent = mkdtempSync(join(tmpdir(), 'folio-continuity-books-'))
  const dirA = join(parent, 'A'); mkdirSync(dirA)
  const dirB = join(parent, 'B'); mkdirSync(dirB)
  try {
    writeFileSync(join(dirA, '01 - X.md'), `${span(1)} ${span(3)}`, 'utf8')
    writeFileSync(join(dirB, '02 - Y.md'), `${span(1)} ${span(2)}`, 'utf8')
    const gaps = scanAllBooks([['A', dirA], ['B', dirB]])
    assert.equal(gaps.length, 1)
    assert.equal(gaps[0].ref, 'A 1')
  } finally {
    rmSync(parent, { recursive: true, force: true })
  }
})

// ---------- volet FIN de fichier (#833) ----------

function chapter(pdfLo, pdfHi, folios, offset = 1) {
  const body = folios.map((f) => `<span id="page-${f + offset}-0" data-folio="${f}"></span>prose du folio ${f}`).join('\n')
  return `*Pages PDF ${pdfLo}-${pdfHi}*\n\n${body}\n`
}

test('chapterFolioSpan : plage attendue (en-tête + offset lu sur les ancres) et dernier folio ancré', () => {
  assert.deepEqual(chapterFolioSpan(chapter(25, 36, [23, 24, 25])), { expectedHi: 34, last: 25 })
})

test('chapterFolioSpan : sans en-tête, sans ancre, ou offset non unique → null', () => {
  assert.equal(chapterFolioSpan('pas d’en-tête\n'), null)
  assert.equal(chapterFolioSpan('*Pages PDF 25-36*\n\nprose sans ancre\n'), null)
  const bancal = '*Pages PDF 25-36*\n\n<span id="page-24-0" data-folio="23"></span>a\n<span id="page-30-0" data-folio="25"></span>b\n'
  assert.equal(chapterFolioSpan(bancal), null)
})

test('scanBookDir : folio attendu APRÈS la dernière ancre et ancré nulle part → trou rapporté', () => {
  withTempBookDir({ '15 - Fin.md': chapter(217, 228, [215, 216, 217]) }, (dir) => {
    const gaps = scanBookDir('TEST', dir).filter((g) => g.kind === 'fin')
    assert.equal(gaps.length, 1)
    assert.deepEqual([gaps[0].from, gaps[0].to, gaps[0].delta], [217, 226, 9])
    assert.equal(gaps[0].ref, 'TEST 15')
  })
})

test('scanBookDir : folio de fin ancré dans le chapitre SUIVANT (page partagée) → aucun trou', () => {
  withTempBookDir({
    '01 - A.md': chapter(10, 13, [8, 9, 10]),        // attend 8..11, s'arrête à 10
    '02 - B.md': chapter(13, 16, [11, 12, 13, 14]),  // le folio 11 vit ici
  }, (dir) => {
    assert.deepEqual(scanBookDir('TEST', dir).filter((g) => g.kind === 'fin'), [])
  })
})

test('scanBookDir : la séquence SEULE est aveugle en fin de fichier — le second volet la couvre', () => {
  withTempBookDir({ '15 - Fin.md': chapter(217, 228, [215, 216, 217]) }, (dir) => {
    const text = chapter(217, 228, [215, 216, 217])
    assert.deepEqual(folioGapsInText(text), [], 'aucun delta ≠ 1 : le trou est APRÈS la dernière ancre')
    assert.equal(scanBookDir('TEST', dir).length, 1)
  })
})

// ---------- passe 2 : ancre SANS CONTENU (#1457 lot A1) ----------

test('emptyFolioAnchorsInText : ancres COLLÉES (0 octet) → page sans contenu détectée', () => {
  const text = `prose ${span(87)}page 87\n${span(88)}${span(89)}page 89\n`
  assert.deepEqual(emptyFolioAnchorsInText(text).map((e) => e.folio), [88])
})

test('emptyFolioAnchorsInText : ancres séparées par des BLANCS SEULS → détectée aussi', () => {
  const text = `${span(10)}\n\n   \n\t\n${span(11)}prose du 11\n`
  const vides = emptyFolioAnchorsInText(text)
  assert.equal(vides.length, 1)
  assert.equal(vides[0].folio, 10)
})

test('emptyFolioAnchorsInText : le moindre contenu utile entre deux ancres → rien à signaler', () => {
  assert.deepEqual(emptyFolioAnchorsInText(`${span(10)}\n\n#\n\n${span(11)}`), [])
  assert.deepEqual(emptyFolioAnchorsInText(`${span(10)} prose ${span(11)} prose ${span(12)}`), [])
})

test('emptyFolioAnchorsInText : la DERNIÈRE ancre du fichier est hors sujet (page partagée avec le chapitre suivant)', () => {
  assert.deepEqual(emptyFolioAnchorsInText(`${span(10)}prose\n${span(11)}\n\n`), [])
})

test('emptyFolioAnchorsInText : la séquence est CONSÉCUTIVE et pourtant la page est perdue — la passe 1 est aveugle', () => {
  const text = `${span(87)}prose du 87\n${span(88)}${span(89)}prose du 89\n`
  assert.deepEqual(folioGapsInText(text), [], 'delta 1 partout : aucun saut')
  assert.deepEqual(emptyFolioAnchorsInText(text).map((e) => e.folio), [88])
})

test('scanEmptyFoliosInBook : nomme livre, chapitre, fichier, folio et ligne', () => {
  withTempBookDir({ '08 - Statut.md': `intro\n${span(87)}prose\n${span(88)}${span(89)}suite\n` }, (dir) => {
    const vides = scanEmptyFoliosInBook('TEST', dir)
    assert.equal(vides.length, 1)
    assert.deepEqual(
      { ref: vides[0].ref, file: vides[0].file, folio: vides[0].folio, line: vides[0].line },
      { ref: 'TEST 8', file: '08 - Statut.md', folio: 88, line: 3 },
    )
  })
})

const PERDUE = { ref: 'ZI 5', file: '05 - Amibe.md', folio: 62, pdfChars: 2136 }
const BENIGNE = { ref: 'ZI 5', file: '05 - Amibe.md', folio: 58, pdfChars: 12 }

test('assertEmptyFoliosAgainstStock : stock aligné → aucune anomalie', () => {
  const mesure = [{ ref: 'ZI 5', file: '05 - Amibe.md', folio: 62 }, { ref: 'ZI 5', file: '05 - Amibe.md', folio: 58 }]
  const stock = { seuil: 200, perdues: [PERDUE], benignes: [BENIGNE] }
  assert.deepEqual(assertEmptyFoliosAgainstStock(mesure, stock), { inconnues: [], restituees: [], benignesDisparues: [], malClassees: [] })
})

test('assertEmptyFoliosAgainstStock : ancre sans contenu ABSENTE du stock → régression nominative', () => {
  const inconnue = { ref: 'ZI 5', file: '05 - Amibe.md', folio: 62 }
  const r = assertEmptyFoliosAgainstStock([inconnue], { seuil: 200, perdues: [], benignes: [] })
  assert.deepEqual(r.inconnues, [inconnue])
})

test('assertEmptyFoliosAgainstStock : page RESTITUÉE → entrée périmée, le stock doit décroître', () => {
  const r = assertEmptyFoliosAgainstStock([], { seuil: 200, perdues: [PERDUE], benignes: [] })
  assert.deepEqual(r.restituees, [PERDUE])
  assert.deepEqual(r.inconnues, [])
  assert.deepEqual(r.malClassees, [])
})

test('assertEmptyFoliosAgainstStock : entrée bénigne sans mesure → périmée elle aussi', () => {
  const r = assertEmptyFoliosAgainstStock([], { seuil: 200, perdues: [], benignes: [BENIGNE] })
  assert.deepEqual(r.benignesDisparues, [BENIGNE])
})

// ---------- le SEUIL est opposé au stock, pas seulement écrit en tête (#1457, grief G1) ----------

test('assertEmptyFoliosAgainstStock : perdue reclassée bénigne → MAL CLASSÉE nominative (le blanchiment ne passe plus)', () => {
  const mesure = [{ ref: PERDUE.ref, file: PERDUE.file, folio: PERDUE.folio }]
  const r = assertEmptyFoliosAgainstStock(mesure, { seuil: 200, perdues: [], benignes: [PERDUE] })
  assert.deepEqual(r.malClassees.map((e) => [emptyFolioKey(e), e.cls, e.pdfChars]), [['ZI 5|05 - Amibe.md|62', 'benignes', 2136]])
  assert.deepEqual([r.inconnues, r.restituees, r.benignesDisparues], [[], [], []], 'les trois autres volets restent muets : seul le classement ment')
})

test('assertEmptyFoliosAgainstStock : bénigne promue perdue → MAL CLASSÉE elle aussi (la règle est une équivalence)', () => {
  const mesure = [{ ref: BENIGNE.ref, file: BENIGNE.file, folio: BENIGNE.folio }]
  const r = assertEmptyFoliosAgainstStock(mesure, { seuil: 200, perdues: [BENIGNE], benignes: [] })
  assert.deepEqual(r.malClassees.map((e) => [emptyFolioKey(e), e.cls]), [['ZI 5|05 - Amibe.md|58', 'perdues']])
})

test('stock : le SEUIL committé vaut 200 — un stock régénéré avec `--seuil` complaisant ne blanchit plus en silence', () => {
  const mesure = [{ ref: PERDUE.ref, file: PERDUE.file, folio: PERDUE.folio }]
  const complaisant = assertEmptyFoliosAgainstStock(mesure, { seuil: 5000, perdues: [], benignes: [PERDUE] })
  assert.deepEqual(complaisant.malClassees, [], 'sous seuil 5000, `perdues` vide est COHÉRENT — la garde ne peut rien y voir…')
  assert.equal(JSON.parse(readFileSync(EMPTY_STOCK_PATH, 'utf8')).seuil, 200, '… c’est donc le seuil COMMITTÉ qui est épinglé ici : le changer exige de changer CE test, au diff, en même temps que le JSON')
})

test('assertEmptyFoliosAgainstStock : entrée sans `pdfChars`, ou stock sans `seuil` → INAUDITABLE, donc mal classée', () => {
  const nue = { ref: 'ZI 5', file: '05 - Amibe.md', folio: 62 }
  assert.equal(assertEmptyFoliosAgainstStock([nue], { seuil: 200, perdues: [nue], benignes: [] }).malClassees.length, 1)
  assert.equal(assertEmptyFoliosAgainstStock([nue], { perdues: [PERDUE], benignes: [] }).malClassees.length, 1)
})

// ---------- le stock COMMITTÉ, confronté au corpus réel ----------

const STOCK = JSON.parse(readFileSync(EMPTY_STOCK_PATH, 'utf8'))

test('stock : le folio 88 du LDB (carrière de Juriste) est RESTITUÉ — porteur au corpus, absent de la mesure comme du stock', () => {
  const dir = new Map(BOOKS).get('LDB')
  const cle = 'LDB 8|08 - Statut.md|88'
  const md = readFileSync(join(dir, '08 - Statut.md'), 'utf8')
  const page = md.split('data-folio="88"')[1].split('data-folio="89"')[0]
  assert.match(page, /\*\*JURISTE\*\* Halfling, Haut Elfe, Humain, Nain/, 'titre et espèces de la page')
  assert.match(page, /Schéma de Progression du Juriste/, 'schéma de progression')
  for (const niveau of ['Étudiant en Droit – Bronze 4', 'Juriste – Argent 3', 'Maître du Barreau – Or 1', 'Juge – Or 2']) {
    assert.ok(page.includes(niveau), `niveau « ${niveau} » au corpus`)
  }
  assert.ok(!scanEmptyFoliosInBook('LDB', dir).some((e) => emptyFolioKey(e) === cle), 'le détecteur ne voit plus de page 88 sans contenu')
  assert.ok(!STOCK.perdues.some((e) => emptyFolioKey(e) === cle), 'et le stock ne la porte plus')
})

test('stock : chaque ancre sans contenu du corpus est triée, et aucune entrée périmée', () => {
  const r = assertEmptyFoliosAgainstStock(scanAllEmptyFolios(), STOCK)
  assert.deepEqual(r.inconnues.map(emptyFolioKey), [], 'ancre sans contenu non triée (relancer lib/empty-folios-stock.mjs)')
  assert.deepEqual(r.restituees.map(emptyFolioKey), [], 'page restituée : supprimer l’entrée du stock')
  assert.deepEqual(r.benignesDisparues.map(emptyFolioKey), [], 'entrée bénigne périmée : la supprimer du stock')
  assert.deepEqual(r.malClassees.map(emptyFolioKey), [], 'classement démenti par le pdfChars mesuré')
})

test('stock COMMITTÉ truqué : déplacer une PERDUE vers `benignes` → rouge NOMINATIF (le compte baissait sans un mot)', () => {
  const truque = { seuil: STOCK.seuil, perdues: STOCK.perdues.slice(1), benignes: [...STOCK.benignes, STOCK.perdues[0]] }
  const deplacee = STOCK.perdues[0]
  const r = assertEmptyFoliosAgainstStock(scanAllEmptyFolios(), truque)
  assert.deepEqual(r.malClassees.map(emptyFolioKey), [emptyFolioKey(deplacee)], 'l’entrée déplacée est nommée')
  assert.equal(r.malClassees[0].cls, 'benignes')
  assert.ok(r.malClassees[0].pdfChars > truque.seuil, 'et c’est son pdfChars mesuré qui la dément')
  assert.deepEqual([r.inconnues, r.restituees, r.benignesDisparues].map((a) => a.length), [0, 0, 0], 'aucun autre volet ne bronchait : c’était le trou')
})

// ---------- frontière de COUVERTURE : les fins de LIVRE (angle mort déclaré, #1457 grief G2) ----------

test('couverture : les 3 dernières ancres de LIVRE (AA 144, ZI 144, MDG 160) sont hors mesure — aucun chapitre suivant ne les reprend', () => {
  const mesure = new Set(scanAllEmptyFolios().map(emptyFolioKey))
  for (const [abbr, folio] of [['AA', 144], ['ZI', 144], ['MDG', 160]]) {
    const texts = chapterTexts(new Map(BOOKS).get(abbr))
    const dernier = [...texts.keys()].pop()
    const ancres = [...texts.get(dernier).matchAll(/data-folio="(-?\d+)"/g)].map((m) => Number(m[1]))
    assert.equal(ancres.pop(), folio, `${abbr} : folio ${folio} est bien la DERNIÈRE ancre du DERNIER fichier (${dernier})`)
    assert.ok(![...mesure].some((k) => k.startsWith(`${abbr} `) && k.endsWith(`|${folio}`)), `${abbr} ${folio} : hors mesure, faute de paire d’ancres`)
  }
})

// ---------- MORSURE sur le CAS D'OR réel : la page 88 du LDB, re-vidée EN MÉMOIRE (#1457, grief G4) ----------

test('détecteur : re-vider le folio 88 du VRAI `08 - Statut.md` le fait ressortir, et le stock le dénonce comme INCONNU', () => {
  const dir = new Map(BOOKS).get('LDB')
  const md = readFileSync(join(dir, '08 - Statut.md'), 'utf8')
  const finAncre88 = md.indexOf('</span>', md.indexOf('data-folio="88"')) + '</span>'.length
  const debutAncre89 = md.lastIndexOf('<span', md.indexOf('data-folio="89"'))
  assert.ok(finAncre88 > 0 && debutAncre89 > finAncre88, 'les ancres 88 puis 89 se suivent bien dans le chapitre')
  const revide = `${md.slice(0, finAncre88)}\n\n${md.slice(debutAncre89)}`

  assert.deepEqual(emptyFolioAnchorsInText(md), [], 'au corpus COMMITTÉ, le chapitre ne porte aucune ancre sans contenu')
  const vides = emptyFolioAnchorsInText(revide)
  assert.equal(vides.length, 1)
  assert.equal(vides[0].folio, 88, 'la page 88 vidée de son contenu utile est celle que le détecteur nomme')

  const mesure = [...scanAllEmptyFolios(), { ref: 'LDB 8', file: '08 - Statut.md', folio: 88, line: vides[0].line }]
  const r = assertEmptyFoliosAgainstStock(mesure, STOCK)
  assert.deepEqual(r.inconnues.map(emptyFolioKey), ['LDB 8|08 - Statut.md|88'], 'perte NON triée → nommée par la garde')
  assert.deepEqual([r.restituees, r.benignesDisparues, r.malClassees].map((a) => a.length), [0, 0, 0], 'aucun autre volet ne bronche : la perte n’entrait que par celui-là')
})
