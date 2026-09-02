// Contrat de la porte de lint du pre-commit. Les deux morsures qui comptent sont jouées avec le VRAI
// eslint et la VRAIE `eslint.config.js` du dépôt (jamais un rapport forgé) : c'est la configuration
// réelle qui décide si un fichier est jugé ou ignoré.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defautsDeRapport, fichiersALinter, lancerLint } from './lintStage.mjs'

const RACINE = fileURLToPath(new URL('../../..', import.meta.url))
/** Dossier de fixtures propre à ce processus, sous la racine : hors d'elle, eslint ne résout pas la
 *  config du dépôt et ne jugerait plus rien. */
const DOSSIER = `.lint-fixtures-${process.pid}`
const NBSP = String.fromCharCode(0x00a0)

test('sélection : extensions jugées seulement, et JAMAIS un chemin absent du disque', () => {
  const choisis = fichiersALinter(
    [
      'src/state/rollSeam.ts',
      'scripts/guards/lib/lintStage.mjs',
      'src/data/etats.json',
      'docs/architecture.md',
      'src/ui/CeFichierNExistePas.tsx',
      'scripts\\guards\\lib\\importGraph.mjs',
    ],
    RACINE,
  )
  assert.deepEqual(choisis, [
    'src/state/rollSeam.ts',
    'scripts/guards/lib/lintStage.mjs',
    'scripts/guards/lib/importGraph.mjs',
  ])
})

test('un chemin SUPPRIMÉ par le commit ne part pas à eslint (il rendrait exit 2)', () => {
  assert.deepEqual(fichiersALinter(['src/ui/SupprimeParCeCommit.tsx'], RACINE), [])
})

test('rapport : chaque message devient un site `fichier:ligne:colonne` relatif à la racine', () => {
  const json = JSON.stringify([
    {
      filePath: join(RACINE, 'src', 'ui', 'A.tsx').replace(/\\/g, '/'),
      messages: [{ line: 12, column: 3, severity: 2, ruleId: 'no-unused-vars', message: "'x' is defined but never used." }],
    },
    { filePath: join(RACINE, 'src', 'ui', 'B.tsx'), messages: [] },
  ])
  assert.deepEqual(defautsDeRapport(json, RACINE), [
    { site: 'src/ui/A.tsx:12:3', gravite: 'erreur', regle: 'no-unused-vars', message: "'x' is defined but never used." },
  ])
})

test('FAIL-CLOSED — un rapport pollué par stderr rend un défaut NOMMÉ, jamais un lot vide', () => {
  // Le chemin d'échec est le SEUL qui compte : c'est là que le hook décide de refuser. Un octet
  // étranger collé au JSON (avertissement du moteur node, message du lanceur local) cassait le
  // parse, un `catch { return [] }` rendait « aucun défaut » et le commit passait avec un lint ROUGE.
  const json = JSON.stringify([
    {
      filePath: join(RACINE, 'src', 'x.ts'),
      messages: [{ line: 3, column: 1, severity: 2, ruleId: 'no-irregular-whitespace', message: 'Irregular whitespace not allowed' }],
    },
  ])
  const AVERTISSEMENT = '(node:8124) ExperimentalWarning: Type Stripping is an experimental feature'
  const LANCEUR = 'outillage local: eslint resolu depuis node_modules'

  assert.equal(defautsDeRapport(json, RACINE).length, 1, 'stdout pur : le défaut du fichier')
  for (const [nom, bruit] of [['avertissement node', AVERTISSEMENT], ['message du lanceur local', LANCEUR]]) {
    const defauts = defautsDeRapport(`${json}\n${bruit}\n`, RACINE)
    assert.equal(defauts.length, 1, `${nom} : le rapport pollué doit rendre UN défaut, pas un lot vide`)
    assert.equal(defauts[0].site, '(lint)')
    assert.match(defauts[0].message, /rapport illisible/)
  }
  // Une sortie VIDE reste un lot vide : rien à lire n'est pas une erreur (aucun fichier à juger).
  assert.deepEqual(defautsDeRapport('   ', RACINE), [])
})

test('FAIL-CLOSED — eslint qui échoue SANS rapport (outil absent) est un refus nommé', () => {
  // Racine sans `node_modules/eslint` : `lancer-local.mjs` refuse (exit 2) et n'écrit rien sur stdout.
  const racine = mkdtempSync(join(tmpdir(), 'lint-sans-outil-'))
  try {
    mkdirSync(join(racine, 'scripts'), { recursive: true })
    copyFileSync(join(RACINE, 'scripts', 'lancer-local.mjs'), join(racine, 'scripts', 'lancer-local.mjs'))
    writeFileSync(join(racine, 'a.ts'), 'export const a = 1\n')
    const { defauts } = lancerLint(racine, ['a.ts'])
    assert.equal(defauts.length, 1)
    assert.equal(defauts[0].site, '(lint)')
    assert.match(defauts[0].message, /eslint a échoué sans rapport/)
  } finally {
    rmSync(racine, { recursive: true, force: true })
  }
})

test('MORSURE — un fichier fautif est refusé, un fichier IGNORÉ par la config ne l’est pas', () => {
  const dossier = join(RACINE, DOSSIER)
  const ignore = join(RACINE, 'src', 'data', `.lint-fixture-${process.pid}.ts`)
  try {
    mkdirSync(dossier, { recursive: true })
    // Espace insécable dans le code : `no-irregular-whitespace` (eslint:recommended) le refuse.
    writeFileSync(join(dossier, 'fautif.ts'), `export const a =${NBSP}1\n`)
    writeFileSync(join(dossier, 'sain.ts'), 'export const b = 1\n')
    // `eslint.config.js` ignore `src/data/**` : cité EXPLICITEMENT, il rendrait un avertissement —
    // donc un échec sous `--max-warnings 0` — sans `--no-warn-ignored`.
    writeFileSync(ignore, `export const c =${NBSP}1\n`)

    const relIgnore = `src/data/.lint-fixture-${process.pid}.ts`
    const { defauts, brut } = lancerLint(RACINE, [`${DOSSIER}/fautif.ts`, `${DOSSIER}/sain.ts`, relIgnore])
    assert.ok(defauts.length >= 1, `aucun défaut rendu — sortie brute : ${brut.slice(0, 400)}`)
    assert.deepEqual(
      defauts.filter((d) => d.site.startsWith(`${DOSSIER}/fautif.ts:`)).map((d) => d.regle),
      ['no-irregular-whitespace'],
    )
    assert.deepEqual(defauts.filter((d) => d.site.includes('sain.ts')), [])
    assert.deepEqual(defauts.filter((d) => d.site.includes('.lint-fixture-')), [])
  } finally {
    rmSync(dossier, { recursive: true, force: true })
    rmSync(ignore, { force: true })
  }
})

test('lot vide : aucun processus lancé, aucun défaut', () => {
  assert.deepEqual(lancerLint(RACINE, []), { defauts: [], brut: '' })
})
