// Tests du garde `git-destructive-guard` : `ask` sur un git destructif RÉELLEMENT exécuté, silence
// sur la même chaîne simplement CITÉE. Lancé par `npm run test:hooks`.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { evaluate } from './git-destructive-guard.mjs'

const asks = (cmd) => evaluate(cmd) !== null
const silent = (cmd) => evaluate(cmd) === null

test('ASK : les commandes destructives réellement exécutées', () => {
  assert.ok(asks('git reset --hard origin/main'))
  assert.ok(asks('git checkout -- src/engine/combat.ts'))
  assert.ok(asks('git checkout .'))
  assert.ok(asks('git restore src/ui/RollShell.tsx'))
  assert.ok(asks('git clean -fd'))
  assert.ok(asks('git clean -fdx'))
  assert.ok(asks('git stash'))
  assert.ok(asks('git stash pop'))
  assert.ok(asks('git push --force origin main'))
  assert.ok(asks('git push -f'))
  assert.ok(asks('git push --force-with-lease'))
})

test('ASK : destructif en 2e maillon d\'un enchaînement, ou via un chemin/call-operator', () => {
  assert.ok(asks('npm test && git reset --hard'))
  assert.ok(asks('& "C:\\Program Files\\Git\\git.exe" stash'))
  assert.ok(asks('git -C ../worktree reset --hard'))
})

test('SILENCE : opérations git non destructives', () => {
  assert.ok(silent('git status'))
  assert.ok(silent('git stash list'))
  assert.ok(silent('git stash show -p'))
  assert.ok(silent('git restore --staged src/data/qualities.json'))
  assert.ok(silent('git reset HEAD~1'))          // reset sans --hard (index seulement)
  assert.ok(silent('git checkout -b chantier'))  // création de branche
  assert.ok(silent('git push origin main'))
  assert.ok(silent('git clean -n'))              // dry-run
})

test('SILENCE : la commande destructive CITÉE dans une chaîne n\'exécute rien', () => {
  // Faux positif mesuré 2026-08-03 sur l'ancien grep de sous-chaîne : ces 4 commandes étaient
  // bloquées alors qu'aucune n'exécute git.
  assert.ok(silent('Write-Output "git stash"'))
  assert.ok(silent('echo "git reset --hard"'))
  assert.ok(silent('git commit -m "doc: ne jamais faire git reset --hard sur un arbre partagé"'))
  assert.ok(silent('gh issue create --title X --label bug --body "éviter git clean -fd ici"'))
})
