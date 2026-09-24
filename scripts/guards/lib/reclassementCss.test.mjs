// L'ÉVÉNEMENT de frontière du stock CSS (#1806 D1″/D2″, `reclassementCss.mjs`) : un module qui
// FRANCHIT la frontière exige UNE ligne `RECLASSEMENT: <module> +N — <motif #ticket>` au N exact ; trois
// refus — franchi sans ligne, ligne sans franchissement, N faux. Aucun disque : les côtés sont en
// mémoire. Joué par `npm run test:hooks`.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  deplaceLaFrontiere, ecartsDeReclassement, franchisDesCotes, raisonDeRefusDeReclassement, reclassementsNonDeclares,
} from './reclassementCss.mjs'
import { motifDeCitation } from './cssImages.mjs'

const Q = 'src/ui/styles/ecran-q.css'
const P = 'src/ui/styles/prim-p.css'
const CSS = '.e { color: red; border: 0; font-size: 3px; gap: 3px }'

/** Un côté : `textes` = `{ chemin: texte }`, `reutilisees` = les modules d'une primitive réutilisée,
 *  `declares` = les modules revendiqués au manifeste (réutilisés ou non). */
const cote = (textes, reutilisees = [], declares = reutilisees) => ({
  manifeste: [{ id: 'sans-css' }, ...declares.map((css) => ({ id: css, fichier: `${css}.tsx`, css }))],
  partagees: [],
  reutilises: new Set(reutilisees.map((css) => `${css}.tsx`)),
  lire: (f) => textes[f] ?? null,
})
const ligne = (module, n, motif = 'la console devient une primitive, refs #1806') => `RECLASSEMENT: ${module} +${n} — ${motif}\n`
const message = (...lignes) => `refactor\n\n${lignes.join('')}`

/** S1 : Q franchit (4 sites), aucun autre module ne bouge. */
const S1 = { parent: cote({ [Q]: CSS }), commit: cote({ [Q]: CSS }, [Q]) }

test('D2″ : un module franchi SANS ligne est refusé, avec son prix', () => {
  assert.deepEqual(reclassementsNonDeclares({ message: 'refactor' }, S1), [{ module: Q, n: 4, declare: null }])
})

test('D2″ : la ligne au N exact passe ; un N faux est refusé ; deux lignes pour un module sont refusées', () => {
  assert.deepEqual(reclassementsNonDeclares({ message: message(ligne(Q, 4)) }, S1), [])
  assert.deepEqual(reclassementsNonDeclares({ message: message(ligne(Q, 3)) }, S1), [{ module: Q, n: 4, declare: 3 }])
  assert.deepEqual(
    reclassementsNonDeclares({ message: message(ligne(Q, 999), ligne(Q, 4)) }, S1),
    [{ module: Q, n: 4, declare: 999, declarees: [999, 4] }],
  )
})

test('D2″ : une ligne SANS franchissement est refusée — la ligne fausse ne couvre pas le vrai franchi (S2)', () => {
  const S2 = { parent: cote({ [Q]: CSS }), commit: cote({ [Q]: CSS, [P]: CSS }, [Q, P]) }
  assert.deepEqual(reclassementsNonDeclares({ message: message(ligne(P, 4)) }, S2), [
    { module: Q, n: 4, declare: null },
    { module: P, n: null, declare: 4 },
  ])
  assert.deepEqual(reclassementsNonDeclares({ message: message(ligne(Q, 4)) }, S2), [], 'P naît exempté : il ne franchit pas')
})

test('D2″ : sans `#ticket` ou sous le motif minimal, la ligne n’est pas lue', () => {
  assert.deepEqual(reclassementsNonDeclares({ message: message(ligne(Q, 4, 'la console devient une primitive')) }, S1), [{ module: Q, n: 4, declare: null }])
  assert.deepEqual(reclassementsNonDeclares({ message: message(ligne(Q, 4, '#1806')) }, S1), [{ module: Q, n: 4, declare: null }])
})

test('D1″ : un SECOND importeur gagné fait franchir le module (S11) ; revendiquer à un seul hôte ne fait rien franchir', () => {
  const S11 = { parent: cote({ [P]: CSS }, [], [P]), commit: cote({ [P]: CSS }, [P]) }
  assert.deepEqual(franchisDesCotes(S11.parent, S11.commit), [{ module: P, identite: 3, espacement: 1, n: 4 }])
  const monoHote = { parent: cote({ [Q]: CSS }), commit: cote({ [Q]: CSS }, [], [Q]) }
  assert.deepEqual(franchisDesCotes(monoHote.parent, monoHote.commit), [])
})

