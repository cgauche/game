// PORTE DE RÔLE du corpus source (#1709 C1) — la lib LIT UNE FOIS PAR CLÉ, et ce qu'elle rend est
// IMMUABLE. Cinq propriétés, mesurées sur une fixture de `os.tmpdir()` (jamais le `src/` réel) :
//  (a) MÉMO      : même clé = MÊME tableau (identité), et le disque n'est pas retouché — une écriture
//      faite APRÈS la première lecture reste invisible jusqu'à `viderCorpus()`.
//  (b) CLÉ       : dossiers, extensions et `tests` font partie de la clé — trois corpus distincts.
//  (c) IMMUABLE  : tableau et entrées gelés — un mémo partagé entre fichiers de test d'un worker
//      (`isolate: false`, `vite.config.ts`) ne peut être licite qu'à cette condition.
//  (d) NORMALISÉE : la clé porte le dossier en chemin POSIX depuis la racine — absolu, relatif et
//      séparateur final désignent le MÊME corpus, là où les appelants mélangent les formes
//      (`src/state/cascade-step-stake-guard.test.ts` passe des absolus, `src/engine/grid.test.ts`
//      un relatif).
//  (e) PORTE     : `viderCorpus()` est la sortie de la condition de licéité — après elle, un fichier
//      AJOUTÉ entre deux lectures est vu, et le tableau rendu est NEUF.
//  (f) PÉRIMÈTRE : sur l'arbre RÉEL de `src/**`, l'ensemble rendu est EXACTEMENT celui d'une marche
//      naïve écrite dans ce test comme ORACLE. C'est le seul filet contre une régression de périmètre
//      de la primitive : ses appelants ont chacun troqué leur propre marche contre elle (#1709 C2),
//      aucun ne peut donc plus servir de témoin — une exclusion de trop ou de moins ici rendrait
//      toutes les gardes de corpus vertes sur un corpus amputé, sans qu'aucune ne le dise.
import test from 'node:test'
import assert from 'node:assert/strict'
// eslint-disable-next-line no-restricted-imports -- ORACLE du cas (f) : marche naïve TÉMOIN, indépendante de `listerArbre` par construction (sinon le test ne prouverait rien) ; son rendu est trié par unités de code avant comparaison, l’ordre du système de fichiers n’en sort jamais.
import { mkdtempSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, relative, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { readCorpus, viderCorpus } from './sourceCorpus.mjs'

/** La même racine que celle contre laquelle `sourceCorpus.mjs` normalise ses clés. */
const ROOT = fileURLToPath(new URL('../../../', import.meta.url)).replace(/[\\/]$/, '')

/** Fixture : deux `.ts` (dont un test), un `.tsx`, un `.md`, un sous-dossier — et un dossier VOISIN. */
function fixture() {
  const racine = mkdtempSync(join(tmpdir(), 'corpus-'))
  const a = join(racine, 'a')
  const b = join(racine, 'b')
  mkdirSync(join(a, 'sous'), { recursive: true })
  mkdirSync(b)
  writeFileSync(join(a, 'un.ts'), 'un')
  writeFileSync(join(a, 'un.test.ts'), 'un-test')
  writeFileSync(join(a, 'sous', 'deux.tsx'), 'deux')
  writeFileSync(join(a, 'notes.md'), 'notes')
  writeFileSync(join(b, 'trois.ts'), 'trois')
  return { racine, a, b }
}

/** Chaque test part d'un mémo VIDE : le mémo vit aussi longtemps que le module. */
function frais() {
  viderCorpus()
  return fixture()
}

test('même clé = même tableau, et plus aucune lecture disque', () => {
  const { racine, a } = frais()
  try {
    const premier = readCorpus([a])
    const second = readCorpus([a])
    assert.equal(premier, second, 'deux appels de même clé doivent rendre le MÊME tableau')
    assert.equal(premier[0], second[0], 'les ENTRÉES aussi (les mémos par identité des appelants en dépendent)')
    assert.deepEqual(premier.map((f) => f.text), ['deux', 'un'])

    writeFileSync(join(a, 'un.ts'), 'un-MODIFIÉ')
    writeFileSync(join(a, 'neuf.ts'), 'neuf')
    const apres = readCorpus([a])
    assert.equal(apres, premier, 'le disque a changé : si le tableau change, c’est qu’il a été relu')
    assert.deepEqual(apres.map((f) => f.text), ['deux', 'un'])
  } finally {
    rmSync(racine, { recursive: true, force: true })
  }
})

test('`viderCorpus()` relit le disque', () => {
  const { racine, a } = frais()
  try {
    const premier = readCorpus([a])
    writeFileSync(join(a, 'un.ts'), 'un-MODIFIÉ')
    viderCorpus()
    const relu = readCorpus([a])
    assert.notEqual(relu, premier)
    assert.deepEqual(relu.map((f) => f.text), ['deux', 'un-MODIFIÉ'])
  } finally {
    rmSync(racine, { recursive: true, force: true })
  }
})

test('la clé porte les dossiers, leur ORDRE, les extensions et `tests`', () => {
  const { racine, a, b } = frais()
  try {
    const surA = readCorpus([a])
    assert.notEqual(readCorpus([b]), surA, 'dossier différent')
    assert.deepEqual(readCorpus([b]).map((f) => f.text), ['trois'])
    assert.notEqual(readCorpus([a, b]), surA, 'jeu de dossiers différent')
    assert.deepEqual(readCorpus([a, b]).map((f) => f.text), ['deux', 'un', 'trois'])
    assert.notEqual(readCorpus([b, a]), readCorpus([a, b]), 'l’ORDRE décide de l’ordre du résultat')
    assert.deepEqual(readCorpus([b, a]).map((f) => f.text), ['trois', 'deux', 'un'])
    assert.notEqual(readCorpus([a], { exts: ['.ts'] }), surA, 'extensions différentes')
    assert.deepEqual(readCorpus([a], { exts: ['.ts'] }).map((f) => f.text), ['un'])
    assert.notEqual(readCorpus([a], { tests: true }), surA, '`tests` différent')
    assert.deepEqual(readCorpus([a], { tests: true }).map((f) => f.text), ['deux', 'un-test', 'un'])
    assert.equal(readCorpus([a], { exts: ['.tsx', '.ts'] }), readCorpus([a], { exts: ['.ts', '.tsx'] }),
      'la clé est le CONTENU des extensions, pas leur ordre d’écriture')
  } finally {
    rmSync(racine, { recursive: true, force: true })
  }
})

test('le tableau rendu et ses entrées sont GELÉS', () => {
  const { racine, a } = frais()
  try {
    const corpus = readCorpus([a])
    assert.ok(Object.isFrozen(corpus), 'le tableau doit être gelé')
    assert.ok(corpus.every((f) => Object.isFrozen(f)), 'chaque entrée doit être gelée')
    assert.throws(() => corpus.push({ abs: '', rel: 'x', text: '' }), TypeError)
    assert.throws(() => { corpus[0] = { abs: '', rel: 'x', text: '' } }, TypeError)
    assert.throws(() => { corpus[0].text = 'usurpé' }, TypeError)
  } finally {
    rmSync(racine, { recursive: true, force: true })
  }
})

test('la clé est NORMALISÉE : absolu ≡ relatif ≡ séparateur final', () => {
  const { racine, a } = frais()
  try {
    const parAbsolu = readCorpus([a])
    const rel = relative(ROOT, a)
    assert.equal(readCorpus([rel]), parAbsolu, 'le MÊME dossier écrit en relatif doit rendre le MÊME tableau')
    assert.equal(readCorpus([`${rel}/`]), parAbsolu, 'un slash final ne fabrique pas un second corpus')
    assert.equal(readCorpus([a + sep]), parAbsolu, 'ni un séparateur final sur la forme absolue')
    assert.deepEqual(readCorpus([rel]).map((f) => f.text), ['deux', 'un'])
  } finally {
    rmSync(racine, { recursive: true, force: true })
  }
})

/**
 * ORACLE de périmètre : la marche la plus bête qui puisse répondre à la même question — descente
 * récursive de `readdirSync`, filtre d'extension sur le nom, regex de test. Écrite ICI et nulle part
 * ailleurs : c'est le témoin indépendant de `listerArbre` + `readCorpus`. Aucun cardinal n'est
 * attendu — l'oracle est la MARCHE, jamais un nombre, qui périmerait au fichier suivant.
 * @param {string} dir @param {string[]} exts @param {boolean} tests
 * @returns {string[]} chemins POSIX depuis la racine du dépôt, triés.
 */
function marcheNaive(dir, exts, tests) {
  const out = []
  const descendre = (d) => {
    for (const nom of readdirSync(d, { withFileTypes: true })) {
      const p = join(d, nom.name)
      if (nom.isDirectory()) { descendre(p); continue }
      if (!exts.some((e) => nom.name.endsWith(e))) continue
      if (!tests && /\.test\./.test(nom.name)) continue
      out.push(relative(ROOT, p).split('\\').join('/'))
    }
  }
  descendre(dir)
  return out.sort()
}

test('PÉRIMÈTRE sur l’arbre RÉEL : `readCorpus([\'src\'])` rend EXACTEMENT la marche naïve, tests exclus puis inclus', () => {
  viderCorpus()
  const SRC = join(ROOT, 'src')
  for (const tests of [false, true]) {
    const attendu = marcheNaive(SRC, ['.ts', '.tsx'], tests)
    const rendu = readCorpus(['src'], { tests }).map((f) => f.rel)
    assert.ok(attendu.length > 0, 'l’oracle lui-même ne voit rien : la comparaison ne prouverait rien')
    const trie = [...rendu].sort()
    const oracle = new Set(attendu)
    const vus = new Set(trie)
    const enTrop = trie.filter((x) => !oracle.has(x))
    const manquants = attendu.filter((x) => !vus.has(x))
    assert.deepEqual(enTrop, [], `tests:${tests} — fichiers VUS que l’oracle ne voit pas`)
    assert.deepEqual(manquants, [], `tests:${tests} — fichiers de l’oracle PERDUS par readCorpus`)
    assert.deepEqual(trie, rendu, 'le corpus est rendu en ORDRE TOTAL : il est déjà trié')
  }
  const horsTests = readCorpus(['src']).map((f) => f.rel)
  const avecTests = readCorpus(['src'], { tests: true }).map((f) => f.rel)
  assert.ok(avecTests.length > horsTests.length, '`tests: true` doit ÉLARGIR le corpus')
  assert.ok(
    avecTests.some((r) => /\.test\.tsx?$/.test(r)) && horsTests.every((r) => !/\.test\./.test(r)),
    'le filtre `tests` ne discrimine plus les fichiers de test',
  )
})

test('`viderCorpus()` fait VOIR un fichier AJOUTÉ entre deux lectures', () => {
  const { racine, a } = frais()
  try {
    const premier = readCorpus([a])
    writeFileSync(join(a, 'neuf.ts'), 'neuf')
    assert.equal(readCorpus([a]), premier, 'sans la porte, l’ajout reste invisible')
    viderCorpus()
    const relu = readCorpus([a])
    assert.notEqual(relu, premier, 'après la porte, le tableau rendu est NEUF')
    assert.deepEqual([...relu.map((f) => f.text)].sort(), ['deux', 'neuf', 'un'])
  } finally {
    rmSync(racine, { recursive: true, force: true })
  }
})
