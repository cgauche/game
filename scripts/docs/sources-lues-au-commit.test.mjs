// Le régime de transition de `build-all.mjs --empreinte` (aucun pied exigible tant que le commit ne
// porte pas `docs/.sources-lues.json`) ne peut pas devenir une exemption perpétuelle : cette porte
// EXIGE le dérivé au commit. Verte dès le commit qui pose la mécanique, rouge si elle disparaît.
//   node --test scripts/docs/sources-lues-au-commit.test.mjs  (chaîné dans `npm run test:docs`)
import test from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { SOURCES_LUES } from './build-all.mjs'

const ROOT = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim()

/** `true` si git connaît l'objet `<revision>:<chemin>`. */
const auDepot = (revision) => {
  try {
    execFileSync('git', ['cat-file', '-e', `${revision}:${SOURCES_LUES}`], { cwd: ROOT, stdio: 'ignore' })
    return true
  } catch {
    return false
  }
}

test('la mécanique d\'empreinte est AU COMMIT : docs/.sources-lues.json est suivi', () => {
  assert.ok(
    auDepot('HEAD') || auDepot(''),
    `${SOURCES_LUES} n'est ni dans HEAD ni dans l'index : tant qu'il y manque, --empreinte ne juge RIEN `
      + '(régime de transition). Régénérer par `npm run docs:build` et le committer avec les docs.',
  )
})

test('la sonde n\'est pas muette : elle reconnaît un fichier que le dépôt porte', () => {
  execFileSync('git', ['cat-file', '-e', 'HEAD:package.json'], { cwd: ROOT, stdio: 'ignore' })
  assert.throws(() => execFileSync('git', ['cat-file', '-e', 'HEAD:fichier-qui-nexiste-pas.md'], { cwd: ROOT, stdio: 'ignore' }))
})
