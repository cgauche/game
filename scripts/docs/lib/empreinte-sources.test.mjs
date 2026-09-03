// Contrat du DELTA de `docs/.sources-lues.json` (#1679 L2) : un rouge de fraîcheur NOMME ce qui a
// bougé — générateur, champ, chemins — au lieu de dire « PÉRIMÉ » et rien d'autre.
//   node --test scripts/docs/lib/empreinte-sources.test.mjs
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { deltaSourcesLues } from './empreinte-sources.mjs'

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

test('le rouge de fraîcheur de build-all.mjs PASSE par deltaSourcesLues', () => {
  const source = readFileSync(path.join(ICI, '..', 'build-all.mjs'), 'utf8')
  assert.match(source, /import \{[\s\S]*?\bdeltaSourcesLues\b[\s\S]*?\} from '\.\/lib\/empreinte-sources\.mjs'/)
  assert.match(source, /\bdeltaSourcesLues\(avant, mesure\)/)
  assert.match(source, /if \(actuel !== rendu\) \{\n\s*process\.stderr\.write\(diagnosticSourcesLues\(/)
})