test('D1″ : un module franchi à 0 site n’exige aucune ligne', () => {
  const vide = { parent: cote({ [P]: '.p { gap: var(--sp-md) }' }), commit: cote({ [P]: '.p { gap: var(--sp-md) }' }, [P]) }
  assert.deepEqual(reclassementsNonDeclares({ message: 'refactor' }, vide), [])
})

test('franchisDesCotes ne lit que les candidats — exemptés au commit, pas au parent', () => {
  const lus = []
  const espion = (c) => ({ ...c, lire: (f) => { lus.push(f); return c.lire(f) } })
  const parent = cote({ [Q]: CSS, [P]: CSS }, [P])
  const commit = cote({ [Q]: CSS, [P]: CSS }, [P, Q])
  franchisDesCotes(espion(parent), espion(commit))
  assert.deepEqual([...new Set(lus)], [Q])
})

// ── deplaceLaFrontiere (#1806 E) : une branche, un test ─────────────────────────────────────────
const COMPOSANT_CONSOLE = 'src/ui/Console.tsx'
const MODULE_CONSOLE = 'src/ui/styles/console.css'
const MANIFESTE_CONSOLE = [{ id: 'a' }, { id: 'console', fichier: COMPOSANT_CONSOLE, css: MODULE_CONSOLE }]
const jamais = (quoi) => () => { throw new Error(`${quoi} lu alors que les chemins suffisent`) }
const diffDEcran = (ligne) =>
  `diff --git a/src/ui/Ecran.tsx b/src/ui/Ecran.tsx\n--- a/src/ui/Ecran.tsx\n+++ b/src/ui/Ecran.tsx\n${ligne.startsWith('-') ? '@@ -1 +0,0 @@' : '@@ -0,0 +1 @@'}\n${ligne}\n`
const deplace = (chemins, diff, nesOuMorts = []) =>
  deplaceLaFrontiere({ chemins, nesOuMorts: () => nesOuMorts, diff: () => diff, manifeste: () => MANIFESTE_CONSOLE })
const sansLecture = { nesOuMorts: jamais('nesOuMorts'), diff: jamais('diff'), manifeste: jamais('manifeste') }

test('deplaceLaFrontiere : le MANIFESTE touché suffit, sans rien lire d’autre', () => {
  assert.equal(deplaceLaFrontiere({ chemins: ['src/data/primitives.manifest.json'], ...sansLecture }), true)
})

test('deplaceLaFrontiere : `cssCouches.mjs` (FEUILLES_PARTAGEES) touché suffit, sans rien lire d’autre', () => {
  assert.equal(deplaceLaFrontiere({ chemins: ['scripts/guards/lib/cssCouches.mjs'], ...sansLecture }), true)
})

test('deplaceLaFrontiere : une ligne AJOUTÉE qui importe un `fichier` du manifeste', () => {
  assert.equal(deplace(['src/ui/Ecran.tsx'], diffDEcran("+import { Console } from './Console'")), true)
})

test('deplaceLaFrontiere : une ligne RETIRÉE qui importait un `fichier` du manifeste', () => {
  assert.equal(deplace(['src/ui/Ecran.tsx'], diffDEcran("-import { Console } from './Console.tsx'")), true)
})

test('deplaceLaFrontiere : un diff `src/` sans import d’un `fichier` du manifeste ne relit rien — un simple LITTÉRAL non plus', () => {
  assert.equal(deplace(['src/ui/Ecran.tsx'], diffDEcran("+import { Autre } from './ConsoleBis'")), false)
  assert.equal(deplace(['src/ui/Ecran.tsx'], diffDEcran("+const onglet = 'Console'")), false, 'un littéral qui porte le nom n’est pas un import')
  assert.equal(deplace(['src/ui/Ecran.tsx'], diffDEcran("+import { C } from 'Console'")), false, 'un spécificateur NU n’est pas relatif')
  assert.equal(deplace(['src/ui/Console.tsx'], diffDEcran('+export const Console = 2')), false, 'l’en-tête `+++ b/src/ui/Console.tsx` n’est pas une ligne')
  assert.equal(deplaceLaFrontiere({ chemins: ['src/ui/Ecran.tsx'], ...sansLecture, manifeste: () => [{ id: 'sans-fichier' }] }), false,
    'un manifeste sans `fichier` n’a rien à importer : ni les chemins nés ou morts ni le diff ne sont lus')
})

test('deplaceLaFrontiere : un importeur SUPPRIMÉ en entier relit la frontière', () => {
  const suppr = [
    'diff --git a/src/ui/Ecran2.tsx b/src/ui/Ecran2.tsx', 'deleted file mode 100644', '--- a/src/ui/Ecran2.tsx', '+++ /dev/null',
    '@@ -1 +0,0 @@', "-import { Console } from './Console'",
  ].join('\n')
  assert.equal(deplace(['src/ui/Ecran2.tsx'], suppr, ['src/ui/Ecran2.tsx']), true)
})

