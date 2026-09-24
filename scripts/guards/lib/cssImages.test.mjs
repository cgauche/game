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

/** Un arbre en mémoire : `textes` = `{ chemin: texte }` hors manifeste ; `contenus` rend ENTIER tout texte
 *  dont une ligne porte le motif, comme `grepDe(…, { entiers: true })`. */
const sourceDe = (textes, fichiers = [...IMPORTEURS, COMPOSANT]) => ({
  lire: (rel) => (rel === CHEMIN_MANIFESTE ? JSON.stringify([PRIMITIVE]) : textes[rel] ?? null),
  contenus: (motif) => {
    const re = new RegExp(motif)
    return new Map(Object.entries(textes).filter(([f, t]) => f.startsWith('src/') && t.split('\n').some((l) => re.test(l))))
  },
  lister: () => fichiers,
})
const importeursDe = (...textes) => Object.fromEntries(IMPORTEURS.map((f, i) => [f, textes[i]]))
const reutilises = (source) => [...coteCss(source, { racine: RACINE }).reutilises]

test('coteCss : un composant présent sur le DISQUE mais absent de l’arbre jugé n’est pas réutilisé', () => {
  assert.ok(existsSync(`${RACINE}/${COMPOSANT}`), `${COMPOSANT} doit exister sur le disque pour que le cas morde`)
  const textes = importeursDe("import { RollShell } from './RollShell'\n", "import { RollShell } from './RollShell'\n")
  assert.deepEqual(reutilises(sourceDe(textes)), [COMPOSANT], 'témoin : dans l’arbre, il est réutilisé')
  assert.deepEqual(reutilises(sourceDe(textes, IMPORTEURS)), [])
})

test('coteCss : les arcs sont ceux d’`IMPORT_RE` sur le fichier ENTIER — plusieurs lignes, commentaire, `/` final, `import(` puis `.then(` ; un littéral ne compte pas', () => {
  const formes = [
    "import {\n  RollShell,\n} from\n  './RollShell'\n",
    "import {\n  RollShell,\n} from\n  './RollShell' // primitive\n",
    "import X from './RollShell/'\n",
    "const M = await import(\n  './RollShell').then((m) => m.RollShell)\n",
  ]
  for (const f of formes) assert.deepEqual(reutilises(sourceDe(importeursDe(f, formes[0]))), [COMPOSANT], f)
  assert.deepEqual(reutilises(sourceDe(importeursDe(formes[0], "const p = './RollShell'\n"))), [],
    'un seul importeur réel : le littéral ne compte pas')
})

test('coteCss : l’alias se lit dans le `tsconfig.json` de l’arbre JUGÉ, cibles sous `racine`', () => {
  const tsconfig = (cle) => JSON.stringify({ compilerOptions: { baseUrl: '.', paths: { [`${cle}/*`]: ['src/*'] } } })
  const par = (spec) => importeursDe(`import { R } from '${spec}'\n`, `import { R } from '${spec}'\n`)
  assert.deepEqual(reutilises(sourceDe({ ...par('~/ui/RollShell'), 'tsconfig.json': tsconfig('~') })), [COMPOSANT],
    'un alias que seul l’arbre jugé déclare')
  assert.deepEqual(reutilises(sourceDe(par('@/ui/RollShell'))), [], 'l’arbre jugé sans `tsconfig.json` n’a aucun alias, quoi qu’en dise le disque')
})
