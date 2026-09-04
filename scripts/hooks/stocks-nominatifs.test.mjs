// PORTE A POSTERIORI (node --test, sans réseau) — un STOCK NOMINATIF qui naît ou grandit dans la
// PLAGE POUSSÉE sans que le message de son commit le dise.
//
// Le garde `solde-ticket-guard` pose la même règle AU COMMIT, mais il vit dans le hook PreToolUse :
// un commit fait hors de ce canal (autre outil, autre machine, hook non installé) n'y passe pas.
// Cette mesure relit les commits une fois posés — même règle, mêmes libs (`stocksNominatifs.mjs`,
// `plageStock.mjs`), un seul endroit où elle est écrite. Lancée par `npm run test:hooks`.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import {
  croissanceDesStocks, croissancesNonCouvertes, cliquetsDuMessage, estEntreeDeStock, estPorteurDeStock, raisonDeRefus,
} from '../guards/lib/stocksNominatifs.mjs'
import { croissancesDeLaPlage, raisonDeRefusDePlage, SHA_NUL } from '../guards/lib/plageStock.mjs'

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const git = (...args) => execFileSync('git', args, { cwd: RACINE, encoding: 'utf8', maxBuffer: 1e8 })

/** ARRÊT NOMMÉ sur un clone SUPERFICIEL : `git show HEAD` y rend un diff tronqué et la mesure
 *  dirait « rien à signaler » sur un commit qu'elle n'a pas lu (patron de
 *  `fermetures-sans-solde.test.mjs`). Jamais un `skip` vert. */
function exigerHistoireComplete() {
  assert.equal(
    git('rev-parse', '--is-shallow-repository').trim(), 'false',
    "dépôt SUPERFICIEL : cette mesure lit le DIFF du dernier commit — poser `fetch-depth: 0` sur le `actions/checkout` du job qui joue `test:hooks`.",
  )
}

/** La porte était-elle EN VIGUEUR dans le commit jugé ? (sa lib y est-elle ?) Une porte juge les
 *  commits qui la PORTENT ; condamner l'histoire d'avant serait un verdict rétroactif, et l'échapper
 *  par un stock de shas rendrait à cette porte le vice qu'elle combat. Rien à tenir à jour : la
 *  condition s'éteint d'elle-même dès le premier commit qui embarque la lib. */
function porteEnVigueur() {
  try {
    git('cat-file', '-e', 'HEAD:scripts/guards/lib/stocksNominatifs.mjs')
    return true
  } catch { return false }
}

/** Début de la plage à juger. En CI, l'événement de push le porte (`GITHUB_EVENT_PATH` → `before`) ;
 *  `origin/main` n'y a PAS de reflog, il ne peut donc pas servir de base. Sans événement lisible, la
 *  base reste nulle et `croissancesDeLaPlage` juge HEAD seul en le DISANT (jamais un silence). */
function debutDeLaPlage(env = process.env) {
  if (!env.GITHUB_EVENT_PATH) return SHA_NUL
  try {
    const avant = String(JSON.parse(readFileSync(env.GITHUB_EVENT_PATH, 'utf8'))?.before ?? '')
    return /^[0-9a-f]{40}$/.test(avant) && avant !== SHA_NUL ? avant : SHA_NUL
  } catch { return SHA_NUL }
}

// ── La règle, sur des diffs FABRIQUÉS (ce que la porte voit, et ce qu'elle ne voit pas) ──────────

/** Diff unifié minimal d'un fichier : `ajoutees`/`retirees` sont des lignes ENTIÈRES. */
const diffDe = (fichier, ajoutees = [], retirees = []) =>
  [
    `diff --git a/${fichier} b/${fichier}`,
    `--- a/${fichier}`,
    `+++ b/${fichier}`,
    '@@ -20,0 +21,1 @@',
    ...retirees.map((l) => `-${l}`),
    ...ajoutees.map((l) => `+${l}`),
  ].join('\n')

const ENTREE_A = "  'src/state/combatSlice.ts',"
const ENTREE_B = "  'src/ui/CampaignView.test.tsx // div',"
const ENTREE_CLE = "  'scripts/guards/lib/labelLogic.mjs': 'raison mesurée',"

test('périmètre — les porteurs de stock, et eux seuls', () => {
  assert.equal(estPorteurDeStock('src/state/flowtest-derived-stake.test.ts'), true)
  assert.equal(estPorteurDeStock('scripts/guards/lib/domResiduStock.mjs'), true)
  assert.equal(estPorteurDeStock('scripts/hooks/fermetures-sans-solde.test.mjs'), true)
  assert.equal(estPorteurDeStock('scripts/hooks/ecrans-ui.json'), true)
  assert.equal(estPorteurDeStock('src/state/combatFlow.ts'), false, 'un module de prod n\'est pas un stock')
  assert.equal(estPorteurDeStock('docs/architecture.md'), false)
})

