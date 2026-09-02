// PORTE A POSTERIORI (node --test, sans réseau) — un STOCK NOMINATIF qui naît ou grandit dans le
// DERNIER commit sans que son message le dise.
//
// Le garde `solde-ticket-guard` pose la même règle AU COMMIT, mais il vit dans le hook PreToolUse :
// un commit fait hors de ce canal (autre outil, autre machine, hook non installé) n'y passe pas.
// Cette mesure relit le commit une fois posé — même règle, même lib (`stocksNominatifs.mjs`), un
// seul endroit où elle est écrite. Lancée par `npm run test:hooks`.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import {
  croissanceDesStocks, croissancesNonCouvertes, cliquetsDuMessage, estEntreeDeStock, estPorteurDeStock, raisonDeRefus,
} from '../guards/lib/stocksNominatifs.mjs'

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

/** Message et diff `-U0` du dernier commit, séparés au premier en-tête `diff --git`.
 *  PORTÉE : `git show` d'un commit de FUSION ne rend aucun diff. Une croissance introduite par une
 *  fusion n'est donc vue qu'au commit d'ORIGINE — et là encore, seulement s'il est passé par le
 *  canal PreToolUse : un commit venu d'ailleurs (autre outil, hook non installé) échappe aux DEUX
 *  portes, et sa fusion aussi. */
function dernierCommit() {
  exigerHistoireComplete()
  const brut = git('show', 'HEAD', '--format=%B%x00', '-U0')
  const coupe = brut.indexOf('\0')
  return { message: brut.slice(0, coupe), diff: brut.slice(coupe + 1) }
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

// ── La mesure sur le dépôt RÉEL ───────────────────────────────────────────────────────────────────

test('CLIQUET stocks : le DERNIER commit ne fait grossir aucun stock en silence', (t) => {
  if (!porteEnVigueur()) {
    t.diagnostic(
      `HEAD (${git('rev-parse', '--short', 'HEAD').trim()}) est ANTÉRIEUR à cette porte : sa lib n'y ` +
        'est pas, la règle ne juge que les commits qui la portent.',
    )
    return
  }
  const { message, diff } = dernierCommit()
  const restantes = croissancesNonCouvertes({ diff, message })
  assert.deepEqual(
    restantes.map((c) => `${c.fichier} +${c.net}`), [],
    raisonDeRefus(restantes),
  )
})
