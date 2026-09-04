// CLIQUET du ruleset en évaluation et de sa mesure (node --test, sans réseau) : les deux comparateurs
// sont PURS, et les contextes de check se lisent DANS `ci.yml` — jamais recopiés.
// Lancé par `npm run test:ops`.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { corpsDuRuleset, contextesRequis, jobsCi, JOBS_NON_VERIFIANTS, NOM, executer } from './ruleset-evaluate.mjs'
import { partRefusee, rendu } from './rule-suites.mjs'

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const CI = readFileSync(join(RACINE, '.github', 'workflows', 'ci.yml'), 'utf8')

test('les contextes se LISENT dans ci.yml : le job `build` du fichier réel en est un', () => {
  const noms = jobsCi(CI)
  assert.ok(noms.includes('build'), `jobs lus : ${noms.join(', ')}`)
  assert.ok(noms.includes('migrations'))
})

test('un job NON VÉRIFIANT est écarté des checks requis, nommément et avec sa raison', () => {
  const fixture = 'jobs:\n  build:\n    runs-on: x\n  fermetures:\n    runs-on: x\n'
  assert.deepEqual(jobsCi(fixture), ['build', 'fermetures'])
  assert.deepEqual(contextesRequis(fixture), ['build'])
  assert.match(JOBS_NON_VERIFIANTS.fermetures, /APRÈS la publication/)
})

test('un job NEUF devient un check requis sans qu’on touche au script', () => {
  const fixture = 'jobs:\n  build:\n    runs-on: x\n  securite:\n    runs-on: x\n'
  assert.deepEqual(contextesRequis(fixture), ['build', 'securite'])
})

test('un ci.yml sans bloc `jobs:` LÈVE au lieu de rendre une règle vide', () => {
  assert.throws(() => jobsCi('name: CI\non:\n  push:\n'), /sans bloc `jobs:`/)
})

test('le corps du ruleset est en mode ÉVALUATION, sur main, avec ses checks', () => {
  const corps = corpsDuRuleset(['build', 'migrations'])
  assert.equal(corps.name, NOM)
  assert.equal(corps.enforcement, 'evaluate', 'décision utilisateur 3 : aucune protection serveur active à ce stade')
  assert.equal(corps.target, 'branch')
  assert.deepEqual(corps.conditions.ref_name, { include: ['refs/heads/main'], exclude: [] })
  assert.equal(corps.rules.length, 1)
  assert.equal(corps.rules[0].type, 'required_status_checks')
  assert.equal(corps.rules[0].parameters.strict_required_status_checks_policy, false)
  assert.deepEqual(corps.rules[0].parameters.required_status_checks, [{ context: 'build' }, { context: 'migrations' }])
})

test('`--dry-run` n’émet AUCUN appel `gh` — ni lecture, ni écriture', () => {
  const appels = []
  const dit = []
  executer({ argv: ['--dry-run'], runner: (args) => { appels.push(args); return '[]' }, sortie: (s) => dit.push(s) })
  assert.deepEqual(appels, [], 'le mode qui n’écrit rien ne doit pas non plus interroger le dépôt')
  assert.match(dit.join(''), /rien n’a été écrit sur GitHub/)
  assert.match(dit.join(''), /"enforcement": "evaluate"/)
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

test('partRefusee lit les DEUX champs de verdict (actif `result`, évaluation `evaluation_result`)', () => {
  const suites = [
    { pushed_at: '2026-09-03T10:00:00Z', result: 'pass', actor_name: 'a', ref: 'refs/heads/main' },
    { pushed_at: '2026-09-03T11:00:00Z', evaluation_result: 'fail', actor_name: 'b', ref: 'refs/heads/main' },
    { pushed_at: '2026-09-03T12:00:00Z', result: 'fail', actor_name: 'c', ref: 'refs/heads/main' },
  ]
  const r = partRefusee(suites, '2026-09-01')
  assert.equal(r.total, 3)
  assert.equal(r.echecs, 2)
  assert.deepEqual(r.lignes, [
    '2026-09-03T11:00:00Z · b · refs/heads/main',
    '2026-09-03T12:00:00Z · c · refs/heads/main',
  ])
})

test('une suite ANTÉRIEURE à la fenêtre ne compte pas', () => {
  const suites = [{ pushed_at: '2026-08-01T10:00:00Z', result: 'fail' }]
  assert.equal(partRefusee(suites, '2026-09-01').total, 0)
})

test('aucun push évalué : le vide se DIT, avec la date de pose', () => {
  const texte = rendu(partRefusee([], '2026-09-01'), { depuis: '2026-09-01', pose: '2026-09-04' })
  assert.match(texte, /aucun push évalué depuis le 2026-09-04/)
})
