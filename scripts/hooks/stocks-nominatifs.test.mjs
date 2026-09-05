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
  croissanceDesStocks, croissancesNonCouvertes, cliquetsDuMessage, entreesDeStock, estEntreeDeStock,
  estPorteurDeStock, raisonDeRefus,
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
    '@@ -4,0 +4,1 @@',
    `+${FIXTURE}`,
  ].join('\n')
  // La fixture vit à la ligne 5 du PRÉ-image (corps de `test`) et à la ligne 4 du POST (module).
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

// ── LA DÉFINITION : porteur = tableau OU objet atteignable depuis une liaison de module ───────────
// Une entrée se lit sur l'IMAGE, par l'AST : c'est la POSITION dans le porteur qui la définit, jamais
// la forme de son littéral. Les deux plus gros stocks du dépôt (`slotsStock`, `structuresStock`)
// ouvrent leurs lignes par une accolade, et chacune de leurs entrées compte.

/** Les quatre formes de stock du dépôt, et les lignes (1-based) où vivent leurs entrées. */
const FORMES = {
  'tableau de chaînes': {
    corps: ['const STOCK = [', "  'src/state/combatFlow.ts',", "  'src/ui/Tabs.tsx',", ']'],
    entrees: [2, 3],
  },
  'tableau d’objets': {
    corps: [
      'const STOCK = [',
      "  { dataset: 'src/data/careers.json', n: 3 },",
      "  { dataset: 'src/data/spells.json', n: 1 },",
      ']',
    ],
    entrees: [2, 3],
  },
  'objet à clés-chemins (le cas FONDATEUR)': {
    corps: [
      'const AUTO_RESOLUS = {',
      "  'criticals.json': 'Blessures critiques (LDB 18) : le noeud est auto-résolu.',",
      "  'src/ui/Tabs.tsx': 'auto-résolu',",
      '}',
    ],
    entrees: [2, 3],
  },
  // Une propriété dont la valeur est un littéral est une RUBRIQUE : on y descend, elle ne compte pas.
  'objet dont les valeurs sont des tableaux': {
    corps: [
      'const ECRIVAINS = {',
      "  'test:hooks': [",
      "    'scripts/hooks/a.test.mjs',",
      "    'scripts/hooks/b.test.mjs',",
      '  ],',
      '}',
    ],
    entrees: [3, 4],
  },
  // Une CLÉ qui nomme un fichier est une entrée, et l'on ne descend pas dans sa valeur.
  'clé-chemin dont la valeur est un objet': {
    corps: [
      'const STOCK = {',
      "  'src/ui/Tabs.tsx': {",
      "    raison: 'vocabulaire hérité',",
      "    voir: 'src/ui/App.tsx',",
      '  },',
      '}',
    ],
    entrees: [2],
  },
}

const lignesDe = (source, chemin) => entreesDeStock(source, chemin).map((e) => e.ligne)

test('définition — les quatre formes de stock sont VUES en portée de module', () => {
  for (const [nom, { corps, entrees }] of Object.entries(FORMES)) {
    assert.deepEqual(lignesDe(`${corps.join('\n')}\n`, 'scripts/guards/lib/xStock.mjs'), entrees, nom)
  }
})

test('définition — les mêmes formes, écrites DANS un test, ne sont aucune entrée', () => {
  for (const [nom, { corps }] of Object.entries(FORMES)) {
    const locale = ["test('x', () => {", ...corps.map((l) => `  ${l}`), '})'].join('\n')
    assert.deepEqual(lignesDe(`${locale}\n`, 'scripts/guards/lib/xStock.mjs'), [], nom)
  }
})

test('définition — une entrée MULTILIGNE vit à la ligne de son PREMIER caractère', () => {
  const corps = [
    'export const STOCK = [',
    '  {',
    "    fichier: 'src/ui/Tabs.tsx',",
    "    raison: 'vocabulaire hérité',",
    '  },',
    ']',
  ].join('\n')
  assert.deepEqual(lignesDe(`${corps}\n`, 'scripts/guards/lib/legacyVocabStock.mjs'), [2])
  assert.equal(estEntreeDeStock('  {'), false, 'le REPLI de ligne ne voit pas une accolade ouvrante')
})

