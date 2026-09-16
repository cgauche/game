// CLIQUET du ruleset `main` (node --test, sans réseau) : le corps est PUR, et les contextes de check
// se lisent DANS `ci.yml` — jamais recopiés. Lancé par `npm run test:ops`.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import {
  corpsDuRuleset, contextesRequis, JOBS_NON_VERIFIANTS, NOM, executer, refusGh,
} from './ruleset-main.mjs'
import { jobsCi } from '../gates/gatesDeCi.mjs'

/** Le refus RÉEL de `gh` : execFileSync lève une erreur qui porte le corps sur `stderr`. */
const erreurGh = (stderr) => Object.assign(new Error('Command failed: gh api'), { stderr, status: 1 })

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..', '..')

/** Un `ci.yml` de fixture, écrit sous os.tmpdir() : ce module LIT un fichier, on lui en donne un. */
const ciDeFixture = (texte) => {
  const fichier = join(mkdtempSync(join(tmpdir(), 'wfrp-ruleset-')), 'ci.yml')
  writeFileSync(fichier, texte)
  return fichier
}

test('les contextes se LISENT dans le ci.yml réel : `build` et `migrations` en sont', () => {
  const noms = jobsCi({ cwd: RACINE })
  assert.ok(noms.includes('build'), `jobs lus : ${noms.join(', ')}`)
  assert.ok(noms.includes('migrations'))
  assert.deepEqual(contextesRequis({ cwd: RACINE }), ['build', 'migrations'])
})

test('un job NON VÉRIFIANT est écarté des checks requis, nommément et avec sa raison', () => {
  const fichier = ciDeFixture('jobs:\n  build:\n    runs-on: x\n  fermetures:\n    runs-on: x\n')
  assert.deepEqual(jobsCi({ fichier }), ['build', 'fermetures'])
  assert.deepEqual(contextesRequis({ fichier }), ['build'])
  assert.match(JOBS_NON_VERIFIANTS.fermetures, /APRÈS la publication/)
})

test('un job NEUF devient un check requis sans qu’on touche au script', () => {
  const fichier = ciDeFixture('jobs:\n  build:\n    runs-on: x\n  securite:\n    runs-on: x\n')
  assert.deepEqual(contextesRequis({ fichier }), ['build', 'securite'])
})

test('un ci.yml sans bloc `jobs:` LÈVE au lieu de rendre une règle vide', () => {
  assert.throws(() => jobsCi({ fichier: ciDeFixture('name: CI\non:\n  push:\n') }), /sans bloc `jobs:`/)
})

test('le ruleset est ACTIF sur main : checks requis, non-fast-forward, suppression', () => {
  const corps = corpsDuRuleset(['build', 'migrations'])
  assert.equal(corps.name, NOM)
  assert.equal(corps.enforcement, 'active', 'décision utilisateur 2026-09-16 : « Oui, ruleset actif »')
  assert.equal(corps.target, 'branch')
  assert.deepEqual(corps.conditions.ref_name, { include: ['refs/heads/main'], exclude: [] })
  assert.deepEqual(corps.rules.map((r) => r.type), ['required_status_checks', 'non_fast_forward', 'deletion'])
  assert.equal(corps.rules[0].parameters.strict_required_status_checks_policy, false,
    'la tête verte sur sa branche entre telle quelle : c’est le fast-forward qui garantit l’inclusion')
  assert.deepEqual(corps.rules[0].parameters.required_status_checks, [{ context: 'build' }, { context: 'migrations' }])
})

test('le corps ne porte AUCUN bypass : personne n’entre dans `main` hors de la porte', () => {
  const corps = corpsDuRuleset(['build'])
  assert.equal('bypass_actors' in corps, false,
    'l’intégration GitHub Actions n’est pas exonérable sur un dépôt personnel (HTTP 422 du 2026-09-16) : '
    + 'le corps ne doit pas même porter la clé, sans quoi le serveur refuse tout le ruleset')
  assert.deepEqual(Object.keys(corps).sort(), ['conditions', 'enforcement', 'name', 'rules', 'target'])
})

test('`--dry-run` n’émet AUCUN appel `gh` — ni lecture, ni écriture', () => {
  const appels = []
  const dit = []
  executer({ argv: ['--dry-run'], runner: (args) => { appels.push(args); return '[]' }, sortie: (s) => dit.push(s) })
  assert.deepEqual(appels, [], 'le mode qui n’écrit rien ne doit pas non plus interroger le dépôt')
  assert.match(dit.join(''), /rien n’a été écrit sur GitHub/)
  assert.match(dit.join(''), /"enforcement": "active"/)
})

test('hors `--dry-run`, la mise à jour d’un ruleset EXISTANT passe par PUT sur son id', () => {
  const appels = []
  executer({
    argv: [],
    runner: (args) => { appels.push(args); return JSON.stringify([{ name: NOM, id: 77 }]) },
    sortie: () => {},
  })
  assert.deepEqual(appels[0], ['api', 'repos/cgauche/game/rulesets'])
  assert.deepEqual(appels[1].slice(0, 4), ['api', '-X', 'PUT', 'repos/cgauche/game/rulesets/77'])
})

test('hors `--dry-run`, un ruleset ABSENT est CRÉÉ par POST sur la collection', () => {
  const appels = []
  executer({ argv: [], runner: (args) => { appels.push(args); return '[]' }, sortie: () => {} })
  assert.deepEqual(appels[1].slice(0, 4), ['api', '-X', 'POST', 'repos/cgauche/game/rulesets'])
})

test('un échec `gh` rend exit 1 en portant son corps — jamais avalé, jamais une stack Node', () => {
  const dit = []
  const code = executer({
    argv: [],
    runner: () => { throw erreurGh('gh: Not Found (HTTP 404)') },
    sortie: () => {},
    journal: (s) => dit.push(s),
  })
  assert.equal(code, 1)
  assert.match(dit.join(''), /Not Found \(HTTP 404\)/)
  assert.ok(!/at .*ruleset-main/.test(dit.join('')), 'un refus attendu ne se rend pas en stack Node')
})

test('le corps de l’erreur est lu OÙ QU’IL SOIT (stdout, stderr, message)', () => {
  assert.match(refusGh(erreurGh('boum')), /boum/)
  assert.match(refusGh({ stdout: 'boum' }), /boum/)
  assert.match(refusGh(new Error('boum')), /boum/)
})

test('un geste qui ABOUTIT rend 0', () => {
  assert.equal(executer({ argv: [], runner: () => '[]', sortie: () => {} }), 0)
  assert.equal(executer({ argv: ['--dry-run'], runner: () => '[]', sortie: () => {} }), 0)
})
