// Contrat du filigrane d'arbre : la ligne est mesurée sur un DÉPÔT RÉEL jetable (vrais `git`), pas
// sur un double injecté — c'est la sortie de git qui doit être lue juste, y compris quand l'arbre
// porte du travail non committé.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { enteteArbre } from './enteteArbre.mjs'

/** Dépôt jetable d'un commit, propre. */
function depot() {
  const racine = mkdtempSync(join(tmpdir(), 'entete-arbre-'))
  const git = (...a) => execFileSync('git', a, { cwd: racine, encoding: 'utf8' })
  git('init', '-q', '-b', 'principale')
  git('config', 'user.email', 'sonde@local')
  git('config', 'user.name', 'Sonde')
  git('config', 'commit.gpgsign', 'false')
  writeFileSync(join(racine, 'a.txt'), 'a\n')
  git('add', 'a.txt')
  git('commit', '-q', '-m', 'sujet du dernier commit')
  return { racine, git }
}

test('arbre PROPRE : sha court, sujet du dernier commit, zéro fichier non committé', () => {
  const { racine, git } = depot()
  try {
    const ligne = enteteArbre(racine)
    const sha = git('rev-parse', '--short', 'HEAD').trim()
    assert.equal(ligne, `arbre ${sha} « sujet du dernier commit » + 0 fichier(s) non committé(s)`)
  } finally {
    rmSync(racine, { recursive: true, force: true })
  }
})

test('arbre SALE : chaque fichier non committé est compté (suivi modifié ET non suivi)', () => {
  const { racine } = depot()
  try {
    writeFileSync(join(racine, 'a.txt'), 'a modifié\n')
    writeFileSync(join(racine, 'b.txt'), 'b\n')
    assert.match(enteteArbre(racine), / \+ 2 fichier\(s\) non committé\(s\)$/)
  } finally {
    rmSync(racine, { recursive: true, force: true })
  }
})

test('le sujet est BORNÉ à 70 caractères (une ligne de filigrane reste lisible)', () => {
  const { racine, git } = depot()
  try {
    const long = 'x'.repeat(120)
    writeFileSync(join(racine, 'a.txt'), 'encore\n')
    execFileSync('git', ['commit', '-q', '-am', long], { cwd: racine })
    const ligne = enteteArbre(racine)
    assert.ok(ligne.includes(`« ${'x'.repeat(70)} »`), ligne)
    assert.ok(!ligne.includes('x'.repeat(71)), 'le sujet déborde de sa borne')
    assert.ok(ligne.startsWith(`arbre ${git('rev-parse', '--short', 'HEAD').trim()} `))
  } finally {
    rmSync(racine, { recursive: true, force: true })
  }
})

test('le lecteur git est injectable pour la mesure, sans changer la FORME de la ligne', () => {
  const faux = (args) => {
    if (args[0] === 'status') return 'M a.txt\n?? b.txt\n?? c.txt'
    if (args[0] === 'rev-parse') return 'abc1234'
    return 'un sujet'
  }
  assert.equal(enteteArbre('/peu-importe', faux), 'arbre abc1234 « un sujet » + 3 fichier(s) non committé(s)')
})