test('entrée — élément de liste, clé d objet et balise commentée comptent', () => {
  assert.equal(estEntreeDeStock(ENTREE_A), true)
  assert.equal(estEntreeDeStock(ENTREE_B), true)
  assert.equal(estEntreeDeStock(ENTREE_CLE), true)
  assert.equal(estEntreeDeStock("  'src/ui/Tabs.tsx:42',"), true)
})

test('entrée — le cas FONDATEUR : une clé de registre en NOM DE FICHIER nu', () => {
  assert.equal(estEntreeDeStock("  'criticals.json':"), true)
  assert.equal(estEntreeDeStock("  'criticals.json': 'Blessures critiques (LDB 18) : le noeud est auto-résolu.',"), true)
})

test('entrée — tuple dont le fichier est la CLÉ ou la QUEUE', () => {
  assert.equal(estEntreeDeStock("  ['src/state/combatFlow.ts', { n: 32, kind: 'mixte' }],"), true)
  assert.equal(estEntreeDeStock("  ['CritEscalation', 'onRepeat', 'src/engine/critical.ts:325'],"), true)
})

test('entrée — un chemin cité en PROSE ou en commentaire n en est pas une', () => {
  assert.equal(estEntreeDeStock("      `⛔ src/state/combatSlice.ts a grossi`,"), false)
  assert.equal(estEntreeDeStock('  // src/state/combatSlice.ts reste à traiter'), false)
  assert.equal(estEntreeDeStock("    'src/x.ts est absent de l index',"), false)
  assert.equal(estEntreeDeStock("  const stock = ['src/a.ts', 'src/b.ts']"), false)
  assert.equal(estEntreeDeStock("import { scanTombstones } from '../guards/lib/commentPoison.mjs'"), false)
})

test('croissance — un stock qui NAÎT est une croissance nette, avec ses exemples', () => {
  const [c] = croissanceDesStocks(diffDe('src/state/flowtest-derived-stake.test.ts', [ENTREE_A, ENTREE_B]))
  assert.equal(c.fichier, 'src/state/flowtest-derived-stake.test.ts')
  assert.deepEqual([c.ajoutees, c.retirees, c.net], [2, 0, 2])
  assert.deepEqual(c.exemples, [ENTREE_A.trim(), ENTREE_B.trim()])
})

test('croissance — un stock qui DÉCROÎT ou qui se déplace ne dit rien', () => {
  assert.deepEqual(croissanceDesStocks(diffDe('scripts/guards/lib/domResiduStock.mjs', [], [ENTREE_A, ENTREE_B])), [])
  assert.deepEqual(croissanceDesStocks(diffDe('scripts/guards/lib/domResiduStock.mjs', [ENTREE_A], [ENTREE_B])), [])
})

test('croissance — un diff qui n’est PAS une chaîne LÈVE, et un « 0 » ne peut plus mentir', () => {
  // Témoin POSITIF d'abord : sans lui, un `[]` prouverait autant que la lib cassée. Le même diff,
  // passé en OBJET (l'appel qu'un juge a fait le 2026-09-04), doit lever au lieu de rendre [].
  const diff = diffDe('src/state/flowtest-derived-stake.test.ts', [ENTREE_A, ENTREE_B])
  assert.ok(croissanceDesStocks(diff).length > 0, 'témoin positif muet : la mesure ne mesure rien')
  assert.throws(() => croissanceDesStocks({ diff }), /POSITIONNELLE/)
  assert.throws(() => croissanceDesStocks(undefined), /attend le diff en CHAÎNE/)
  assert.throws(() => croissanceDesStocks(null), /attend le diff en CHAÎNE/)
})

test('croissance — hors fichier PORTEUR, la règle se tait', () => {
  assert.deepEqual(croissanceDesStocks(diffDe('src/state/combatFlow.ts', [ENTREE_A, ENTREE_B])), [])
})

test('CLIQUET — le message couvre le fichier s il annonce le BON compte et un motif', () => {
  const diff = diffDe('src/state/flowtest-derived-stake.test.ts', [ENTREE_A, ENTREE_B])
  const couvrant =
    'feat: lot\n\nCLIQUET: src/state/flowtest-derived-stake.test.ts +2 — deux familles auto-résolues mesurées ce jour\n'
  assert.deepEqual(cliquetsDuMessage(couvrant).map((k) => k.n), [2])
  assert.deepEqual(croissancesNonCouvertes({ diff, message: couvrant }), [])
})

