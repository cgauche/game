// BANC de l'écrivain du bloc des cœurs de `docs/raw/00-index.md` (#1825) — `npm run test:raw`.
//
// Ce que ce banc tient, et pourquoi : le routeur de l'Atlas est la SEULE page qui dise quels cœurs
// existent. Un bloc qui oublie un cœur du registre, ou qui pointe une page absente, rend un routeur
// qui MENT — et rien d'autre ne le mesure.
// Registre INJECTÉ, à cœurs et sigles INVENTÉS : un banc qui prendrait le registre réel jugerait
// l'état du jour, pas le RÉGIME (« un cœur de plus au registre est une ligne de plus »).
import test from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { avecAtlasFixture } from './atlasFixture.mjs'
import { DEBUT, FIN, INDEX_PATH, injecter, lignesDesCoeurs } from './build-atlas-index.mjs'

const SCRIPT = fileURLToPath(new URL('./build-atlas-index.mjs', import.meta.url))

const COEUR_A = 'coeur-alpha'
const COEUR_B = 'coeur-beta'
/** Registre de fixture : deux cœurs inventés, un supplément SANS cœur, un livre non extrait. */
const REGISTRE = [
  { abbr: 'XAA', dir: 'Livre Alpha', coeur: COEUR_A },
  { abbr: 'XAB', dir: 'Alpha bis', coeur: COEUR_A },
  { abbr: 'XBA', dir: 'Livre Beta', coeur: COEUR_B },
  { abbr: 'XSU', dir: 'Supplement' },
  { abbr: 'XNE', coeur: COEUR_B },
]

test('un cœur à dossier rend un LIEN vers son index, et ses livres de cœur', () => {
  avecAtlasFixture(
    { '00-index.md': '# Alpha\n', 'combat.md': '# Combat\n' },
    (rawDir) => {
      const lignes = lignesDesCoeurs(rawDir, REGISTRE)
      assert.equal(lignes.length, 2)
      assert.equal(lignes[0], `- [\`${COEUR_A}/\`](${COEUR_A}/00-index.md) — livre(s) de cœur : XAA, XAB`)
    },
    { coeur: COEUR_A },
  )
})

test('un cœur du registre SANS dossier est DIT, jamais tu', () => {
  avecAtlasFixture(
    { '00-index.md': '# Alpha\n' },
    (rawDir) => {
      const lignes = lignesDesCoeurs(rawDir, REGISTRE)
      assert.equal(lignes[1], `- \`${COEUR_B}/\` — dossier à créer — livre(s) de cœur : XBA`)
    },
    { coeur: COEUR_A },
  )
})

test('les sigles viennent du registre REÇU, jamais du registre global', () => {
  avecAtlasFixture(
    { '00-index.md': '# Alpha\n' },
    (rawDir) => {
      const bloc = lignesDesCoeurs(rawDir, REGISTRE).join('\n')
      // Le livre non EXTRAIT (sans `dir`) n'est pas adressable par l'outillage : il ne s'affiche pas.
      assert.equal(bloc.includes('XNE'), false)
      // Un supplément (sans `coeur`) n'est le livre de cœur de personne.
      assert.equal(bloc.includes('XSU'), false)
    },
    { coeur: COEUR_A },
  )
})

test('injecter — marqueur manquant : LÈVE, jamais une page réécrite de travers', () => {
  assert.throws(() => injecter('# Atlas\nsans marqueurs\n', ['- x']), /marqueurs/)
  assert.throws(() => injecter(`${FIN}\n${DEBUT}\n`, ['- x']), /introuvables ou invers/)
})

test('injecter — le hors-bloc est INTOUCHÉ, le bloc est remplacé', () => {
  const contenu = `# Atlas\n\navant\n${DEBUT}\n- périmé\n${FIN}\naprès\n`
  assert.equal(injecter(contenu, ['- a', '- b']), `# Atlas\n\navant\n${DEBUT}\n- a\n- b\n${FIN}\naprès\n`)
  // IDEMPOTENT : ré-injecter les mêmes lignes ne bouge plus rien.
  const une = injecter(contenu, ['- a'])
  assert.equal(injecter(une, ['- a']), une)
})

test('--check : un bloc PÉRIMÉ sort 1 ; le bloc réécrit est à jour', () => {
  const arbre = mkdtempSync(join(tmpdir(), 'atlas-index-banc-'))
  try {
    mkdirSync(join(arbre, 'docs', 'raw'), { recursive: true })
    const page = join(arbre, INDEX_PATH)
    writeFileSync(page, `# Atlas\n\n${DEBUT}\n- cœur inventé d'une autre époque\n${FIN}\n`, 'utf8')
    const jouer = (...args) => spawnSync(process.execPath, [SCRIPT, ...args], { cwd: arbre, encoding: 'utf8' })
    assert.equal(jouer('--check').status, 1)
    assert.equal(jouer().status, 0)
    assert.equal(readFileSync(page, 'utf8').includes("d'une autre époque"), false)
    assert.equal(jouer('--check').status, 0)
  } finally { rmSync(arbre, { recursive: true, force: true }) }
})
