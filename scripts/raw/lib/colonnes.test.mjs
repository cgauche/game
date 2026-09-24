// ORDRE DE LECTURE (#1739) : `lib/colonnes.mjs` sur des pages RÉELLES du CRB, telles que pdfminer les
// lit (`pdf-lignes.py` : boîtes et lignes), réduites à leurs boîtes (`fixtures/pages-crb/p<N>.json`).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { colonnes, lignes } from './colonnes.mjs'

const page = (n) => {
  const f = JSON.parse(readFileSync(new URL(`./fixtures/pages-crb/p${n}.json`, import.meta.url), 'utf8'))
  return f.boites.map(([x0, y0, x1, y1, ls]) => ({
    x0,
    y0,
    x1,
    y1,
    lignes: ls.map(([lx0, ly0, lx1, texte, spans]) => ({ x0: lx0, y0: ly0, x1: lx1, texte, spans: spans.map(([t, i, taille]) => [t, f.polices[i], taille]) })),
  }))
}
const arrondis = (bords) => bords.map((b) => Math.round(b * 10) / 10)
const ligne = (ls, re) => ls.find((l) => re.test(l.texte))
const rang = (ls, re) => ls.findIndex((l) => re.test(l.texte))

test('#1739 : p.117 (impaire) — deux colonnes et l’onglet ; la gouttière ne soude pas « your enemy » à « You are a »', () => {
  const b = page(117)
  assert.deepEqual(arrondis(colonnes(b)), [58.1, 301.9, 579])
  const ls = lignes(b)
  const gauche = ligne(ls, /leaping\s+to\s+attack\s+your\s+enemy/)
  assert.equal(gauche.colonne, 0)
  assert.doesNotMatch(gauche.texte, /You are a/)
  assert.ok(rang(ls, /^Combat Reflexes$/) < rang(ls, /^Crack the Whip$/) && rang(ls, /^Crack the Whip$/) < rang(ls, /^Craftsman \(Trade\)$/), 'colonne gauche lue en entier avant la droite')
})

test('#1739 : p.221 — trois colonnes, les trois titres du même y sont trois lignes', () => {
  const ls = lignes(page(221))
  assert.deepEqual(arrondis(colonnes(page(221))), [58.1, 220.9, 383.6])
  for (const [t, k] of [['Blessing of Battle', 0], ['Blessing of Grace', 1], ['Blessing of Righteousness', 2]]) {
    assert.equal(ligne(ls, new RegExp(`^${t}$`))?.colonne, k, t)
  }
})

test('#1739 : p.38 — un titre de deux mots reste UNE ligne (« CHARACTERISTIC TABLE »)', () => {
  assert.ok(ligne(lignes(page(38)), /^CHARACTERISTIC TABLE$/))
})

test('#1739 : p.335 — petites capitales : l’initiale 18 pt et la suite 12,6 pt sont UNE ligne « Troll »', () => {
  const l = ligne(lignes(page(335)), /^Troll$/)
  assert.deepEqual(l.spans.map((s) => s.taille), [18, 12.6])
})

test('#1739 : p.154 — les cellules d’un tableau restent des lignes distinctes (pas de « PriceEncAvailability »)', () => {
  const ls = lignes(page(154))
  assert.ok(ligne(ls, /^Price$/))
  assert.equal(ls.some((l) => /PriceEnc|EncAvailability/.test(l.texte)), false)
})

test('#1739 : p.47 et p.118 — l’encart de carrière et le tableau pleine largeur n’ouvrent pas de colonne', () => {
  assert.deepEqual(arrondis(colonnes(page(47))), [58.1, 316.8])
  assert.deepEqual(arrondis(colonnes(page(118))), [75.1, 318.9])
})

test('#1739 : colonnes — un encadré en retrait reste dans l’emprise de sa colonne ; une grappe d’une seule ligne n’ouvre rien', () => {
  const b = (x0, x1, y1, n) => ({ x0, y0: y1 - 10 * n, x1, y1, lignes: Array.from({ length: n }, () => ({})) })
  assert.deepEqual(colonnes([b(58, 292, 700, 10), b(58, 292, 500, 10), b(70, 280, 600, 3), b(70, 280, 300, 3), b(302, 536, 700, 20), b(450, 460, 100, 1)]), [58, 302])
})
