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
  frise: { bande: true, margeDroite: 4, roundVisible: true, auTraitVisible: true },
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
