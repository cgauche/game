// L'ÉVÉNEMENT de frontière du stock CSS (#1806 D1″/D2″, `reclassementCss.mjs`) : un module qui
// FRANCHIT la frontière exige UNE ligne `RECLASSEMENT: <module> +N — <motif #ticket>` au N exact ; trois
// refus — franchi sans ligne, ligne sans franchissement, N faux. Aucun disque : les côtés sont en
// mémoire. Joué par `npm run test:hooks`.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  deplaceLaFrontiere, ecartsDeReclassement, franchisDesCotes, raisonDeRefusDeReclassement, reclassementsNonDeclares,
} from './reclassementCss.mjs'

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
  `diff --git a/src/ui/Ecran.tsx b/src/ui/Ecran.tsx\n--- a/src/ui/Ecran.tsx\n+++ b/src/ui/Ecran.tsx\n@@ -1,0 +1 @@\n${ligne}\n`
const deplace = (chemins, diff) => deplaceLaFrontiere({ chemins, diff: () => diff, manifeste: () => MANIFESTE_CONSOLE })

test('deplaceLaFrontiere : le MANIFESTE touché suffit, sans lire ni diff ni manifeste', () => {
  assert.equal(deplaceLaFrontiere({ chemins: ['src/data/primitives.manifest.json'], diff: jamais('diff'), manifeste: jamais('manifeste') }), true)
})

test('deplaceLaFrontiere : `cssCouches.mjs` (FEUILLES_PARTAGEES) touché suffit, sans lire ni diff ni manifeste', () => {
  assert.equal(deplaceLaFrontiere({ chemins: ['scripts/guards/lib/cssCouches.mjs'], diff: jamais('diff'), manifeste: jamais('manifeste') }), true)
})

test('deplaceLaFrontiere : une ligne AJOUTÉE qui importe un `fichier` du manifeste', () => {
  assert.equal(deplace(['src/ui/Ecran.tsx'], diffDEcran("+import { Console } from './Console'")), true)
})

test('deplaceLaFrontiere : une ligne RETIRÉE qui importait un `fichier` du manifeste', () => {
  assert.equal(deplace(['src/ui/Ecran.tsx'], diffDEcran("-import { Console } from './Console.tsx'")), true)
})

test('deplaceLaFrontiere : un diff `src/` sans import d’un `fichier` du manifeste ne relit rien', () => {
  assert.equal(deplace(['src/ui/Ecran.tsx'], diffDEcran("+import { Autre } from './ConsoleBis'")), false)
  assert.equal(deplace(['src/ui/Console.tsx'], diffDEcran('+export const Console = 2')), false, 'l’en-tête `+++ b/src/ui/Console.tsx` n’est pas une ligne')
  assert.equal(deplaceLaFrontiere({ chemins: ['src/ui/Ecran.tsx'], diff: jamais('diff'), manifeste: () => [{ id: 'sans-fichier' }] }), false,
    'un manifeste sans `fichier` n’a rien à importer : le diff n’est pas lu')
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