test('définition — un porteur JSON se lit comme les autres', () => {
  const f = 'scripts/hooks/ecrans-ui.json'
  const table = ['{', '  "ecrans": [', '    "src/ui/App.tsx",', '    "src/ui/Tabs.tsx"', '  ]', '}'].join('\n')
  assert.deepEqual(lignesDe(`${table}\n`, f), [3, 4], 'les deux écrans ; la rubrique `ecrans` n’en est pas un')
  const [c] = croissanceDesStocks(diffAjoutA(f, 3), { lirePostImage: () => table })
  assert.deepEqual([c.fichier, c.net], [f, 1])
})

test('repli — sans image, une entrée à ACCOLADE n’est pas vue, et l’en-tête le dit', () => {
  const f = 'scripts/guards/lib/legacyVocabStock.mjs'
  const post = ['export const STOCK = [', '  {', "    fichier: 'src/ui/Tabs.tsx',", '  },', ']'].join('\n')
  const diff = [
    `diff --git a/${f} b/${f}`, `--- a/${f}`, `+++ b/${f}`, '@@ -2,0 +2,3 @@',
    '+  {', "+    fichier: 'src/ui/Tabs.tsx',", '+  },',
  ].join('\n')
  assert.deepEqual(croissanceDesStocks(diff), [], 'sans image, le repli de ligne ne voit pas l’accolade')
  const [c] = croissanceDesStocks(diff, { lirePostImage: () => `${post}\n` })
  assert.deepEqual([c.fichier, c.net], [f, 1], 'avec l’image, l’entrée multiligne est vue une fois')
})

// ── L'INVARIANT sur les porteurs RÉELS : l'image VOIT, et jamais moins que le repli ───────────────
// Un stock est une DETTE vers zéro : son cardinal décroît (mesuré — la fusion des matières du monde
// a fait passer `slotsStock` de 339 à 338 et `structuresStock` de 1049 à 1047). Un test qui fige ce cardinal se casse sur le
// travail qu'il devrait saluer. Ce qui ne bouge pas, c'est ce que la porte DOIT tenir sur chacun :
// elle lit des entrées, et sa voie précise n'en voit jamais moins que sa voie de secours — une porte
// dont l'image voit moins que le repli se contourne en changeant la graphie du littéral.
//
// La liste vit DANS le test : en portée de module, elle serait elle-même un stock nominatif qui naît
// (mesuré — la porte a mordu ce fichier pour `+4 entrée(s)`). Une fixture est une donnée LOCALE.
//
// Elle est NOMMÉE plutôt que dérivée : `estPorteurDeStock` retient 1 786 fichiers suivis, dont la
// plupart ne portent aucun stock (`image = 0`), et trois des dix plus gros ont `image < repli`
// (`structures-contrat.test.ts` 1 contre 9, `refs-migrated.test.ts` 0 contre 5) — le repli compte
// toute LIGNE qui ressemble à une entrée, y compris dans une donnée locale, là où l'image ne compte
// que les entrées d'un porteur de portée MODULE. L'invariant vaut pour les stocks réels, pas pour un
// fichier quelconque : un corpus dérivé par la taille le réfuterait sans rien dire de la porte.
test('porteurs réels — l’image lit des entrées, et jamais moins que le repli de ligne', (t) => {
  const porteurs = [
    'scripts/guards/lib/slotsStock.mjs',
    'scripts/guards/lib/structuresStock.mjs',
    'scripts/guards/lib/legacyVocabStock.mjs',
    'scripts/hooks/ecrans-ui.json',
  ]
  for (const rel of porteurs) {
    const contenu = readFileSync(join(RACINE, rel), 'utf8')
    // `null` = image illisible (dialecte absent de `DIALECTE`) : ZÉRO entrée lue, et le repli
    // prendrait seul la main — donc un porteur dont l'image ne rend rien est un DÉFAUT, pas un cas.
    const parImage = (entreesDeStock(contenu, rel) ?? []).length
    const parRepli = contenu.split(/\r?\n/).filter((l) => estEntreeDeStock(l)).length
    t.diagnostic(`${rel} — image ${parImage} entrée(s), repli ${parRepli} ligne(s)`)
    assert.ok(parImage > 0, `${rel} : l’image ne lit AUCUNE entrée (image ${parImage}, repli ${parRepli})`)
    assert.ok(
      parImage >= parRepli,
      `${rel} : l’image voit MOINS que le repli (image ${parImage}, repli ${parRepli}) — la porte se `
      + 'contournerait en changeant la graphie du littéral',
    )
  }
})

// ── La FENÊTRE 2c11fdd9a..f0f9436f5 : ce que la porte aveugle ratait, et ce qu'elle voit ──────────

