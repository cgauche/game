// Tests de l'aligneur `anchor-fill` (node --test) : index compact, candidats de tête glissants,
// bornage à deux côtés, et non-régression du cas RÉEL NADJ 06 (#833). Lancé par `npm run test:raw`.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { join } from 'node:path'
import { BOOKS, readText } from './_lib.mjs'
import {
  buildCompactIndex, compactAnchor, extractContentHeads,
  existingFolioLines, folioBounds, planChapter,
} from './anchor-fill.mjs'

// ---------- compactAnchor ----------

test('compactAnchor : retrouve une tête dont le PDF a éclaté les lettres à l’intérieur des mots', () => {
  const lines = ['Lors de chaque Round, le sorcier doit réussir un Test de Focalisation pour maintenir son sort.']
  const idx = buildCompactIndex(lines)
  // Tête telle que pypdf la rend sur une page en petites capitales.
  const head = 'L ors de chaque Round, le sorcier doit réussir un TesT de FocalisaT ion'
  const hit = compactAnchor(idx.joined, head.toLowerCase())
  assert.equal(hit.occ.length, 1)
  assert.equal(hit.occ[0], 0)
})

test('compactAnchor : tête absente → aucune occurrence', () => {
  const idx = buildCompactIndex(['Rien à voir avec la tête cherchée, mais assez longue pour la borne minimale.'])
  assert.deepEqual(compactAnchor(idx.joined, 'une tete de page totalement etrangere a ce texte la voila').occ, [])
})

test('compactAnchor : tête présente deux fois → deux occurrences (l’appelant exige l’unicité)', () => {
  const phrase = 'la meme tete de page repetee mot pour mot dans deux endroits du fichier'
  const idx = buildCompactIndex([phrase, 'intercalaire', phrase])
  assert.equal(compactAnchor(idx.joined, phrase).occ.length, 2)
})

test('compactAnchor : le préfixe retenu commence AU DÉBUT de la tête (offset jamais déplacé)', () => {
  const idx = buildCompactIndex(['pad pad pad', 'le début de la tête de page se poursuit ici avec beaucoup de mots communs, puis le md diverge.'])
  const hit = compactAnchor(idx.joined, 'le début de la tête de page se poursuit ici avec beaucoup de mots communs, mais la queue du candidat PDF est absente.')
  assert.equal(hit.occ.length, 1)
  assert.equal(hit.occ[0], buildCompactIndex(['pad pad pad', '']).joined.length)
})

// ---------- extractContentHeads ----------

test('extractContentHeads : écarte le boilerplate de tête (folio, code de chapitre, titre courant)', () => {
  const page = '28\nIV\nWARHAMMER FANTASY\nPendant que les aventuriers observent la source du vacarme,\nil glisse une sarbacane.'
  const heads = extractContentHeads(page)
  assert.ok(heads[0].head.startsWith('Pendant que les aventuriers'))
  assert.equal(heads[0].slide, 0)
})

test('extractContentHeads : produit des candidats DÉCALÉS d’une ligne, dans l’ordre', () => {
  const page = ['une premiere ligne de prose', 'une deuxieme ligne de prose', 'une troisieme ligne de prose'].join('\n')
  const heads = extractContentHeads(page, { maxLines: 1, slideMax: 2 })
  assert.deepEqual(heads.map((h) => h.slide), [0, 1, 2])
  assert.equal(heads[1].head, 'une deuxieme ligne de prose')
})

test('extractContentHeads : page sans aucun mot réel (planche) → aucun candidat exploitable', () => {
  assert.deepEqual(extractContentHeads('42\nIV\nWARHAMMER FANTASY'), [])
  assert.deepEqual(extractContentHeads(''), [])
})

// ---------- bornage ----------

test('existingFolioLines : chaque folio ancré → sa ligne 1-based, première occurrence retenue', () => {
  const text = ['entete', '<span id="page-4-0" data-folio="3"></span>a', 'b', '<span id="page-6-0" data-folio="5"></span>c', '<span id="page-4-0" data-folio="3"></span>bis'].join('\n')
  const map = existingFolioLines(text)
  assert.equal(map.get(3), 2)
  assert.equal(map.get(5), 4)
})

test('folioBounds : encadre par les VOISINS immédiats, pas par le dernier posé', () => {
  const known = new Map([[23, 3], [25, 21], [27, 87], [32, 268]])
  assert.deepEqual(folioBounds(known, 24), { lo: 3, hi: 21, loFolio: 23, hiFolio: 25 })
  assert.deepEqual(folioBounds(known, 30), { lo: 87, hi: 268, loFolio: 27, hiFolio: 32 })
})

test('folioBounds : sans voisin d’un côté, la borne reste OUVERTE', () => {
  const known = new Map([[10, 40]])
  assert.deepEqual(folioBounds(known, 5), { lo: 0, hi: 40, loFolio: null, hiFolio: 10 })
  assert.deepEqual(folioBounds(known, 12), { lo: 40, hi: Infinity, loFolio: 10, hiFolio: null })
  assert.deepEqual(folioBounds(new Map(), 7), { lo: 0, hi: Infinity, loFolio: null, hiFolio: null })
})

