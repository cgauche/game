// CLIQUET de la fermeture DEPUIS main (node --test, sans réseau) : les deux décisions du script sont
// PURES, et la lecture de la plage se joue sur un dépôt JETABLE sous `os.tmpdir()`.
// Lancé par `npm run test:ops`.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  fermeturesDeLaPlage, decisionPour, marqueDe, commitsDeLaPlage, soldeDuCommit,
  avertissementRapportee, motifDePlageIllisible,
} from './fermer-depuis-main.mjs'

test('un ticket cité par plusieurs commits est rattaché au PREMIER qui le cite', () => {
  const r = fermeturesDeLaPlage([
    { sha: 'aaa', message: 'feat: corrige #10 et ferme #11' },
    { sha: 'bbb', message: 'fix: corrige #10 encore' },
  ])
  assert.deepEqual(r, [{ numero: '10', sha: 'aaa' }, { numero: '11', sha: 'aaa' }])
})

test('les quatre verbes de fermeture sont reconnus, et rien d’autre', () => {
  const r = fermeturesDeLaPlage([{ sha: 'a', message: 'fixes #1 closes #2 corrige #3 ferme #4 refs #5 voir #6' }])
  assert.deepEqual(r.map((x) => x.numero), ['1', '2', '3', '4'])
})

test('issue OUVERTE → on ferme', () => {
  assert.equal(decisionPour({ etat: 'open', commentaires: [], sha: 'aaa' }), 'fermer')
})

test('issue déjà fermée PAR CE SHA (rejeu du job) → rien à faire : la fermeture est IDEMPOTENTE', () => {
  assert.equal(decisionPour({ etat: 'closed', commentaires: [`solde\n${marqueDe('aaa')}`], sha: 'aaa' }), 'rien')
})

test('issue fermée par un AUTRE geste → RAPPORTÉE, jamais refermée en silence', () => {
  assert.equal(decisionPour({ etat: 'closed', commentaires: ['fermée à la main'], sha: 'aaa' }), 'rapporter')
  assert.equal(decisionPour({ etat: 'closed', commentaires: [marqueDe('bbb')], sha: 'aaa' }), 'rapporter')
})

test('une issue déjà fermée ailleurs s’AVERTIT : le job ne rougit pas sur un commit qui a fait son travail', () => {
  const ligne = avertissementRapportee('42', 'aaa')
  assert.match(ligne, /^::warning::/, 'GitHub Actions ne remonte l’annotation que sous cette forme')
  assert.match(ligne, /#42 déjà FERMÉE par un autre geste que aaa/)
})

test('plage dont la BASE est inatteignable : erreur NOMMÉE, jamais une exception brute de git', () => {
  const depot = mkdtempSync(join(tmpdir(), 'wfrp-plage-'))
  try {
    const git = (...args) => execFileSync('git', args, { cwd: depot, encoding: 'utf8' })
    git('init', '-q', '-b', 'main')
    git('config', 'user.email', 'test@example.invalid')
    git('config', 'user.name', 'test')
    git('config', 'core.hooksPath', 'hooks-absents')
    writeFileSync(join(depot, 'a.txt'), 'a')
    git('add', '-A'); git('commit', '-q', '-m', 'base')
    const base = git('rev-parse', 'HEAD').trim()
    writeFileSync(join(depot, 'a.txt'), 'b')
    git('add', '-A'); git('commit', '-q', '-m', 'suite')
    const tete = git('rev-parse', 'HEAD').trim()

    assert.equal(motifDePlageIllisible(`${base}..${tete}`, depot), null, 'une plage fast-forward est lisible')
    const absent = '0'.repeat(40)
    const motif = motifDePlageIllisible(`${absent}..${tete}`, depot)
    assert.match(motif, new RegExp(`base ${absent} inatteignable depuis ${tete}`))
    assert.match(motif, /push non fast-forward sur main, interdit par le pre-push/)
  } finally { rmSync(depot, { recursive: true, force: true }) }
})

test('la plage se lit dans l’histoire, et le solde est celui que le COMMIT emporte', () => {
  const depot = mkdtempSync(join(tmpdir(), 'wfrp-fermer-'))
  try {
    const git = (...args) => execFileSync('git', args, { cwd: depot, encoding: 'utf8' })
    git('init', '-q', '-b', 'main')
    git('config', 'user.email', 'test@example.invalid')
    git('config', 'user.name', 'test')
    git('config', 'core.hooksPath', 'hooks-absents')
    writeFileSync(join(depot, 'a.txt'), 'a')
    git('add', '-A'); git('commit', '-q', '-m', 'base')
    const base = git('rev-parse', 'HEAD').trim()
    mkdirSync(join(depot, '.claude', 'soldes'), { recursive: true })
    writeFileSync(join(depot, '.claude', 'soldes', '42.md'), 'VERIFIE: le solde emporté\n')
    writeFileSync(join(depot, 'a.txt'), 'b')
    git('add', '-A'); git('commit', '-q', '-m', 'feat: corrige #42')
    const tete = git('rev-parse', 'HEAD').trim()

    const commits = commitsDeLaPlage(`${base}..${tete}`, depot)
    assert.equal(commits.length, 1)
    assert.match(commits[0].message, /corrige #42/)
    assert.deepEqual(fermeturesDeLaPlage(commits), [{ numero: '42', sha: tete }])
    assert.match(soldeDuCommit(tete, 42, depot), /VERIFIE: le solde emporté/)
    assert.equal(soldeDuCommit(base, 42, depot), null, 'le solde n’existait pas au commit de base')
  } finally { rmSync(depot, { recursive: true, force: true }) }
})
