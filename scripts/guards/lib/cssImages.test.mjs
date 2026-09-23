// La LECTURE des images CSS (`cssImages.mjs`, #1806) : le côté d'un arbre se résout contre les SEULS
// fichiers de cet arbre. Source en mémoire, racine = ce dépôt, dont le disque porte le composant cité.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { CHEMIN_MANIFESTE } from './cssCouches.mjs'
import { coteCss } from './cssImages.mjs'

const RACINE = fileURLToPath(new URL('../../..', import.meta.url))
const COMPOSANT = 'src/ui/RollShell.tsx'
const IMPORTEURS = ['A', 'B'].map((n) => `src/ui/Ecran${n}.tsx`)
const MODULE = 'src/ui/styles/rs.css'
const PRIMITIVE = { id: 'rs', fichier: COMPOSANT, css: MODULE }

/** Un arbre en mémoire : le manifeste revendique `COMPOSANT`, deux écrans l'importent. */
const source = (fichiers) => ({
  lire: (rel) => (rel === CHEMIN_MANIFESTE ? JSON.stringify([PRIMITIVE]) : null),
  grep: () => new Map(IMPORTEURS.map((f) => [f, "import { RollShell } from './RollShell'\n"])),
  lister: () => fichiers,
})

test('coteCss : un composant présent sur le DISQUE mais absent de l’arbre jugé n’est pas réutilisé', () => {
  assert.ok(existsSync(`${RACINE}/${COMPOSANT}`), `${COMPOSANT} doit exister sur le disque pour que le cas morde`)
  assert.deepEqual([...coteCss(source([...IMPORTEURS, COMPOSANT]), { racine: RACINE }).reutilises], [COMPOSANT], 'témoin : dans l’arbre, il est réutilisé')
  assert.deepEqual([...coteCss(source(IMPORTEURS), { racine: RACINE }).reutilises], [])
})
