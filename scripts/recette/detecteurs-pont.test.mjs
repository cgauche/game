// FIXTURES des détecteurs purs du pont (#1848, #1856) — sans Chrome ni serveur (gate `test:recette`,
// `scripts/gates/testsParGate.mjs`).
// COUVERTURE, à énoncer et non à supposer : CHAQUE détecteur a ici son cas ROUGE (le relevé qui
// porte le défaut, repris des MESURES des tickets) et son cas VERT (le même relevé assaini) — un
// détecteur sans cas rouge ne mesure rien, un détecteur sans cas vert crie sur tout.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { surfaceOcculteeParUnPont, elementsHorsFenetre } from './detecteurs-pont.mjs'

// ── OCCLUSION par un pont — mesure du ticket #1848 : le bandeau de dialogue (`bottom: 18px`) passe
//    sous le pont d'exploration, 31px de sa boîte recouverts par une bande de 49px. ──────────────
const dialogueSousLePont = () => ({
  vue: '1366×650',
  surfaces: [
    { nom: '.dialogue-box', pont: '.exploration-dock', inter: { w: 680, h: 31 }, touche: 'pont' },
    { nom: '.log-drawer', pont: '.exploration-dock', inter: null, touche: 'surface' },
  ],
})

test('dialogue occulté par le pont : défaut nommé, avec sa mesure', () => {
  const d = surfaceOcculteeParUnPont(dialogueSousLePont())
  assert.equal(d.length, 1, `attendu 1 défaut, obtenu ${d.length} : ${d.join(' | ')}`)
  assert.match(d[0], /« \.dialogue-box » est OCCULTÉE par \.exploration-dock/)
  assert.match(d[0], /680×31px/)
})

test('surface qui TOUCHE le pont sans être occultée : aucun défaut', () => {
  // La rangée de flux (#1848) laisse les deux boîtes se frôler : l'intersection existe (arrondi de
  // sous-pixel, ombre portée), mais au centroïde c'est bien la SURFACE que le navigateur rend.
  const m = dialogueSousLePont()
  m.surfaces[0].inter = { w: 680, h: 0.5 }
  m.surfaces[0].touche = 'surface'
  assert.deepEqual(surfaceOcculteeParUnPont(m), [])
})

test('tiroir ASSIS sur le pont (descendant) : aucun défaut, même recouvert entièrement', () => {
  // Hors combat, la commande du tiroir-journal est un ENFANT du pont d'exploration : sa boîte est
  // entièrement dans celle du pont et c'est le pont qui répond au centroïde (mesuré 42×42 à 1366, 700
  // et 360). Une surface PORTÉE par le pont n'est pas une surface occultée PAR lui — sans quoi le
  // verdict crierait à chaque vue d'exploration.
  assert.deepEqual(surfaceOcculteeParUnPont({
    vue: '360×740',
    surfaces: [{ nom: '.log-drawer', pont: '.exploration-dock', inter: { w: 42, h: 42 }, touche: 'descendant' }],
  }), [])
})

test('relevé sans aucune intersection : aucun défaut', () => {
  assert.deepEqual(surfaceOcculteeParUnPont({ vue: '1707×780', surfaces: [{ nom: '.combat-feed', pont: '.combat-console', inter: null, touche: 'surface' }] }), [])
})

// ── HORS FENÊTRE — mesure du ticket #1856 : « Fin du tour » à [1040..1104] dans une fenêtre de
//    1100px, et les alvéoles de la travée droite qui la suivent. ──────────────────────────────────
const finDuTourHorsEcran = () => ({
  vue: '1100×780',
  largeur: 1100,
  elements: [
    { nom: '.cc-end (Fin du tour)', left: 1040, right: 1104 },
    { nom: '.cc-arch', left: 437, right: 663 },
  ],
})

test('coin de sortie hors de la fenêtre à droite : défaut nommé, avec son intervalle', () => {
  const d = elementsHorsFenetre(finDuTourHorsEcran())
  assert.equal(d.length, 1, `attendu 1 défaut, obtenu ${d.length} : ${d.join(' | ')}`)
  assert.match(d[0], /sort de la fenêtre par la DROITE/)
  assert.match(d[0], /\[1040\.\.1104\] pour 1100px/)
})

test('élément qui sort par la GAUCHE : défaut nommé de ce côté', () => {
  const d = elementsHorsFenetre({ vue: '900×780', largeur: 900, elements: [{ nom: '.cc-bay-left', left: -34, right: 300 }] })
  assert.equal(d.length, 1)
  assert.match(d[0], /par la GAUCHE/)
})

test('pistes étanches : rien hors fenêtre, même au pixel près', () => {
  // Le cas VERT de #1856 après `minmax(0, 1fr)` : la travée droite rend ce qu'elle a, le coin de
  // sortie rentre. La tolérance d'un pixel absorbe l'arrondi de sous-pixel, pas un débord.
  assert.deepEqual(elementsHorsFenetre({
    vue: '1100×780',
    largeur: 1100,
    elements: [{ nom: '.cc-end (Fin du tour)', left: 1025.6, right: 1090 }, { nom: '.cc-bay-left', left: 0.4, right: 1100.6 }],
  }), [])
})