const FENETRE = { avant: '2c11fdd9a', apres: 'f0f9436f5' }
const gitOuNull = (...args) => {
  try { return git(...args) } catch { return null }
}
const imagesDe = (avant, apres) => ({
  lirePostImage: (f) => gitOuNull('show', `${apres}:${f}`),
  lirePreImage: (f) => gitOuNull('show', `${avant}:${f}`),
})

test('fenêtre — les deux plus gros stocks du dépôt sont comptés à l’entrée comme à la sortie', () => {
  const compte = (sha, rel) => entreesDeStock(gitOuNull('show', `${sha}:${rel}`), rel).length
  const slots = 'scripts/guards/lib/slotsStock.mjs'
  const structures = 'scripts/guards/lib/structuresStock.mjs'
  assert.deepEqual([compte(FENETRE.avant, slots), compte(FENETRE.apres, slots)], [336, 339])
  assert.deepEqual([compte(FENETRE.avant, structures), compte(FENETRE.apres, structures)], [1047, 1046])

  const cumule = git('diff', '-U0', '--no-renames', `${FENETRE.avant}..${FENETRE.apres}`)
  const croissances = croissanceDesStocks(cumule, imagesDe(FENETRE.avant, FENETRE.apres))
  const parFichier = new Map(croissances.map((c) => [c.fichier, c]))
  assert.deepEqual(
    [parFichier.get(slots)?.ajoutees, parFichier.get(slots)?.retirees, parFichier.get(slots)?.net], [8, 5, 3],
    'la croissance NETTE de `slotsStock` sur la fenêtre est rendue',
  )
  assert.equal(parFichier.has(structures), false, '`structuresStock` DÉCROÎT sur la fenêtre : rien à rendre')
})

test('fenêtre — les croissances non couvertes de la plage, par commit', (t) => {
  const { refus } = croissancesDeLaPlage({ cwd: RACINE, ...FENETRE })
  const vus = refus.map((r) => `${r.sha.slice(0, 9)} ${r.fichier} +${r.net}`)
  for (const v of vus) t.diagnostic(v)
  assert.ok(
    vus.includes('c8d3105ae src/state/flowtest-derived-stake.test.ts +2'),
    'la croissance du registre `AUTO_RESOLUS` (clés en NOM DE FICHIER) reste rendue',
  )
  const ecrivains = refus.find((r) => r.fichier === 'scripts/gates/ecrivainsAtteints.test.mjs')
  assert.deepEqual(
    [ecrivains?.sha.slice(0, 9), ecrivains?.net, ecrivains?.declare], ['a9b7edf17', 63, 53],
    'un stock OBJET dont les valeurs sont des tableaux est rendu — la définition tableau-seul le perdait',
  )
  assert.equal(
    refus.some((r) => r.fichier === 'scripts/guards/lib/structuresStock.mjs'), false,
    'un stock qui décroît sur la plage n’est jamais refusé',
  )
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

// Sonde du juge de diff (2026-09-05) promue : un chemin écrit en GABARIT à substitution
// (`` `src/${n}.test.ts` ``) est une entrée comme une autre. La lecture par IMAGE n'en voyait aucune
// là où le REPLI en comptait deux — une porte dont la voie précise voit MOINS que sa voie de secours
// se contourne en changeant de graphie.
test('portée — une entrée écrite en GABARIT à substitution est vue par l’IMAGE comme par le repli', () => {
  const f = 'scripts/guards/lib/xTemplate.mjs'
  const post = ["const n = 'a'", 'export const S = [', '  `src/${n}.test.ts`,', '  `src/${n}b.test.ts`,', ']'].join('\n')
  const pre = ["const n = 'a'", 'export const S = [', ']'].join('\n')
  const diff = [
    `--- a/${f}`, `+++ b/${f}`, '@@ -2,1 +2,3 @@', 'export const S = [',
    '+  `src/${n}.test.ts`,', '+  `src/${n}b.test.ts`,', ']',
  ].join('\n')
  const parImage = croissanceDesStocks(diff, { lirePostImage: () => `${post}\n`, lirePreImage: () => `${pre}\n` })
  const parRepli = croissanceDesStocks(diff, {})
  assert.deepEqual(parImage.map((c) => [c.fichier, c.net]), [[f, 2]])
  assert.deepEqual(parImage.map((c) => c.net), parRepli.map((c) => c.net), 'l’image ne voit pas MOINS que le repli')
})