test('CLIQUET — un compte FAUX ou un motif de tampon ne couvre rien, et le refus le dit', () => {
  const diff = diffDe('src/state/flowtest-derived-stake.test.ts', [ENTREE_A, ENTREE_B])
  const fauxCompte = 'CLIQUET: src/state/flowtest-derived-stake.test.ts +1 — motif suffisamment long pour passer'
  const [c] = croissancesNonCouvertes({ diff, message: fauxCompte })
  assert.deepEqual([c.net, c.declare], [2, 1])
  assert.match(raisonDeRefus([c]), /annonce `\+1`, pas \+2/)
  const tampon = 'CLIQUET: src/state/flowtest-derived-stake.test.ts +2 — besoin'
  assert.equal(croissancesNonCouvertes({ diff, message: tampon }).length, 1)
  const autreFichier = 'CLIQUET: scripts/guards/lib/domResiduStock.mjs +2 — un motif assez long mais pour un autre fichier'
  assert.equal(croissancesNonCouvertes({ diff, message: autreFichier }).length, 1)
})

test('refus — nomme le fichier, le compte et jusqu à trois exemples', () => {
  const raison = raisonDeRefus(croissanceDesStocks(diffDe('scripts/guards/lib/domResiduStock.mjs', [ENTREE_A, ENTREE_B, ENTREE_CLE, ENTREE_A])))
  assert.match(raison, /STOCK NOMINATIF qui NAÎT ou GRANDIT/)
  assert.match(raison, /scripts\/guards\/lib\/domResiduStock\.mjs : \+4 entrée\(s\) nette\(s\)/)
  assert.equal(raison.split(' · ').length, 3, 'trois exemples, pas la liste entière')
  assert.match(raison, /CLIQUET: <fichier> \+N/)
})

// ── PORTÉE DE MODULE : une fixture DANS un test n'est pas un stock ────────────────────────────────
// Les trois « entrées » de `429b9a1a2` et le `+8` de `572e60b8b` étaient des littéraux écrits dans
// des corps de `test(...)` — des données locales, pas une dette. Le défaut était celui du LECTEUR
// (précédent `0d6ddeee1` : la classe se règle au garde, jamais à la fixture).

/** L'entrée telle qu'elle vit dans `enregistreur-lectures.test.mjs` (429b9a1a2), copiée ici. */
const FIXTURE =
  "  'scripts/docs/build-systemes.mjs': { cibles: ['docs/systemes.md'], fichiers: ['src/state/store.ts'], dossiers: [] },"

/** Post-image où la fixture vit DANS un corps de test (donnée locale). */
const POST_LOCALE = [
  "import { test } from 'node:test'",
  '',
  "test('une cible SANS pied est nommée', () => {",
  '  const par = {',
  FIXTURE,
  '  }',
  '  return par',
  '})',
  '',
].join('\n')

/** Le MÊME littéral, hissé en constante de MODULE : là, c'est un stock. */
const POST_MODULE = [
  "import { test } from 'node:test'",
  '',
  'const PAR = {',
  FIXTURE,
  '}',
  '',
  "test('x', () => PAR)",
  '',
].join('\n')

/** Diff qui AJOUTE la fixture à la ligne `ligne` du post-image (les `-U0` de git ont cette forme). */
const diffAjoutA = (fichier, ligne) =>
  [
    `diff --git a/${fichier} b/${fichier}`,
    `--- a/${fichier}`,
    `+++ b/${fichier}`,
    `@@ -${ligne},0 +${ligne},1 @@`,
    `+${FIXTURE}`,
  ].join('\n')

test('portée — le MÊME littéral compte en constante de module, jamais dans un corps de test', () => {
  const f = 'scripts/docs/lib/enregistreur-lectures.test.mjs'
  assert.deepEqual(
    croissanceDesStocks(diffAjoutA(f, 5), { lirePostImage: () => POST_LOCALE }), [],
    'une fixture écrite dans un `test(...)` ne s’ajoute à aucune dette',
  )
  const [c] = croissanceDesStocks(diffAjoutA(f, 4), { lirePostImage: () => POST_MODULE })
  assert.deepEqual([c.fichier, c.net], [f, 1])
})

