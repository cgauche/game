// Garde du hook pre-commit : aucun chemin stagé ne descend d'un arbre GIT imbriqué (#1679 L1c).
// La fixture pose de VRAIS dossiers et de VRAIS `.git` — worktree lié (fichier) et clone (dossier) —
// pour que le prédicat par défaut du scanner soit celui qui est mesuré, pas un double injecté.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { scanArbresImbriques } from '../guards/lib/arbreImbrique.mjs'

/** Dépôt hôte : son propre `.git`, un worktree lié `.wt-x`, un clone `outils/copie`, du code à plat. */
function depot() {
  const racine = mkdtempSync(join(tmpdir(), 'arbre-imbrique-'))
  mkdirSync(join(racine, '.git'), { recursive: true })
  mkdirSync(join(racine, 'src'), { recursive: true })
  mkdirSync(join(racine, '.wt-x', 'src'), { recursive: true })
  writeFileSync(join(racine, '.wt-x', '.git'), 'gitdir: ../.git/worktrees/x\n')
  mkdirSync(join(racine, 'outils', 'copie', '.git'), { recursive: true })
  mkdirSync(join(racine, 'outils', 'copie', 'src'), { recursive: true })
  return racine
}

const dossiers = (racine, chemins) => scanArbresImbriques(chemins, { racine }).map((x) => x.dossier)

test('chemins du dépôt hôte : aucun offender, la racine n’est pas son propre imbriqué', () => {
  const racine = depot()
  try {
    assert.deepEqual(dossiers(racine, ['src/store.ts', 'package.json', '.git/config']), [])
  } finally {
    rmSync(racine, { recursive: true, force: true })
  }
})

test('worktree LIÉ (`.git` FICHIER) : offender nommé, avec le geste de retrait', () => {
  const racine = depot()
  try {
    const vus = scanArbresImbriques(['.wt-x/src/store.ts'], { racine })
    assert.deepEqual(vus.map((x) => x.dossier), ['.wt-x'])
    assert.match(vus[0].detail, /worktree\/clone imbriqué stagé : \.wt-x/)
    assert.match(vus[0].detail, /git rm --cached -r \.wt-x/)
  } finally {
    rmSync(racine, { recursive: true, force: true })
  }
})

test('clone imbriqué (`.git` DOSSIER), même à deux niveaux : offender nommé une seule fois', () => {
  const racine = depot()
  try {
    assert.deepEqual(
      dossiers(racine, ['outils/copie/src/a.ts', 'outils/copie/package.json']),
      ['outils/copie'],
    )
  } finally {
    rmSync(racine, { recursive: true, force: true })
  }
})

test('un lot mêlé rend TOUS les arbres imbriqués, triés, et ignore les chemins sains', () => {
  const racine = depot()
  try {
    assert.deepEqual(
      dossiers(racine, ['src/store.ts', 'outils/copie/src/a.ts', '.wt-x/src/b.ts']),
      ['.wt-x', 'outils/copie'],
    )
  } finally {
    rmSync(racine, { recursive: true, force: true })
  }
})

test('séparateurs Windows dans le chemin stagé : même verdict', () => {
  const racine = depot()
  try {
    assert.deepEqual(dossiers(racine, ['.wt-x\\src\\store.ts']), ['.wt-x'])
  } finally {
    rmSync(racine, { recursive: true, force: true })
  }
})
