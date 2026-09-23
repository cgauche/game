// L'ÉVÉNEMENT de frontière du stock CSS (#1806, `reclassementCss.mjs`) : une revendication ARMÉE qui
// sort des sites du stock exige `RECLASSEMENT: <module> +N — <motif #ticket>` au PRIX de l'intervalle
// (`prixDuReclassement`). Aucun disque : les images sont des lecteurs en mémoire. Joué par
// `npm run test:hooks`.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { CHEMIN_COUCHES, CHEMIN_MANIFESTE } from './cssCouches.mjs'
import { ecartDeReclassement, raisonDeRefusDeReclassement, reclassementsNonDeclares } from './reclassementCss.mjs'

const MODULE = 'src/ui/styles/console.css'
const AUTRE = 'src/ui/styles/journal.css'
const MANIFESTE_AVANT = JSON.stringify([{ id: 'a' }])
const MANIFESTE_APRES = JSON.stringify([{ id: 'a' }, { id: 'console', css: MODULE }])
const TROIS = '.c { color: red; border: 0; gap: 3px }'

/** Un arbre en mémoire → son lecteur. */
const lecteur = (arbre) => (f) => arbre[f] ?? null
/** Images d'un commit qui REVENDIQUE `MODULE`, déjà peint au stock (`avant`) ; `css` = sa post-image. */
const images = (css, apres = MANIFESTE_APRES, avant = TROIS) => ({
  lirePreImage: lecteur({ [CHEMIN_MANIFESTE]: MANIFESTE_AVANT, [MODULE]: avant }),
  lirePostImage: lecteur({ [CHEMIN_MANIFESTE]: apres, [MODULE]: css }),
})
const TOUCHES = [CHEMIN_MANIFESTE, MODULE]
const ligne = (n, motif = 'la console devient un organisme, refs #1806', module = MODULE) =>
  `RECLASSEMENT: ${module} +${n} — ${motif}\n`
const message = (...lignes) => `refactor\n\n${lignes.join('')}`

test('revendication d’un écran peint SANS ligne → refus qui dit le prix et le module', () => {
  const refus = reclassementsNonDeclares({ message: 'refactor: console' }, images(TROIS), TOUCHES)
  assert.deepEqual(refus, [{ prix: 3, declare: 0, modules: [{ module: MODULE, n: 3, declarees: [] }] }])
  const raison = raisonDeRefusDeReclassement(refus)
  assert.ok(raison.includes('3 site(s) sortent du stock CSS'), raison)
  assert.ok(raison.includes(`${MODULE} (N 3, aucune ligne)`), raison)
  assert.match(raison, /RECLASSEMENT: <module> \+N/)
})

test('ligne au MAUVAIS compte → refus qui dit le compte annoncé', () => {
  const refus = reclassementsNonDeclares({ message: message(ligne(2)) }, images(TROIS), TOUCHES)
  assert.deepEqual(refus, [{ prix: 3, declare: 2, modules: [{ module: MODULE, n: 3, declarees: [2] }] }])
  assert.match(raisonDeRefusDeReclassement(refus), /en annoncent 2/)
})

test('BON compte → passe ; sans `#ticket` ou motif de tampon → refus', () => {
  assert.deepEqual(reclassementsNonDeclares({ message: message(ligne(3)) }, images(TROIS), TOUCHES), [])
  assert.equal(reclassementsNonDeclares({ message: message(ligne(3, 'la console devient un organisme')) }, images(TROIS), TOUCHES).length, 1)
  assert.equal(reclassementsNonDeclares({ message: message(ligne(3, '#1806')) }, images(TROIS), TOUCHES).length, 1)
})

test('revendication d’un module à N = 0 → passe sans ligne ; aucune revendication neuve → rien à dire', () => {
  assert.deepEqual(reclassementsNonDeclares({ message: 'feat' }, images('.c { display: grid; gap: var(--sp-md) }'), TOUCHES), [])
  assert.deepEqual(reclassementsNonDeclares({ message: 'feat' }, images(TROIS, MANIFESTE_AVANT), TOUCHES), [])
})

test('primitive NEUVE livrée avec son CSS neuf : le stock ne baisse pas, le prix est 0 — rien à dire (juge 2026-09-23, écart 1)', () => {
  const neuve = images(TROIS, MANIFESTE_APRES, null)
  assert.deepEqual(reclassementsNonDeclares({ message: 'feat(ui): primitive neuve' }, neuve, TOUCHES), [])
  const refus = reclassementsNonDeclares({ message: message(ligne(3)) }, neuve, TOUCHES)
  assert.deepEqual(refus, [{ prix: 0, declare: 3, modules: [{ module: MODULE, n: 3, declarees: [3] }] }], 'une ligne sur un prix nul ment')
})

