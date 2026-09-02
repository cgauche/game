// La porte de vérité `npm run typecheck` doit rester un typecheck FULL : un `tsc --noEmit`
// incrémental réutilise un tsbuildinfo partagé et peut rendre un vert sur un état périmé.
// Le chemin rapide vit à côté, nommé `typecheck:fast`, et passe par son wrapper.
// Elle doit aussi jouer le tsc de CET arbre : npm empile les `node_modules/.bin` des ANCÊTRES sur le
// PATH, donc un `tsc` nu depuis un worktree sans typescript rendait 0 avec le tsc de l'arbre
// principal (#1679 L1c) — d'où le passage par `scripts/lancer-local.mjs`.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const scripts = JSON.parse(readFileSync(join(REPO, 'package.json'), 'utf8')).scripts

test('`npm run typecheck` est FULL (--incremental false)', () => {
  const commande = scripts.typecheck ?? ''
  assert.match(
    commande,
    /^node scripts\/lancer-local\.mjs typescript -- tsc\b/,
    `scripts.typecheck = "${commande}" — la porte de vérité doit APPELER le tsc de CET arbre, par le ` +
      'lanceur local, pas mentionner ses drapeaux ni s’en remettre au PATH',
  )
  assert.match(
    commande,
    /--noEmit\b/,
    `scripts.typecheck = "${commande}" — sans --noEmit, la porte de vérité ÉMET des fichiers`,
  )
  assert.ok(
    /--incremental\s+false/.test(commande),
    `scripts.typecheck = "${commande}" — sans "--incremental false", la porte de vérité ` +
      'redevient incrémentale et peut rendre un vert sur un cache périmé',
  )
  assert.ok(
    !/\s-p\s|\s--project\s/.test(commande),
    `scripts.typecheck = "${commande}" — un projet explicite détournerait la porte de vérité du tsconfig racine`,
  )
})

test('`npm run typecheck:fast` pointe le wrapper scripts/typecheck-fast.mjs', () => {
  assert.equal(scripts['typecheck:fast'], 'node scripts/typecheck-fast.mjs')
})
