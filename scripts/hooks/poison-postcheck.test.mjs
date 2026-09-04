// Volet POINTEUR DÉRÉFÉRENCÉ du hook au stylo : une note de `.claude/**` ou `docs/**` qui cite un
// ticket par son seul numéro se relit sans savoir de quoi il s'agit. Le hook est lancé POUR DE VRAI
// (spawnSync + stdin JSON) ; il n'écrit rien et ne décide rien (PostToolUse = contexte).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const HOOK = join(REPO, 'scripts', 'hooks', 'poison-postcheck.mjs')

/** Contexte RENDU par le hook (`''` s'il se tait). */
function contexteDe(tool_input) {
  const run = spawnSync(process.execPath, [HOOK], {
    input: JSON.stringify({ tool_input }), encoding: 'utf8', cwd: REPO,
  })
  assert.equal(run.status, 0, 'le hook a quitté en ' + run.status + ' : ' + run.stderr)
  if (!run.stdout.trim()) return ''
  return JSON.parse(run.stdout).hookSpecificOutput.additionalContext
}

test('un numéro de ticket NU écrit dans docs/ est signalé, avec la ligne fautive', () => {
  const ctx = contexteDe({
    file_path: join(REPO, 'docs', 'plans', 'exemple.md'),
    old_string: '',
    new_string: '- reste à traiter #1591 après la vague\n',
  })
  assert.match(ctx, /POINTEUR DÉRÉFÉRENCÉ/)
  assert.match(ctx, /#1591/)
  assert.match(ctx, /gh issue view/)
})

test('le TITRE recollé sur la même ligne suffit (guillemets ou parenthèse)', () => {
  const cite = { file_path: join(REPO, '.claude', 'memory', 'exemple.md'), old_string: '' }
  assert.equal(contexteDe({ ...cite, new_string: '- #1591 « garde de capture des runners » : posé\n' }), '')
  assert.equal(contexteDe({ ...cite, new_string: '- #1591 (garde de capture des runners) : posé\n' }), '')
})

test('hors .claude/ et docs/, et sur une ligne INCHANGÉE, le volet se tait', () => {
  assert.equal(contexteDe({
    file_path: join(REPO, 'server', 'notes.md'), old_string: '', new_string: 'voir #1591\n',
  }), '')
  assert.equal(contexteDe({
    file_path: join(REPO, 'docs', 'plans', 'exemple.md'),
    old_string: 'voir #1591\nautre', new_string: 'voir #1591\nautre chose',
  }), '', 'seules les lignes AJOUTÉES comptent')
})

test('le périmètre se juge sur le chemin RELATIF à la racine du dépôt, jamais sur une sous-chaîne du chemin absolu', () => {
  // Un worktree lié vit sous `.claude/worktrees/<agent>/` : par sous-chaîne, tout fichier y serait
  // une note suivie. Le même défaut se reproduit sans worktree avec un dossier `.claude/` ou `docs/`
  // NON racine — c'est la forme mordue ici, identique en arbre principal et en worktree.
  assert.equal(contexteDe({
    file_path: join(REPO, 'server', '.claude', 'notes.md'), old_string: '', new_string: 'voir #1591\n',
  }), '', 'un `.claude/` non racine n’est pas le périmètre des notes')
  assert.equal(contexteDe({
    file_path: join(REPO, 'src', 'docs', 'notes.md'), old_string: '', new_string: 'voir #1591\n',
  }), '', 'un `docs/` non racine n’est pas le périmètre des notes')
  assert.match(contexteDe({
    file_path: join(REPO, '.claude', 'memory', 'exemple.md'), old_string: '', new_string: 'voir #1591\n',
  }), /POINTEUR DÉRÉFÉRENCÉ/, 'la mémoire à la racine reste suivie')
})