test('deplaceLaFrontiere : un module HOMONYME ajouté ou supprimé relit la frontière, VIDE compris — `./Console` peut changer de cible', () => {
  const vide = (mode) => `diff --git a/src/ui/Console.ts b/src/ui/Console.ts\n${mode} file mode 100644\nindex 0000000..e69de29\n`
  assert.equal(deplace(['src/ui/Console.ts'], vide('new'), ['src/ui/Console.ts']), true, '`Console.ts` VIDE ajouté passe avant `Console.tsx`')
  assert.equal(deplace(['src/ui/Console.ts'], vide('deleted'), ['src/ui/Console.ts']), true, 'le retirer, vide, rend `./Console` à `Console.tsx`')
  assert.equal(deplace(['src/ui/Console/index.ts'], '', ['src/ui/Console/index.ts']), true, 'repli `index.*`')
  assert.equal(deplace(['src/ui/Console.css'], '', ['src/ui/Console.css']), false, 'une feuille n’est pas un module de code')
  assert.equal(deplace(['src/ui/Autre.ts'], '', ['src/ui/Autre.ts']), false, 'témoin : un autre nom')
  assert.equal(deplace(['src/ui/Console.tsx'], diffDEcran('+export const Console = 2'), []), false,
    'une simple MODIFICATION de l’homonyme ne change aucune résolution')
})

test('deplaceLaFrontiere : toute ligne de hunk qui CITE un `fichier` relit — spécificateur seul, commentaire, `/` final, littéral compris', () => {
  for (const l of ["+  './Console'", "-  '@/ui/Console';", "+  './Console' // primitive", "+import X from './Console/'",
    "+  './Console').then((m) => m.Console)", "+const p = './Console'"]) {
    assert.equal(deplace(['src/ui/Ecran.tsx'], diffDEcran(l)), true, l)
  }
  const entete = 'diff --git a/src/ui/Console.tsx b/src/ui/Console.tsx\n--- a/src/ui/Console.tsx\n+++ b/src/ui/Console.tsx\n@@ -1 +1 @@\n-export const A = 1\n+export const A = 2\n'
  assert.equal(deplace(['src/ui/Console.tsx'], entete), false, 'les en-têtes `---`/`+++` ne sont pas des lignes de hunk')
})

test('motifDeCitation : un nom du manifeste en mot entier après `/`, ou un spécificateur fini par `.`, `..` ou `/`', () => {
  const cite = new RegExp(motifDeCitation(MANIFESTE_CONSOLE))
  for (const l of [
    "import { C } from './Console'", "export { C } from '../d/Console.tsx'", "import Z from './Console/index'",
    "import X from './Console/'", "  './Console' // primitive", "  './Console').then((m) => m.Console)",
    "import { R } from '@/ui/Console'", "export * from '.'", "export { W } from '../..'", "import Y from './a/..'", "import V from '@/'",
  ]) assert.equal(cite.test(l), true, l)
  for (const l of ["const k = 'Console'", "import { B } from './ConsoleBis'", "import { t } from 'Console'", "import { u } from './MaConsole'", "const v = ''"]) {
    assert.equal(cite.test(l), false, l)
  }
  assert.equal(new RegExp(motifDeCitation([{ id: 'i', fichier: 'src/ui/Console/index.tsx' }])).test("import I from './index'"), true,
    'un `index.*` se cite aussi par `index`')
  assert.equal(motifDeCitation([{ id: 'sans-fichier' }]), null)
})

test('le refus nomme chaque écart, le commit, et le geste `rebase -i` sur une plage', () => {
  const ecarts = ecartsDeReclassement([{ module: Q, identite: 3, espacement: 1, n: 4 }], [{ fichier: P, n: 2 }])
  const raison = raisonDeRefusDeReclassement([{ sha: 'c1aaaaaaaaaa', ecarts }])
  assert.match(raison, /c1aaaaaaa src\/ui\/styles\/ecran-q\.css : franchi au prix 4, aucune ligne, src\/ui\/styles\/prim-p\.css : ligne `\+2` sans franchissement/)
  assert.match(raison, /git rebase -i/)
  assert.match(raison, /quittent le stock \(xxi\)/)
  assert.match(raisonDeRefusDeReclassement([{ sha: 'c2bbbbbbbbbb', illisible: 'manifeste illisible' }]), /c2bbbbbbb injugeable : manifeste illisible/)
  assert.doesNotMatch(raisonDeRefusDeReclassement([{ ecarts }]), /rebase/)
})
