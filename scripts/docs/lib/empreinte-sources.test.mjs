// Contrat du DELTA de `docs/.sources-lues.json` (#1679 L2) et de l'APERÇU des divergences de CORPS
// (#1709) : un rouge de fraîcheur NOMME ce qui a bougé — générateur, champ, chemins d'un côté,
// lignes divergentes des deux côtés de l'autre — au lieu de dire « PÉRIMÉ » et rien d'autre.
//   node --test scripts/docs/lib/empreinte-sources.test.mjs
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { apercuDivergences, deltaSourcesLues } from './empreinte-sources.mjs'

const ICI = path.dirname(fileURLToPath(import.meta.url))

const entree = (fichiers = [], dossiers = [], cibles = []) => ({ cibles, fichiers, dossiers })

// Chemin de doc ASSEMBLÉ : un littéral `docs/<nom>.md` qui ne désigne AUCUN doc réel est lu par
// `scripts/docs/check-doc-refs.mjs` comme une référence vivante — qu'il déclare morte.
const doc = (nom) => ['docs', `${nom}.md`].join('/')

test('deltaSourcesLues : deux mesures identiques ne rendent rien', () => {
  const m = { 'scripts/docs/build-systemes.mjs': entree(['src/a.ts', 'src/b.ts'], ['src/data'], ['docs/systemes.md']) }
  assert.deepEqual(deltaSourcesLues(m, structuredClone(m)), [])
})

test('deltaSourcesLues : un fichier AJOUTÉ, un dossier RETIRÉ, nommés par champ', () => {
  const avant = { 'g.mjs': entree(['src/a.ts'], ['src/data', 'src/ui']) }
  const apres = { 'g.mjs': entree(['src/a.ts', 'src/neuf.ts'], ['src/data']) }
  assert.deepEqual(deltaSourcesLues(avant, apres), [
    { generateur: 'g.mjs', champ: 'dossiers', ajoutes: [], retires: ['src/ui'] },
    { generateur: 'g.mjs', champ: 'fichiers', ajoutes: ['src/neuf.ts'], retires: [] },
  ])
})

test('deltaSourcesLues : un générateur absent d\'un côté rend TOUT son champ', () => {
  const avant = { 'parti.mjs': entree(['src/a.ts'], [], [doc('parti')]) }
  const apres = { 'neuf.mjs': entree(['src/b.ts'], ['src/data'], [doc('neuf')]) }
  assert.deepEqual(deltaSourcesLues(avant, apres), [
    { generateur: 'neuf.mjs', champ: 'cibles', ajoutes: [doc('neuf')], retires: [] },
    { generateur: 'neuf.mjs', champ: 'dossiers', ajoutes: ['src/data'], retires: [] },
    { generateur: 'neuf.mjs', champ: 'fichiers', ajoutes: ['src/b.ts'], retires: [] },
    { generateur: 'parti.mjs', champ: 'cibles', ajoutes: [], retires: [doc('parti')] },
    { generateur: 'parti.mjs', champ: 'fichiers', ajoutes: [], retires: ['src/a.ts'] },
  ])
})

test('deltaSourcesLues : ordre des chemins et des générateurs déterministe', () => {
  const avant = { b: entree([]), a: entree(['z.ts']) }
  const apres = { a: entree([]), b: entree(['m.ts', 'a.ts', 'z.ts']) }
  assert.deepEqual(deltaSourcesLues(avant, apres), [
    { generateur: 'a', champ: 'fichiers', ajoutes: [], retires: ['z.ts'] },
    { generateur: 'b', champ: 'fichiers', ajoutes: ['a.ts', 'm.ts', 'z.ts'], retires: [] },
  ])
})

const A = 'a\nb\nc'

test('apercuDivergences : doc committé ABSENT', () => {
  assert.equal(apercuDivergences(A, null), 'le doc committé est ABSENT du dépôt')
})

test('apercuDivergences : corps IDENTIQUES, aucun aperçu', () => {
  assert.equal(apercuDivergences(A, A), '')
  assert.equal(apercuDivergences('a', 'a'), '')
})

test('apercuDivergences : ligne qui DIVERGE, nommée puis rendue des DEUX côtés', () => {
  assert.equal(
    apercuDivergences(A, 'a\nX\nc'),
    'ligne 2 — committé : "X" / régénéré : "b"\nl.2\n  committé : "X"\n  régénéré : "b"',
  )
})

test('apercuDivergences : committé PRÉFIXE du régénéré — la ligne MANQUE, jamais « undefined »', () => {
  assert.equal(
    apercuDivergences(A, 'a\nb'),
    'ligne 3 MANQUE au committé : "c"\nl.3\n  committé : <absente>\n  régénéré : "c"',
  )
})

test('apercuDivergences : régénéré PRÉFIXE du committé — la ligne est EN TROP, jamais « ligne 0 »', () => {
  assert.equal(
    apercuDivergences('a\nb', A),
    'ligne 3 EN TROP au committé : "c"\nl.3\n  committé : "c"\n  régénéré : <absente>',
  )
})

test('apercuDivergences : toutes les lignes divergentes des deux côtés, le reste COMPTÉ', () => {
  assert.equal(
    apercuDivergences('a\nb\nc', 'a\nX\nY'),
    'ligne 2 — committé : "X" / régénéré : "b"\n' +
      'l.2\n  committé : "X"\n  régénéré : "b"\n' +
      'l.3\n  committé : "Y"\n  régénéré : "c"',
  )
  assert.equal(
    apercuDivergences('x\nx\nx', 'y\ny\ny', 2),
    'ligne 1 — committé : "y" / régénéré : "x"\n' +
      'l.1\n  committé : "y"\n  régénéré : "x"\n' +
      'l.2\n  committé : "y"\n  régénéré : "x"\n' +
      '… et 1 autre(s) ligne(s) divergente(s)',
  )
})

test('apercuDivergences : une ligne longue est BORNÉE à 240 caractères', () => {
  const apercu = apercuDivergences('z'.repeat(300), 'a')
  assert.ok(apercu.includes(`${'z'.repeat(240)}…`))
  assert.ok(!apercu.includes('z'.repeat(241)))
})

test('le rouge de fraîcheur d’emitOrCheck PASSE par apercuDivergences', () => {
  const source = readFileSync(path.join(ICI, 'jsdocUnion.mjs'), 'utf8')
  assert.match(source, /import \{[\s\S]*?\bapercuDivergences\b[\s\S]*?\} from '\.\/empreinte-sources\.mjs'/)
  assert.match(source, /console\.error\(staleMsg\)\n\s*console\.error\(apercuDivergences\(out, current\)\)/)
})

test('le rouge de fraîcheur de build-all.mjs PASSE par deltaSourcesLues', () => {
  const source = readFileSync(path.join(ICI, '..', 'build-all.mjs'), 'utf8')
  assert.match(source, /import \{[\s\S]*?\bdeltaSourcesLues\b[\s\S]*?\} from '\.\/lib\/empreinte-sources\.mjs'/)
  assert.match(source, /\bdeltaSourcesLues\(avant, mesure\)/)
  assert.match(source, /if \(actuel !== rendu\) \{\n\s*process\.stderr\.write\(diagnosticSourcesLues\(/)
})