test('planChapter : un candidat unique mais HORS des bornes voisines est refusé, avec sa raison', () => {
  const lines = [
    '*Pages PDF 2-4*',                                       // folios 1 à 3 (offset 0)
    '<span id="page-1-0" data-folio="1"></span>tete du folio un, prose assez longue pour ancrer',
    'suite du folio un, encore de la prose bien fournie ici',
    '<span id="page-3-0" data-folio="3"></span>tete du folio trois, prose assez longue pour ancrer',
    'une ligne bien plus bas qui ne peut pas appartenir au folio deux du tout',
  ]
  const pages = { 2: 'une ligne bien plus bas qui ne peut pas appartenir au folio deux du tout' }
  const plan = planChapter('01 - X.md', lines.join('\n'), 0, (K) => pages[K])
  assert.deepEqual(plan.missing, [2])
  assert.deepEqual(plan.placed, [])
  assert.equal(plan.skipped.length, 1)
  assert.match(plan.skipped[0].reason, /hors bornes .*folio 1.*folio 3/)
})

test('planChapter : le même candidat DANS les bornes est posé', () => {
  const lines = [
    '*Pages PDF 2-4*',
    '<span id="page-1-0" data-folio="1"></span>tete du folio un, prose assez longue pour ancrer',
    'tete du folio deux, prose assez longue pour ancrer sans ambiguite',
    '<span id="page-3-0" data-folio="3"></span>tete du folio trois, prose assez longue pour ancrer',
  ]
  const pages = { 2: 'tete du folio deux, prose assez longue pour ancrer sans ambiguite' }
  const plan = planChapter('01 - X.md', lines.join('\n'), 0, (K) => pages[K])
  assert.deepEqual(plan.placed.map((p) => [p.folio, p.line]), [[2, 3]])
})

// ---------- non-régression du cas RÉEL NADJ 06 (#833) ----------
// Têtes de page telles que `lib/pdf-extract.py` (pypdf) les rend pour NADJ, K 25/29/30/31/32
// (offset 1 → folios 24/28/29/30/31). La page du folio 24 ne porte AUCUN contenu : son seul mot
// réel est le filigrane de personnalisation de l'exemplaire PDF, qui se répète hors de toute page.
const NADJ_PAGE_HEADS = {
  25: '24\nIV\nWARHAMMER FANTASY\nmanu mirof - emmanuel.mirof@gmail.com',
  29: '28\nIV\nWARHAMMER FANTASY\nPendant que les aventuriers observent la source du vacarme, \nil glisse une sarbacane et un petit étui de dards empoisonnés \ndans les vêtements du Personnage qui semble le moins capable \nde repérer la tentative. Cela fonctionne comme le pickpocket, \nla seule différence étant que cela vise à faire l’inverse. Cela \ndemande donc un Test Opposé d’Escamotage/Perception \nréussi dont la difficulté est modifiée selon les circonstances \ncomme vous le jugez bon.',
  30: '29\nUNE JOURNÉE AU TRIBUNAL\nIV\nDUEL JUDICIAIRE\nSous la loi impériale, les nobles, ainsi que d’autres \npersonnes sous certaines circonstances, peuvent faire \nappel à un duel judiciaire au lieu de faire face à un \njury. Beaucoup de nobles, et un certain nombre de \ngrands prêtres et marchands influents entretiennent des \nchampions de justice dans leurs suites pour cette raison.',
  31: '30\nIV\nWARHAMMER FANTASY\n« Oyez ! Oyez ! » crie-t-il. « Dans l’affaire du noble baron Eberhardt \nvon Dammenblatz de Wissenberg contre la noble gravin Maria \nUlrike von Liebwitz d’Ambosstein, concernant la mort de feu le \nnoble baron Otto von Dammenblatz, seigneur de Wissenberg, que \nles champions s’avancent et que le jugement commence ! »',
  32: '31\nUNE JOURNÉE AU TRIBUNAL\nIV\nRechtshandler pousse un cri de désarroi et agrippe son cou, \nretirant le dard et le montrant à la Gravin, qui se lève et \napproche les magistrats. Le combat est encore une fois arrêté \nsous les railleries et les huées de la foule pendant que le dard \nest examiné.',
}
const NADJ_FILE = '06 - Une journée au tribunal.md'

test('NADJ 06 (cas réel #833) : les folios encadrés par des ancres EXISTANTES sont posés, le filigrane est refusé', () => {
  const dir = new Map(BOOKS).get('NADJ')
  const text = readText(join(dir, NADJ_FILE))
  const known = existingFolioLines(text)
  const plan = planChapter(NADJ_FILE, text, 1, (K) => NADJ_PAGE_HEADS[K])

  // Les folios 28/29/30 se lisent entre les ancres EXISTANTES 27 et 32 : ils doivent être posés,
  // dans cet ordre, à l'intérieur de cet intervalle. Un bornage réduit au dernier folio POSÉ du run
  // les rejetterait (le folio 24 aurait alors été posé sur le filigrane, bien plus bas).
  const placed = new Map(plan.placed.map((p) => [p.folio, p.line]))
  for (const folio of [28, 29, 30]) {
    assert.ok(placed.has(folio), `folio ${folio} non posé — le bornage a rejeté une ancre juste`)
    assert.ok(placed.get(folio) > known.get(27), `folio ${folio} posé avant l'ancre existante du folio 27`)
    assert.ok(placed.get(folio) < known.get(32), `folio ${folio} posé après l'ancre existante du folio 32`)
  }
  assert.ok(placed.get(28) < placed.get(29) && placed.get(29) < placed.get(30))

  // Le folio 24 n'a que le filigrane pour tête : sa seule occurrence tombe hors de l'intervalle
  // ouvert par les ancres existantes 23 et 25 → refusé, jamais posé.
  assert.ok(!placed.has(24), 'folio 24 posé sur le filigrane de personnalisation du PDF')
  const skip24 = plan.skipped.find((s) => s.folio === 24)
  assert.ok(skip24, 'folio 24 ni posé ni rapporté')
  assert.match(skip24.reason, /hors bornes/)
})