test('le prix est la BAISSE du stock, pas N : écran de 1 site revendiqué, qui en porte 3 à la tête → +1', () => {
  const partiel = images(TROIS, MANIFESTE_APRES, '.c { color: red }')
  assert.deepEqual(reclassementsNonDeclares({ message: message(ligne(1)) }, partiel, TOUCHES), [])
  assert.equal(reclassementsNonDeclares({ message: message(ligne(3)) }, partiel, TOUCHES)[0].prix, 1)
})

test('sur une plage, le refus porte le sha et le geste `rebase -i`', () => {
  const raison = raisonDeRefusDeReclassement([{ sha: 'abcdef1234567', prix: 3, declare: 0, modules: [{ module: MODULE, n: 3, declarees: [] }] }])
  assert.match(raison, /abcdef123 3 site\(s\) sortent/)
  assert.match(raison, /rebase -i/)
})

test('deux lignes pour le MÊME module (`+999` puis `+3`) → refus nommé : une déclaration par module', () => {
  const texte = message(ligne(999, 'motif assez long pour passer, refs #1806'), ligne(3, 'motif assez long pour passer, refs #1806'))
  const refus = reclassementsNonDeclares({ message: texte }, images(TROIS), TOUCHES)
  assert.deepEqual(refus, [{ prix: 3, declare: 1002, modules: [{ module: MODULE, n: 3, declarees: [999, 3] }] }])
  assert.match(raisonDeRefusDeReclassement(refus), /2 lignes \+999, \+3 — une seule par module/)
})

test('PLUSIEURS modules armés : la somme des lignes égale le prix, chacune au plus le N de son module', () => {
  const prix = { n: 4, identite: 4, espacement: 0, deltaStock: { identite: -4, espacement: 0 },
    revendications: [{ module: MODULE, identite: 3, espacement: 0, n: 3 }, { module: AUTRE, identite: 3, espacement: 0, n: 3 }] }
  const lignes = (a, b) => [{ fichier: MODULE, n: a }, { fichier: AUTRE, n: b }]
  assert.equal(ecartDeReclassement(prix, lignes(3, 1)), null)
  assert.equal(ecartDeReclassement(prix, lignes(2, 2)), null)
  assert.equal(ecartDeReclassement(prix, lignes(4, 0))?.declare, 4, 'une ligne au-delà du N de son module')
  assert.equal(ecartDeReclassement(prix, lignes(3, 3))?.declare, 6, 'la somme excède le prix')
})

test('manifeste ILLISIBLE → levée explicite, jamais un tableau vide qui tairait la revendication', () => {
  const casse = { lirePreImage: lecteur({ [CHEMIN_MANIFESTE]: MANIFESTE_AVANT }), lirePostImage: lecteur({ [CHEMIN_MANIFESTE]: '[{"id":' }) }
  assert.throws(() => reclassementsNonDeclares({ message: 'x' }, casse, TOUCHES), /primitives\.manifest\.json/)
})

test('feuille ENTRÉE en FEUILLES_PARTAGEES → même ligne `RECLASSEMENT:`, au prix de ses sites (T2)', () => {
  const couchesAvant = "export const FEUILLES_PARTAGEES = [\n  'src/ui/styles/base.css',\n];\n"
  const couchesApres = `export const FEUILLES_PARTAGEES = [\n  'src/ui/styles/base.css',\n  '${MODULE}',\n];\n`
  const partage = {
    lirePreImage: lecteur({ [CHEMIN_MANIFESTE]: MANIFESTE_AVANT, [CHEMIN_COUCHES]: couchesAvant, [MODULE]: TROIS }),
    lirePostImage: lecteur({ [CHEMIN_MANIFESTE]: MANIFESTE_AVANT, [CHEMIN_COUCHES]: couchesApres, [MODULE]: TROIS }),
  }
  assert.deepEqual(reclassementsNonDeclares({ message: 'feat' }, partage, [CHEMIN_COUCHES]),
    [{ prix: 3, declare: 0, modules: [{ module: MODULE, n: 3, declarees: [] }] }])
  assert.deepEqual(reclassementsNonDeclares({ message: message(ligne(3)) }, partage, [CHEMIN_COUCHES]), [])
})

test('le refus dit « du stock (xxi) », le terme de la charte', () => {
  const raison = raisonDeRefusDeReclassement([{ prix: 3, declare: 0, modules: [{ module: MODULE, n: 3, declarees: [] }] }])
  assert.match(raison, /du stock \(xxi\)/)
  assert.doesNotMatch(raison, /cliquet \(xxi\)/)
})

test('une image ILLISIBLE sur une plage se dit par son commit', () => {
  const raison = raisonDeRefusDeReclassement([{ sha: 'abcdef1234567', illisible: 'manifeste illisible' }])
  assert.match(raison, /abcdef123 injugeable : manifeste illisible/)
})
