// La porte CRLF de l'index : volet PUR (sorties littérales de `git ls-files --eol`) et volet MESURÉ
// sur un dépôt JETABLE, où le blob CRLF est fabriqué par le seul chemin qui le produit en vrai
// (`git apply --index`, qui ne renormalise pas).
import test from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { cheminsMalNormalises, raisonDeRefusEol } from './eolStage.mjs'

const TAB = '\t'
const ligne = (i, attr, chemin) => `i/${i}    w/lf    attr/${attr} ${TAB}${chemin}`

test('un blob d’index en CRLF sur un chemin déclaré eol=lf est fautif', () => {
  assert.deepEqual(
    cheminsMalNormalises(ligne('crlf', 'text=auto eol=lf', 'src/a.ts')),
    [{ chemin: 'src/a.ts', index: 'crlf' }],
  )
})

test('un blob MIXTE l’est aussi — il porte des \\r, c’est tout ce qui compte', () => {
  assert.deepEqual(
    cheminsMalNormalises(ligne('mixed', 'text=auto eol=lf', 'notes/b.md')),
    [{ chemin: 'notes/b.md', index: 'mixed' }],
  )
})

test('un blob en LF, vide ou binaire ne dit rien', () => {
  const sortie = [
    ligne('lf', 'text=auto eol=lf', 'src/a.ts'),
    ligne('none', 'text=auto eol=lf', 'src/vide.ts'),
    ligne('-text', 'binary', 'public/x.png'),
  ].join('\n')
  assert.deepEqual(cheminsMalNormalises(sortie), [])
})

test('un chemin SANS eol=lf n’est pas jugé, CRLF ou non (angle mort dit)', () => {
  assert.deepEqual(cheminsMalNormalises(ligne('crlf', 'text', 'vendor/c.txt')), [])
  assert.deepEqual(cheminsMalNormalises(ligne('crlf', '', 'vendor/d.txt')), [])
})

test('un chemin à ESPACES est rendu entier : c’est la TABULATION qui coupe, pas l’espace', () => {
  assert.deepEqual(
    cheminsMalNormalises(ligne('crlf', 'text=auto eol=lf', 'Source/WH - V4 - Aux Armes/x.md')),
    [{ chemin: 'Source/WH - V4 - Aux Armes/x.md', index: 'crlf' }],
  )
})

test('une sortie vide ou du bruit ne produit aucun fautif', () => {
  assert.deepEqual(cheminsMalNormalises(''), [])
  assert.deepEqual(cheminsMalNormalises('warning: ceci n’est pas une ligne de ls-files'), [])
})

test('le refus NOMME les chemins ET le geste de réparation', () => {
  assert.equal(raisonDeRefusEol([]), null)
  const msg = raisonDeRefusEol([{ chemin: 'src/a.ts', index: 'crlf' }])
  assert.match(msg, /src\/a\.ts \(i\/crlf\)/)
  assert.match(msg, /git add --renormalize src\/a\.ts/)
})

test('dépôt JETABLE : `git apply --index` d’un patch CRLF stage un blob CRLF, et la porte le voit', () => {
  const dir = mkdtempSync(join(tmpdir(), 'eol-stage-'))
  const git = (...args) => execFileSync('git', args, { cwd: dir, encoding: 'utf8' })
  try {
    git('init', '-q', '-b', 'main')
    git('config', 'user.email', 'x@y.z')
    git('config', 'user.name', 'x')
    git('config', 'core.autocrlf', 'true')
    writeFileSync(join(dir, '.gitattributes'), '* text=auto eol=lf\n')
    writeFileSync(join(dir, 'a.txt'), 'une\ndeux\n')
    git('add', '.gitattributes', 'a.txt')
    git('commit', '-q', '-m', 'socle', '--no-verify')
    // Le SEUL chemin qui produit le blob fautif : un patch dont les lignes portent `\r`, appliqué à
    // l'index. Un `git add` du disque, lui, renormalise.
    const patch = [
      'diff --git a/b.txt b/b.txt',
      'new file mode 100644',
      '--- /dev/null',
      '+++ b/b.txt',
      '@@ -0,0 +1,2 @@',
      '+une\r',
      '+deux\r',
      '',
    ].join('\n')
    writeFileSync(join(dir, 'p.patch'), patch)
    git('apply', '--index', '--whitespace=nowarn', 'p.patch')
    const sortie = git('ls-files', '--eol', '--cached', '--', 'a.txt', 'b.txt')
    // `a.txt`, stagé par `git add`, est en LF ; `b.txt`, stagé par le patch, ne l'est pas.
    assert.deepEqual(cheminsMalNormalises(sortie).map((f) => f.chemin), ['b.txt'])
    // Et le geste NOMMÉ par le refus le répare.
    git('add', '--renormalize', 'b.txt')
    assert.deepEqual(cheminsMalNormalises(git('ls-files', '--eol', '--cached', '--', 'b.txt')), [])
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})
