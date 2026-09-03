// La porte au push, vue par le `pre-commit` (#1679 L2). Le cas qui compte est l'ARBRE QUI NE PORTE
// PAS le hook : c'est LUI que le refus vise, et c'est LUI qui faisait planter le pre-commit à
// l'import tant que la liste vivait dans `pre-push.mjs` (ERR_MODULE_NOT_FOUND, avant tout message).
// La fixture reproduit exactement cet arbre : un `scripts/guards/lib/` sans aucun `git-hooks/`.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { FICHIERS_PORTE_AU_PUSH, porteAuPushManquante } from './portePush.mjs'

const ICI = dirname(fileURLToPath(import.meta.url))
const REPO = join(ICI, '..', '..', '..')

test('cet arbre PORTE la porte au push', () => {
  assert.deepEqual(porteAuPushManquante(REPO), [])
})

test('un arbre sans les deux fichiers les nomme, un par un', () => {
  const vide = mkdtempSync(join(tmpdir(), 'sans-porte-'))
  try {
    assert.deepEqual(porteAuPushManquante(vide), FICHIERS_PORTE_AU_PUSH)
    mkdirSync(join(vide, 'scripts', 'git-hooks'), { recursive: true })
    writeFileSync(join(vide, 'scripts', 'git-hooks', 'pre-push'), '#!/bin/sh\n')
    assert.deepEqual(porteAuPushManquante(vide), ['scripts/git-hooks/pre-push.mjs'])
  } finally {
    rmSync(vide, { recursive: true, force: true })
  }
})

test('le module se charge dans un arbre SANS pre-push.mjs — le refus est atteignable', () => {
  const arbre = mkdtempSync(join(tmpdir(), 'porte-sans-hook-'))
  try {
    mkdirSync(join(arbre, 'scripts', 'guards', 'lib'), { recursive: true })
    copyFileSync(join(ICI, 'portePush.mjs'), join(arbre, 'scripts', 'guards', 'lib', 'portePush.mjs'))
    const consommateur = join(arbre, 'scripts', 'git-hooks-absent.mjs')
    writeFileSync(
      consommateur,
      [
        "import { porteAuPushManquante } from './guards/lib/portePush.mjs'",
        'for (const f of porteAuPushManquante(process.argv[2]))',
        "  console.log(`${f} absent : arbre non rebasé sur L2, il pousserait sans porte au push`)",
        '',
      ].join('\n'),
    )
    const vu = spawnSync(process.execPath, [consommateur, arbre], { encoding: 'utf8', timeout: 60_000 })
    assert.equal(vu.status, 0, `le chargement ne doit RIEN faire planter : ${vu.stderr}`)
    assert.ok(!vu.stderr.includes('ERR_MODULE_NOT_FOUND'), vu.stderr)
    assert.match(vu.stdout, /scripts\/git-hooks\/pre-push absent : arbre non rebasé sur L2/)
    assert.match(vu.stdout, /scripts\/git-hooks\/pre-push\.mjs absent/)
  } finally {
    rmSync(arbre, { recursive: true, force: true })
  }
})
