// DÉTECTEUR de la sonde HUD (#1806) — `defauts()` est PURE : elle ne lit qu'une mesure. C'est donc
// elle qu'on teste, à fixtures, sans Chrome ni serveur (gate `test:recette`, `scripts/gates/testsParGate.mjs`).
// COUVERTURE, à énoncer et non à supposer : CHAQUE verdict de `defauts` a ici son cas ROUGE (la
// mesure qui porte le défaut) ET son cas VERT (la même mesure assainie) — un détecteur sans cas
// rouge ne mesure rien, un détecteur sans cas vert crie sur tout.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { defauts } from './hud-clickables.mjs'

/** Mesure de COMBAT sans aucun défaut (le cas vert de référence). */
const combat = () => ({
  largeur: 360,
  combat: true,
  rail: { dissous: true, ouvreurs: [{ i: 0, label: 'Dossier du navire', position: 'absolute', ok: true, hitBy: 'rien', rect: { x: 300, y: 400, w: 44, h: 44 } }] },
  frise: { bande: true, margeDroite: 4, roundVisible: true, teteMesuree: true, teteDecouverte: null,
    teteSurCartouche: null, piedMesure: false, piedRogne: null, pas: { min: 40, max: 40 }, auTraitVisible: true,
    auTrait: { lisere: 3.84, controle: null, rogne: { haut: 0, bas: -4.2, gauche: 0, droite: -8.1 }, sousCartouche: null,
      caret: { h: 10, cache: 0, horsChamp: 0 } } },
  groupe: { cartes: 4, lignes: 1, poignee: null },
  portraits: [],
  objectif: null,
  feedXfrise: null,
  piste: { scrollWidth: 633, clientWidth: 294, bande: 294, defile: true, tientDansLaBande: true },
  tiroir: { ouvert: true, rect: { x: 200, y: 120, w: 160, h: 240 }, surPont: null },
  dock: { rect: { x: 0, y: 380, w: 360, h: 260 } },
  dockBtns: [{ i: 0, label: 'Attaquer', ok: true, hitBy: 'rien', rect: { x: 8, y: 400, w: 60, h: 40 } }],
})

/** Mesure d'EXPLORATION sans aucun défaut. */
const exploration = () => ({
  largeur: 360,
  combat: false,
  rail: null,
  frise: null,
  groupe: { cartes: 4, lignes: 1, poignee: null },
  portraits: [{ i: 0, rendu: true, ok: true, hitBy: 'rien', rect: { x: 10, y: 10, w: 44, h: 44 } }],
  objectif: { marge: 0, avale: false, hitBy: 'boîte au ras de la tête (aucune marge morte)' },
  feedXfrise: null,
  piste: null,
  tiroir: { ouvert: false, rect: null, surPont: null },
  dock: null,
  dockBtns: [],
})

/** La mesure `m` doit lever EXACTEMENT un défaut, dont le texte porte `motif`. */
function rouge(m, phase, motif) {
  const d = defauts(m, phase)
  assert.equal(d.length, 1, `attendu 1 défaut, obtenu ${d.length} : ${d.join(' | ')}`)
  assert.match(d[0], motif)
}

// ── Les deux cas VERTS : sans eux, chaque cas rouge pourrait n'être qu'un détecteur qui crie ──────
test('mesure de combat saine : aucun défaut', () => {
  assert.deepEqual(defauts(combat(), 'combat'), [])
})

test('mesure d’exploration saine : aucun défaut', () => {
  assert.deepEqual(defauts(exploration(), 'exploration'), [])
})

// ── Rail dissous : l'ouvreur d'écran porte son propre ancrage ─────────────────────────────────────
test('ouvreur du rail dissous en FLUX : défaut nommé', () => {
  const m = combat()
  m.rail.ouvreurs[0].position = 'static'
  rouge(m, 'combat', /retombe dans le stage/)
})

test('rail dissous SANS aucun ouvreur : la sonde se déclare AVEUGLE, elle ne se tait pas', () => {
  const m = combat()
  m.rail.ouvreurs = []
  rouge(m, 'combat', /le rail d'outils est dissous et ne porte aucun ouvreur d'écran — sonde aveugle/)
})

test('rail NON dissous : la position en flux ne dit rien (le rail porte alors l’ancrage)', () => {
  const m = combat()
  m.rail.dissous = false
  m.rail.ouvreurs[0].position = 'static'
  assert.deepEqual(defauts(m, 'combat'), [])
})

test('ouvreur du rail RECOUVERT : défaut nommé, recouvrant compris', () => {
  const m = combat()
  m.rail.ouvreurs[0].ok = false
  m.rail.ouvreurs[0].hitBy = 'combat-feed <DIV>'
  rouge(m, 'combat', /ne reçoit pas son clic — recouvert par combat-feed/)
})

