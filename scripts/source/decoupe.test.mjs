// Tests de la bibliothèque de DÉCOUPE (`decoupe.mjs`) : recollage des paragraphes coupés par un
// saut de folio, folio COURANT, occurrences de titres dupliqués, adresse de CELLULE de table et
// contrôle d'empreinte. Comme les voisins de `scripts/raw/*.test.mjs`, ces tests lisent le VRAI
// `Source/` (aucune fixture inventée) — les cas de recette sont cités par `fichier:ligne`.
// Lancé par `node --test scripts/source/decoupe.test.mjs`.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { chapterIndex, findCells, normText, resolveCell, resolveDecoupe, sumOf } from './decoupe.mjs'

const LDB = 'livre-de-base'
const sectionOf = (ch, slug, occ = 1) =>
  chapterIndex(LDB, ch).sections.find((s) => s.slug === slug && s.occ === occ)

// `21 - Psychologie.md:45-48` : le folio coupe la phrase mi-mot (« … comme les » / « « ostlanders » … »).
test('recollage : Préjugé (Cible) rend un paragraphe d\'un seul tenant', () => {
  const sec = sectionOf('21', 'prejuge-cible')
  assert.equal(sec.blocks.length, 2)
  assert.match(sec.blocks[0].md, /comme les « ostlanders », les « elfes »/)
})

// `05 - _gjdgxs.md:438-441` : le bloc précédent finit par `…protéger une autre.*` (ponctuation
// masquée sous l'emphase) et le suivant OUVRE sur `**Exemple :**` — deux paragraphes logiques.
test('D1 : pas de recollage quand la ponctuation finale est sous l\'emphase et que le suivant ouvre sur `**`', () => {
  const sec = sectionOf('05', 'choisir-la-motivation')
  const clotilda = sec.blocks.findIndex((b) => b.md.includes('Clotilda'))
  assert.ok(clotilda >= 0, 'le bloc « Exemple : Clotilda » existe')
  assert.ok(sec.blocks[clotilda].md.endsWith('protéger une autre.*'))
  assert.ok(!sec.blocks[clotilda].md.includes('Ebba'), 'l\'exemple suivant reste un bloc distinct')
  assert.ok(sec.blocks[clotilda + 1].md.startsWith('**Exemple :** *Ebba'))
})

// `09 - Compétences.md:26-30` : discrimine la SEULE règle de ponctuation sous habillage — le bloc
// suivant est de la prose nue, seul un `…l'Agilité.*` vu comme terminé empêche la soudure.
test('D1 : ponctuation terminale sous emphase — coupe même quand le suivant est de la prose nue', () => {
  const sec = sectionOf('09', 'competences-de-base-et-avancees')
  const sigrid = sec.blocks.findIndex((b) => b.md.includes('Sigrid'))
  assert.ok(sec.blocks[sigrid].md.endsWith("l'Agilité.*"))
  assert.ok(sec.blocks[sigrid + 1].md.startsWith('Les Compétences Avancées'))
})

// `08 - Statut.md:262-265` : discrimine la SEULE règle d'ouverture — le bloc précédent
// (« **Possessions :** … vêtement de qualité ») ne finit sur AUCUNE ponctuation.
test('D1 : un bloc suivant ouvert par une emphase reste un paragraphe distinct', () => {
  const sec = sectionOf('08', 'maitre-de-guilde-or-1')
  const poss = sec.blocks.findIndex((b) => b.md.startsWith('**Possessions :**'))
  assert.ok(poss >= 0)
  assert.ok(!/[.!?»”:;]$/.test(sec.blocks[poss].md), 'le bloc précédent ne porte aucune ponctuation finale')
  assert.ok(sec.blocks[poss + 1].md.startsWith('*Ambitieux et socialement mobile'))
})

// `19 - Corruption.md:140` : le marqueur `data-folio="185"` ouvre la section, aucun span n'est
// INTERNE aux blocs de la table qui suit — sans folio courant, la ref rendrait `folios: []`.
test('B : folio courant — une ref sans span interne rend tout de même son folio', () => {
  const sec = sectionOf('19', 'tableau-de-corruption-mentale')
  const last = sec.blocks.length - 1
  assert.deepEqual(sec.blocks[last].folios, [], 'aucun marqueur interne au dernier bloc')
  const res = resolveDecoupe({ book: LDB, ch: '19', sec: 'tableau-de-corruption-mentale', b0: last, b1: last })
  assert.deepEqual(res.folios, [185])
})