test('portée — sans lecteur d\'image, ou sans image lisible, l\'entrée COMPTE', () => {
  const f = 'scripts/docs/lib/enregistreur-lectures.test.mjs'
  assert.equal(croissanceDesStocks(diffAjoutA(f, 5)).length, 1, 'sans lecteur : comportement inchangé')
  assert.equal(
    croissanceDesStocks(diffAjoutA(f, 5), { lirePostImage: () => null }).length, 1,
    'fichier supprimé ou binaire : la porte perd sa précision, jamais sa vue',
  )
})

test('portée — le RETRAIT se juge sur le PRÉ-image : retirer une fixture ne compense pas un ajout', () => {
  const f = 'scripts/guards/lib/lintStage.test.mjs'
  const diff = [
    `diff --git a/${f} b/${f}`,
    `--- a/${f}`,
    `+++ b/${f}`,
    '@@ -5,1 +4,0 @@',
    `-${FIXTURE}`,
    '@@ -10,0 +10,1 @@',
    `+${FIXTURE}`,
  ].join('\n')
  const [c] = croissanceDesStocks(diff, { lirePostImage: () => POST_MODULE, lirePreImage: () => POST_LOCALE })
  assert.deepEqual(
    [c.ajoutees, c.retirees, c.net], [1, 0, 1],
    'le retrait d’une FIXTURE locale ne solde pas l’ajout d’une entrée de module',
  )
})

// Une règle contournable par trois enveloppes d'une ligne ne garde rien : `export const STOCK =
// (() => […])()`, `export function stock() { return […] }`, `export const stock = () => […]`
// rendaient le stock INVISIBLE (sonde 2026-09-04). Seul ce qui vit dans une fonction passée en
// ARGUMENT d'un appel est local — le corps d'un `test`/`it`/`describe`, pas une déclaration.
test('portée — aucune ENVELOPPE ne cache un stock de module', () => {
  const f = 'scripts/guards/lib/xStock.mjs'
  const E = ["  'src/state/combatFlow.ts',", "  'src/ui/RollShell.tsx',", "  'src/ui/Tabs.tsx',"]
  const diff = [
    `diff --git a/${f} b/${f}`, `--- a/${f}`, `+++ b/${f}`, `@@ -2,0 +2,${E.length} @@`, ...E.map((e) => `+${e}`),
  ].join('\n')
  const enveloppes = {
    'const de module': ['export const STOCK = [', ...E, ']'],
    'IIFE de module': ['export const STOCK = (() => [', ...E, '])()'],
    'fonction exportée': ['export function stock() { return [', ...E, '] }'],
    'fléchée exportée': ['export const stock = () => [', ...E, ']'],
    'objet figé': ['export const STOCK = Object.freeze([', ...E, '])'],
  }
  for (const [nom, lignes] of Object.entries(enveloppes)) {
    const [c] = croissanceDesStocks(diff, { lirePostImage: () => `${lignes.join('\n')}\n` })
    assert.equal(c?.net, 3, `${nom} : le stock a disparu derrière l'enveloppe`)
  }
  const dansUnDescribe = ["describe('x', () => { const S = [", ...E, '] })'].join('\n')
  assert.deepEqual(
    croissanceDesStocks(diff, { lirePostImage: () => `${dansUnDescribe}\n` }), [],
    'un corps de `describe(…)` reste une donnée locale',
  )
})

test('portée — un porteur JSON n\'a pas d\'AST : tout y est de module', () => {
  const f = 'scripts/hooks/ecrans-ui.json'
  const [c] = croissanceDesStocks(diffAjoutA(f, 3), { lirePostImage: () => '{\n}\n' })
  assert.deepEqual([c.fichier, c.net], [f, 1])
})

// ── La mesure sur le dépôt RÉEL ───────────────────────────────────────────────────────────────────

test('CLIQUET stocks : la PLAGE POUSSÉE ne fait grossir aucun stock en silence', (t) => {
  if (!porteEnVigueur()) {
    t.diagnostic(
      `HEAD (${git('rev-parse', '--short', 'HEAD').trim()}) est ANTÉRIEUR à cette porte : sa lib n'y ` +
        'est pas, la règle ne juge que les commits qui la portent.',
    )
    return
  }
  exigerHistoireComplete()
  const { refus, notes, commits } = croissancesDeLaPlage({
    cwd: RACINE, avant: debutDeLaPlage(), apres: git('rev-parse', 'HEAD').trim(),
  })
  for (const n of notes) t.diagnostic(n)
  if (commits !== undefined) t.diagnostic(`${commits} commit(s) jugé(s)`)
  assert.deepEqual(
    refus.map((r) => `${r.sha.slice(0, 9)} ${r.fichier} +${r.net}`), [],
    raisonDeRefusDePlage(refus),
  )
})