// ── Bande de groupe : UNE ligne ──────────────────────────────────────────────────────────────────
test('piste du groupe ENROULÉE : défaut nommé, aux deux phases', () => {
  for (const [m, phase] of [[combat(), 'combat'], [exploration(), 'exploration']]) {
    m.groupe.lignes = 2
    rouge(m, phase, /s'enroule sur 2 lignes/)
  }
})

// ── Bande REPLIÉE (≤560) : mesurée le 2026-09-20 — `.pd-track { display: none }`, les tuiles ont un
//    rect 0×0. Une boîte non RENDUE n'a pas de clic à recevoir ; c'est la POIGNÉE qui porte alors
//    l'affordance, et c'est elle qui doit être atteignable. ──────────────────────────────────
test('bande REPLIÉE dont la poignée reçoit son clic : aucun défaut', () => {
  const m = exploration()
  m.groupe = { cartes: 0, lignes: 0, poignee: { rendu: true, ok: true, hitBy: 'rien', rect: { x: 65, y: 10, w: 122, h: 20 } } }
  m.portraits = m.portraits.map((p) => ({ ...p, rendu: false, ok: false, hitBy: 'iso-stage <svg>', rect: { x: 0, y: 0, w: 0, h: 0 } }))
  assert.deepEqual(defauts(m, 'exploration'), [])
})

test('bande REPLIÉE dont la poignée n’est PAS RENDUE : le groupe est hors d’atteinte', () => {
  const m = exploration()
  m.groupe = { cartes: 0, lignes: 0, poignee: { rendu: false, ok: false, hitBy: 'rien', rect: { x: 0, y: 0, w: 0, h: 0 } } }
  m.portraits = []
  const d = defauts(m, 'exploration')
  assert.equal(d.length, 2, d.join(' | '))
  assert.match(d[0], /la poignée du groupe replié n'est pas rendue/)
})

test('bande REPLIÉE dont la poignée est RECOUVERTE : défaut nommé', () => {
  const m = exploration()
  m.groupe = { cartes: 0, lignes: 0, poignee: { rendu: true, ok: false, hitBy: 'iso-stage <svg>', rect: { x: 65, y: 10, w: 122, h: 20 } } }
  m.portraits = m.portraits.map((p) => ({ ...p, rendu: false, ok: false, hitBy: 'iso-stage <svg>', rect: { x: 0, y: 0, w: 0, h: 0 } }))
  rouge(m, 'exploration', /la poignée du groupe replié .* ne reçoit pas son clic/)
})

test('bande sans carte rendue NI poignée : le groupe est hors d’atteinte', () => {
  const m = combat()
  m.groupe = { cartes: 0, lignes: 0, poignee: null }
  rouge(m, 'combat', /n'offre aucune poignée — il est hors d'atteinte/)
})

test('portrait NON RENDU : jamais « recouvert » (faux positif de bande repliée)', () => {
  const m = exploration()
  m.groupe = { cartes: 0, lignes: 0, poignee: { rendu: true, ok: true, hitBy: 'rien', rect: {} } }
  m.portraits = [{ i: 0, rendu: false, ok: false, hitBy: 'iso-stage <svg>', rect: { x: 0, y: 0, w: 0, h: 0 } }]
  assert.deepEqual(defauts(m, 'exploration'), [])
})

// ── Frise : réserve de droite et tête visible ────────────────────────────────────────────────────
test('frise en BANDE qui réserve sa droite : défaut au-delà de 8px', () => {
  const m = combat()
  m.frise.margeDroite = 168
  rouge(m, 'combat', /réserve 168px à sa droite/)
})

test('frise en COLONNE : la marge de droite ne dit rien (la colonne vit à gauche)', () => {
  const m = combat()
  m.frise.bande = false
  m.frise.margeDroite = 1100
  assert.deepEqual(defauts(m, 'combat'), [])
})

test('cartouche de Round HORS CHAMP à fond de défilement : défaut nommé', () => {
  const m = combat()
  m.frise.roundVisible = false
  rouge(m, 'combat', /le cartouche de Round sort du champ/)
})

test('cartouche de Round ABSENT : la sonde se déclare AVEUGLE, elle ne se tait pas', () => {
  const m = combat()
  m.frise.roundVisible = null
  rouge(m, 'combat', /sonde aveugle sur la tête de frise/)
})

test('vignette VISIBLE dans la tête de frise, piste défilée : défaut chiffré', () => {
  const m = combat()
  m.frise.teteDecouverte = { ox: 51, oy: 9, quoi: 'vignette' }
  rouge(m, 'combat', /vignette se voit dans la tête de frise sur 51×9px/)
})

// Le MOBILIER en débord (score, chevron, pastille d'état) sort du rect de sa cellule : le verdict le
// NOMME par sa classe, une sonde qui n'itère que les vignettes le manquerait (#1867).
test('BADGE de score visible dans la tête : défaut nommé par son mobilier', () => {
  const m = combat()
  m.frise.teteDecouverte = { ox: 5, oy: 4, quoi: 'is-score' }
  rouge(m, 'combat', /is-score se voit dans la tête de frise sur 5×4px/)
})

test('mobilier qui PEINT SUR le cartouche (rang égal) : défaut chiffré, rangs dits', () => {
  const m = combat()
  m.frise.teteSurCartouche = { ox: 20, oy: 16, quoi: 'is-score', rang: 2, rangRound: 2 }
  rouge(m, 'combat', /is-score peint SUR le cartouche de Round \(20×16px, rang 2 contre 2\)/)
})

test('tête de frise COUVERTE par le cartouche : rien à dire', () => {
  const m = combat()
  m.frise.teteDecouverte = null
  m.frise.teteSurCartouche = null
  assert.deepEqual(defauts(m, 'combat'), [])
})

// Un axe qui ne défile pas ne peut RIEN découvrir : le contrat y est intestable, pas violé. L'état
// est porté par la mesure (`teteMesuree`), que le relevé imprime — il ne se change pas en défaut.
test('axe qui NE DÉFILE PAS : aucun verdict de tête (l’état est porté par la mesure)', () => {
  const m = combat()
  m.frise.teteMesuree = false
  assert.deepEqual(defauts(m, 'combat'), [])
})

// ── PIED de la colonne : l'arrondi au pas promet une dernière entrée ENTIÈRE au repos ──────────────
test('entrée du PIED rognée au repos : défaut chiffré', () => {
  const m = combat()
  m.frise.bande = false
  m.frise.piedMesure = true
  m.frise.piedRogne = { debord: 9, zone: 380, reserve: 6 }
  rouge(m, 'combat', /l'entrée du pied déborde de 9px la zone utile de 380px — la hauteur de piste n'est pas un nombre entier d'entrées/)
})

// L'arrondi au pas suppose une hauteur d'entrée CONSTANTE. Le pas se juge SEUL : une entrée plus
// haute que les autres ne rogne le pied qu'aux positions où elle tombe dans la zone utile — le
// verdict du pied ne la verrait pas partout, celui du pas si.
test('pas d’entrée NON CONSTANT : défaut chiffré, sans attendre un pied rogné', () => {
  const m = combat()
  m.frise.bande = false
  m.frise.piedMesure = true
  m.frise.piedRogne = null
  m.frise.pas = { min: 50, max: 62.3 }
  rouge(m, 'combat', /le pas d'entrée n'est pas constant \(50px à 62\.3px\) — l'arrondi de la hauteur de piste au pas ne peut pas tomber juste/)
})

// ── RELIEF de la vignette AU TRAIT : la peinture ne réserve rien d'elle-même ────────────────────
test('vignette au trait qui RECOUVRE un contrôle : défaut nommé, cible et surface', () => {
  const m = combat()
  m.frise.auTrait.controle = { ox: 8.3, oy: 18, quoi: 'is-first', sienne: true }
  rouge(m, 'combat', /la vignette au trait recouvre is-first \(8\.3×18px, sa propre entrée\) — un contrôle recouvert ne reçoit pas son clic/)
})

test('boîte peinte ROGNÉE par un bord du champ : défaut chiffré, côté nommé', () => {
  const m = combat()
  m.frise.auTrait.rogne.bas = 4.8
  rouge(m, 'combat', /la boîte peinte de la vignette au trait dépasse de 4\.8px le bord bas du champ de la piste — son liseré \(3\.84px\) y est rogné/)
})

test('chevron de l’unité au trait MASQUÉ par le cartouche : défaut chiffré', () => {
  const m = combat()
  m.frise.auTrait.caret.cache = 10.8
  rouge(m, 'combat', /le chevron de l'unité au trait est masqué sur 10\.8px de 10px/)
})

test('aucune unité au trait (pause d’initiative) : aucun verdict de relief', () => {
  const m = combat()
  m.frise.auTrait = null
  assert.deepEqual(defauts(m, 'combat'), [])
})

test('pas d’entrée constant : rien à dire', () => {
  const m = combat()
  m.frise.pas = { min: 50, max: 50 }
  assert.deepEqual(defauts(m, 'combat'), [])
})

test('colonne qui ne défile pas : aucun verdict de pied (l’arrondi n’y est pas en jeu)', () => {
  const m = combat()
  m.frise.bande = false
  m.frise.piedMesure = false
  assert.deepEqual(defauts(m, 'combat'), [])
})

test('colonne défilée dont le pied tient entier : rien à dire', () => {
  const m = combat()
  m.frise.bande = false
  m.frise.piedMesure = true
  m.frise.piedRogne = null
  assert.deepEqual(defauts(m, 'combat'), [])
})

// La BANDE horizontale n'a pas d'arrondi au pas : son pied ne se juge pas, et l'absence de mesure
// n'y est pas un aveuglement.
test('bande horizontale : aucun verdict de pied', () => {
  const m = combat()
  m.frise.piedMesure = false
  assert.deepEqual(defauts(m, 'combat'), [])
})

test('acteur AU TRAIT hors du champ de la frise : défaut nommé', () => {
  const m = combat()
  m.frise.auTraitVisible = false
  rouge(m, 'combat', /l'acteur au trait est hors du champ de la frise/)
})

test('aucune entrée au trait (pause d’initiative) : rien à ramener, aucun verdict', () => {
  const m = combat()
  m.frise.auTraitVisible = null
  assert.deepEqual(defauts(m, 'combat'), [])
})

// ── Pont de console ──────────────────────────────────────────────────────────────────────────────
test('console ABSENTE en combat : sonde aveugle', () => {
  const m = combat()
  m.dock = null
  rouge(m, 'combat', /aucune console .* sonde aveugle/)
})

test('console SANS case : sonde aveugle', () => {
  const m = combat()
  m.dockBtns = []
  rouge(m, 'combat', /ne porte aucune case — sonde aveugle/)
})

test('case de console RECOUVERTE : défaut nommé', () => {
  const m = combat()
  m.dockBtns[0].ok = false
  m.dockBtns[0].hitBy = 'initiative-strip <DIV>'
  rouge(m, 'combat', /la case « Attaquer ».*recouverte par initiative-strip/)
})

// ── Tiroir du journal : sa réserve du bas se juge OUVERT ───────────────────────────────
test('tiroir du journal OUVERT qui recouvre la console : défaut chiffré', () => {
  const m = combat()
  m.tiroir.surPont = { ox: 160, oy: 74 }
  rouge(m, 'combat', /le tiroir du journal ouvert recouvre la console de 160×74px/)
})

test('tiroir du journal qui ne s’ouvre pas : sonde aveugle sur sa réserve', () => {
  const m = combat()
  m.tiroir = { ouvert: false, rect: null, surPont: null }
  rouge(m, 'combat', /le tiroir du journal ne s'ouvre pas/)
})

test('aucun tiroir monté : rien à dire (l’écran ne le porte pas)', () => {
  const m = combat()
  m.tiroir = null
  assert.deepEqual(defauts(m, 'combat'), [])
})

// ── Fil, piste ───────────────────────────────────────────────────────────────────────────────────
test('le fil recouvre la frise : défaut chiffré', () => {
  const m = combat()
  m.feedXfrise = { ox: 30, oy: 16 }
  rouge(m, 'combat', /recouvre la frise d'initiative de 30×16px/)
})

test('piste qui DÉBORDE de sa bande : défaut nommé', () => {
  const m = combat()
  m.piste.clientWidth = 633
  m.piste.tientDansLaBande = false
  rouge(m, 'combat', /déborde de sa bande/)
})

test('piste plus longue que la bande qui NE DÉFILE PAS : défaut nommé', () => {
  const m = combat()
  m.piste.defile = false
  rouge(m, 'combat', /ne défile pas/)
})

test('piste qui tient d’un bloc : le défilement n’est pas exigé', () => {
  const m = combat()
  m.piste = { scrollWidth: 200, clientWidth: 294, bande: 294, defile: false, tientDansLaBande: true }
  assert.deepEqual(defauts(m, 'combat'), [])
})

// ── Exploration : objectif et portraits ──────────────────────────────────────────────────────────
test('bandeau d’objectif ABSENT : sonde aveugle sur la zone morte', () => {
  const m = exploration()
  m.objectif = null
  rouge(m, 'exploration', /aucun bandeau d'objectif — sonde aveugle/)
})

test('zone morte de l’objectif qui AVALE le clic : défaut chiffré', () => {
  const m = exploration()
  m.objectif = { marge: 420, avale: true, hitBy: 'objective-banner <DIV>' }
  rouge(m, 'exploration', /420px de carte à droite de l'objectif avalent les clics/)
})

test('aucun portrait de groupe : sonde aveugle', () => {
  const m = exploration()
  m.portraits = []
  rouge(m, 'exploration', /aucun portrait de groupe — sonde aveugle/)
})

test('portrait de groupe RECOUVERT : défaut nommé', () => {
  const m = exploration()
  m.portraits[0].ok = false
  m.portraits[0].hitBy = 'objective-banner <DIV>'
  rouge(m, 'exploration', /le portrait 0 du groupe ne reçoit pas son clic/)
})