test('B : le folio courant roule d\'une section à l\'autre du chapitre', () => {
  const terreur = sectionOf('21', 'terreur-indice')
  assert.equal(terreur.folio, 191, 'folio hérité du marqueur de la section précédente (21:47)')
  const res = resolveDecoupe({ book: LDB, ch: '21', sec: 'terreur-indice', b0: 0, b1: 0 })
  assert.deepEqual(res.folios, [191])
})

// `08 - Statut.md` répète « Évolution de Carrière » ×31 : `secOcc` est la seule chose qui distingue.
test('titres dupliqués : occ=2 résout une section différente d\'occ=1', () => {
  const s1 = sectionOf('08', 'evolution-de-carriere', 1)
  const s2 = sectionOf('08', 'evolution-de-carriere', 2)
  assert.ok(s1 && s2)
  assert.notEqual(s1.line, s2.line)
  const r1 = resolveDecoupe({ book: LDB, ch: '08', sec: 'evolution-de-carriere', secOcc: 1, b0: 0, b1: 0 })
  const r2 = resolveDecoupe({ book: LDB, ch: '08', sec: 'evolution-de-carriere', secOcc: 2, b0: 0, b1: 0 })
  assert.notEqual(r1.md, r2.md)
})

// `19 - Corruption.md:118` : `| 01–05 | Pattes d'animaux | +1 Mouvement | | |`
const CELL = { book: LDB, ch: '19', sec: 'tableau-de-corruption-physique', row: "Pattes d'animaux", col: 'Effet' }

test('C : adresse de cellule — clé de ligne × en-tête de colonne', () => {
  const res = resolveCell(CELL)
  assert.equal(res.md, '+1 Mouvement')
  assert.deepEqual(res.folios, [184])
})

test('C : la clé de ligne se cherche dans TOUTES les colonnes', () => {
  assert.equal(resolveCell({ ...CELL, row: '01–05', col: 'Description' }).md, "Pattes d'animaux")
})

test('C : erreurs structurées — ligne introuvable, colonne inconnue', () => {
  assert.equal(resolveCell({ ...CELL, row: 'Pattes de chaise' }).error, 'ligne-introuvable')
  assert.equal(resolveCell({ ...CELL, col: 'Conséquence' }).error, 'colonne-inconnue')
})

test('C : `findCells` retrouve la cellule dans le livre, une seule fois', () => {
  const hits = findCells(LDB, normText('+1 Mouvement'))
  assert.equal(hits.length, 1)
  assert.equal(hits[0].ch, '19')
  assert.equal(hits[0].sec, 'tableau-de-corruption-physique')
})

test('D : empreinte — une ref juste passe, une ref falsifiée est refusée', () => {
  const ref = { book: LDB, ch: '21', sec: 'prejuge-cible', b0: 0, b1: 1 }
  const sum = sumOf(resolveDecoupe(ref).md)
  assert.match(sum, /^[0-9a-f]{12}$/)
  assert.ok(!resolveDecoupe({ ...ref, sum }).error)
  const ko = resolveDecoupe({ ...ref, sum: '000000000000' })
  assert.equal(ko.error, 'empreinte-divergente')
  assert.match(ko.detail, /texte résolu=/)
})

test('D : l\'empreinte est vérifiée aussi sur une adresse de cellule', () => {
  const sum = sumOf(resolveCell(CELL).md)
  assert.ok(!resolveCell({ ...CELL, sum }).error)
  assert.equal(resolveCell({ ...CELL, sum: 'deadbeefcafe' }).error, 'empreinte-divergente')
})

test('bornes hors limites', () => {
  const sec = sectionOf('21', 'prejuge-cible')
  const base = { book: LDB, ch: '21', sec: 'prejuge-cible' }
  assert.equal(resolveDecoupe({ ...base, b0: 0, b1: sec.blocks.length }).error, 'bornes-hors-limites')
  assert.equal(resolveDecoupe({ ...base, b0: -1, b1: 0 }).error, 'bornes-hors-limites')
  assert.equal(resolveDecoupe({ ...base, b0: 1, b1: 0 }).error, 'bornes-hors-limites')
  assert.equal(resolveDecoupe({ ...base, b0: 0, b1: 1.5 }).error, 'bornes-hors-limites')
  assert.equal(resolveDecoupe({ ...base, sec: 'section-qui-nexiste-pas', b0: 0, b1: 0 }).error, 'section-inconnue')
  assert.equal(resolveDecoupe({ book: LDB, ch: '99', sec: 'x', b0: 0, b1: 0 }).error, 'chapitre-introuvable')
})
