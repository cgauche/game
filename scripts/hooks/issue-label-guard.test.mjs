// Tests du garde `issue-label-guard` : refus de `gh issue create|new` sans label.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { evaluate, isGhIssueCreateSegment, isLabelFlag } from './issue-label-guard.mjs'

const denies = (cmd) => evaluate(cmd) !== null
const allows = (cmd) => evaluate(cmd) === null

test('DENY : gh issue create sans label', () => {
  assert.ok(denies('gh issue create --title "X" --body-file b.md'))
  assert.ok(denies('gh issue new --title "X"'))
})

test('ALLOW : gh issue create AVEC label (toutes graphies)', () => {
  assert.ok(allows('gh issue create --title X --label bug'))
  assert.ok(allows('gh issue create --title X --label "livre:ADE" --label domaine:combat'))
  assert.ok(allows('gh issue create --title X --label=type:donnée'))
  assert.ok(allows('gh issue create --title X -l bug'))
  assert.ok(allows('gh issue create --title X -lbug'))
})

test('ALLOW : autres sous-commandes gh (jamais bloquées)', () => {
  assert.ok(allows('gh issue list --state all'))          // list, pas create
  assert.ok(allows('gh issue edit 5 --add-label bug'))     // edit
  assert.ok(allows('gh label list'))
  assert.ok(allows('gh pr create --title X'))              // pr, pas issue
})

test('ALLOW : la sous-chaîne « gh issue create » citée n\'est pas une création', () => {
  assert.ok(allows('echo "gh issue create --title X"'))            // echo d\'une string
  assert.ok(allows('gh issue list --search "gh issue create"'))    // string quotée = un seul token
})

test('flag global à valeur intercalé avant la sous-commande (adjacence issue/create)', () => {
  assert.ok(denies('gh -R owner/repo issue create --title X'))      // sans label
  assert.ok(allows('gh -R owner/repo issue create --title X --label bug'))
})

test('enchaînements : un segment gh-issue-create sans label dans une chaîne est refusé', () => {
  assert.ok(denies('cd /tmp && gh issue create --title X'))
  assert.ok(allows('cd /tmp && gh issue create --title X --label bug'))
  assert.ok(denies('gh label list && gh issue create --title X'))  // 2e segment sans label
})

test('call-operator PowerShell : & gh issue create', () => {
  assert.ok(denies('& gh issue create --title X'))
})

test('isLabelFlag / isGhIssueCreateSegment (unités)', () => {
  assert.equal(isLabelFlag('--label'), true)
  assert.equal(isLabelFlag('--label=x'), true)
  assert.equal(isLabelFlag('-l'), true)
  assert.equal(isLabelFlag('-lbug'), true)
  assert.equal(isLabelFlag('--title'), false)
  assert.equal(isLabelFlag('bug'), false)
  assert.equal(isGhIssueCreateSegment(['gh', 'issue', 'create']), true)
  assert.equal(isGhIssueCreateSegment(['gh', 'issue', 'new']), true)
  assert.equal(isGhIssueCreateSegment(['gh', 'issue', 'list']), false)
  assert.equal(isGhIssueCreateSegment(['git', 'commit']), false)
})
