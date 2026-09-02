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

// ── Liens sur node_modules (#1679 L1c) ─────────────────────────────────────────────────────

const refuse = (cmd) => evaluate(cmd)?.decision === 'deny'
const BS = String.fromCharCode(92) // antislash Windows, sans échappement à relire
const WT = 'C:' + BS + 'w' + BS + '.wt-1679' + BS + 'node_modules'
const PRINCIPAL = 'C:' + BS + 'w' + BS + 'Game' + BS + 'node_modules'

test('DENY : les quatre graphies de lien vers un node_modules', () => {
  assert.ok(refuse(`New-Item -ItemType Junction -Path "${WT}" -Target "${PRINCIPAL}"`))
  assert.ok(refuse('New-Item -ItemType SymbolicLink -Path .wt-1679/node_modules -Target ../node_modules'))
  assert.ok(refuse(`mklink /J "${WT}" "${PRINCIPAL}"`))
  assert.ok(refuse('ln -s ../Game/node_modules ./node_modules'))
})

test('DENY : le refus dit POURQUOI et ce qu\'il faut faire à la place', () => {
  const d = evaluate('ln -s ../Game/node_modules ./node_modules')
  assert.equal(d.decision, 'deny')
  assert.match(d.reason, /node_modules/)
  assert.match(d.reason, /npm ci/)
})

test('PASSE : un lien qui ne touche AUCUN node_modules', () => {
  assert.ok(silent(`New-Item -ItemType Junction -Path .${BS}Source -Target ..${BS}Source`))
  assert.ok(silent('ln -s ../Game/src/data/qualities.json ./qualities.json'))
})

test('PASSE : New-Item ordinaire, et la commande simplement CITÉE', () => {
  assert.ok(silent('New-Item -ItemType Directory -Force node_modules'))
  assert.ok(silent('git commit -m "doc: jamais de junction sur node_modules (ln -s ../node_modules)"'))
})

test('un git destructif reste un ASK, jamais un DENY', () => {
  assert.equal(evaluate('git reset --hard').decision, 'ask')
})

// Deux trous MESURÉS du deny (juge #1679 L1c) : PowerShell accepte tout préfixe NON AMBIGU d'un
// nom de paramètre, et `mklink` est un builtin de `cmd` — l'exécutable lu était alors `cmd`.

test('DENY : `-ItemType` abrégé en préfixe non ambigu (PowerShell l\'accepte)', () => {
  for (const p of ['-it', '-item', '-itemt', '-ItemTy', '-ITEMTYPE']) {
    const d = evaluate(`New-Item ${p} Junction -Path .wt-1679${BS}node_modules -Target ..${BS}node_modules`)
    assert.equal(d?.decision, 'deny', p)
    assert.match(d.reason, /node_modules/)
    assert.match(d.reason, /npm ci/)
  }
})

test('DENY : `mklink` lancé DERRIÈRE cmd /c (builtin, l\'exe lu est `cmd`)', () => {
  const cmds = [
    `cmd /c mklink /J .wt-1679${BS}node_modules ..${BS}node_modules`,
    `cmd.exe /C mklink /D .wt-1679${BS}node_modules ..${BS}node_modules`,
    `cmd /c "cd .wt-1679 & mklink /J node_modules ..${BS}node_modules"`,
    `cmd /c cd .wt-1679 & mklink /J node_modules ..${BS}node_modules`,
  ]
  for (const c of cmds) {
    const d = evaluate(c)
    assert.equal(d?.decision, 'deny', c)
    assert.match(d.reason, /node_modules/)
    assert.match(d.reason, /npm ci/)
  }
})

test('PASSE : le préfixe abrégé ne vise QUE les liens, et cmd sans mklink ne dit rien', () => {
  assert.ok(silent('New-Item -it Directory node_modules'))
  assert.ok(silent(`cmd /c rmdir .wt-1679${BS}node_modules`))
  assert.equal(evaluate('git reset --hard').decision, 'ask')
})
