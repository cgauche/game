// Test du GATE `reanchor.mjs` (#434 défaut 1 — « une réf verte peut pointer sur le mauvais texte »,
// node --test). Le cas réel (`e0cf886a` → `c54ba899`) : une réf `ZI 13 l.954` pointait sur un texte
// hors-sujet, quand le vrai passage vivait en `ZI 2 l.68` — `reanchor.mjs` l'avait dans son rapport
// (LOW + « texte trouvé en ZI 2 l.68 ») mais ne bloquait rien. Lancé par `npm run test:raw`.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, writeFileSync, rmSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { countsByChapterRef, assertAgainstBaseline } from './check-refs.mjs'
import { buildIndex, classifyQuote, scan, RAWDIR, LOW_BASELINE_PATH } from './reanchor.mjs'

function withTempRawDir(content, fn) {
  const dir = mkdtempSync(join(tmpdir(), 'reanchor-'))
  writeFileSync(join(dir, 'fixture.md'), content, 'utf8')
  try { fn(dir) } finally { rmSync(dir, { recursive: true, force: true }) }
}

// ---------- classifyQuote (pur, fixtures synthétiques — reproduit la FORME du bug réel) ----------

test('citation absente ici mais présente dans un AUTRE chapitre → LOW, réf trouvée pointée en réponse (cas réel ZI 13→ZI 2)', () => {
  // « chapitre 13 » ne contient PAS le texte cité (topic Fouissement hors-sujet, comme le vrai bug).
  const li13 = buildIndex(['Introduction du chapitre.', '**DR nécessaires :** 18', 'Suite sans rapport.'])
  // « chapitre 2 » contient le VRAI texte, à la ligne 68 dans le cas réel — ici une ligne connue de la fixture.
  const li2 = buildIndex(['pad', 'Cette créature peut se déplacer en creusant un tunnel dans le sol meuble.'])
  const findCross = () => ({ label: 'ZI 2 l.68' })   // simule crossChapter() ayant trouvé l'unique occurrence
  const r = classifyQuote(li13, 954, 'Cette créature peut se déplacer en creusant un tunnel dans le sol meuble.', findCross)
  assert.equal(r.status, 'LOW')
  assert.match(r.reason, /texte trouvé en ZI 2 l\.68/)
})

test('citation absente ici et nulle part ailleurs → LOW, "aucune occurrence"', () => {
  const li = buildIndex(['Rien à voir avec la citation cherchée.'])
  const r = classifyQuote(li, 1, 'Une phrase suffisamment longue pour être une ancre verbatim valide.', () => null)
  assert.equal(r.status, 'LOW')
  assert.equal(r.reason, 'aucune occurrence')
})

test('citation juste à la ligne citée → OK, silencieux', () => {
  const li = buildIndex(['avant', 'Une phrase suffisamment longue pour être une ancre verbatim valide.', 'après'])
  const r = classifyQuote(li, 2, 'Une phrase suffisamment longue pour être une ancre verbatim valide.', () => null)
  assert.equal(r.status, 'OK')
})

test('citation présente mais à une AUTRE ligne du MÊME chapitre → DRIFT (réparable --apply)', () => {
  const li = buildIndex(['avant', 'Une phrase suffisamment longue pour être une ancre verbatim valide.', 'après'])
  const r = classifyQuote(li, 3, 'Une phrase suffisamment longue pour être une ancre verbatim valide.', () => null)
  assert.equal(r.status, 'DRIFT')
  assert.equal(r.foundStart, 2)
})

test('citation dupliquée (occurrences multiples) → MEDIUM, jamais auto-résolu', () => {
  const li = buildIndex([
    'Une phrase suffisamment longue pour être une ancre verbatim valide.',
    'x',
    'Une phrase suffisamment longue pour être une ancre verbatim valide.',
  ])
  const r = classifyQuote(li, 1, 'Une phrase suffisamment longue pour être une ancre verbatim valide.', () => null)
  assert.equal(r.status, 'MEDIUM')
  assert.deepEqual(r.candidates, [1, 3])
})

// ---------- scan() bout en bout (docs/raw temporaire + chapitre RÉEL LDB 6, patron check-refs.test.mjs) ----------

const LDB6_LINE5 = "*(Page 48 partagée avec un chapitre voisin — le contenu de cette section figure dans le chapitre adjacent de l'extraction Marker.)*"

test('scan() : citation juste → silencieuse (pas de ligne LOW, pas dans lowRows)', () => {
  const md = `Une note.\n> « ${LDB6_LINE5} »\n> \`LDB 6 l.5\`\n`
  withTempRawDir(md, (dir) => {
    const r = scan(dir, {})
    assert.equal(r.tally.OK, 1)
    assert.equal(r.tally.LOW, 0)
    assert.equal(r.lowRows.length, 0)
  })
})

test('scan() : citation introuvable dans le chapitre cité → LOW, alimente lowRows (unité du cliquet)', () => {
  const md = `Une note.\n> « Une phrase qui n'existe nulle part dans ce chapitre source. »\n> \`LDB 6 l.5\`\n`
  withTempRawDir(md, (dir) => {
    const r = scan(dir, {})
    assert.equal(r.tally.LOW, 1)
    assert.equal(r.lowRows.length, 1)
    assert.equal(r.lowRows[0].ref, 'LDB 6')
  })
})

test('scan() : citation présente mais à une autre ligne du chapitre RÉEL → DRIFT (réparable, jamais silencieux)', () => {
  const md = `Une note.\n> « ${LDB6_LINE5} »\n> \`LDB 6 l.3\`\n`
  withTempRawDir(md, (dir) => {
    const r = scan(dir, {})
    assert.equal(r.tally.DRIFT, 1)
    assert.equal(r.tally.OK, 0)
  })
})

// ---------- cliquet (réutilise LES MÊMES primitives que check-refs.mjs, patron dead-refs-baseline.json) ----------

test('countsByChapterRef + assertAgainstBaseline : hausse de réfs ❌ LOW détectée', () => {
  const lowRows = [{ ref: 'ZI 13' }, { ref: 'ZI 13' }, { ref: 'LDB 6' }]
  const counts = countsByChapterRef(lowRows)
  assert.deepEqual(counts, { 'ZI 13': 2, 'LDB 6': 1 })
  const { over, stale } = assertAgainstBaseline(counts, { 'ZI 13': 1, 'LDB 6': 1 })
  assert.equal(over.length, 1)
  assert.match(over[0], /ZI 13/)
  assert.equal(stale.length, 0)
})

test('countsByChapterRef + assertAgainstBaseline : baseline PÉRIMÉE (réf réparée) détectée', () => {
  const counts = countsByChapterRef([{ ref: 'LDB 6' }])
  const { over, stale } = assertAgainstBaseline(counts, { 'LDB 6': 1, 'ZI 13': 3 })
  assert.equal(over.length, 0)
  assert.equal(stale.length, 1)
  assert.match(stale[0], /ZI 13/)
})

// ---------- auto-cohérence sur le VRAI Atlas (le cliquet vaut pour de vrai, pas seulement en fixture) ----------

test('scan(RAWDIR) réel : les réfs ❌ LOW mesurées correspondent EXACTEMENT à reanchor-low-baseline.json', () => {
  const r = scan(RAWDIR, {})
  const counts = countsByChapterRef(r.lowRows)
  const baseline = JSON.parse(readFileSync(LOW_BASELINE_PATH, 'utf8'))
  const { over, stale } = assertAgainstBaseline(counts, baseline)
  assert.deepEqual(over, [], `Régression LOW non gelée : ${over.join(', ')}`)
  assert.deepEqual(stale, [], `Baseline LOW périmée à abaisser : ${stale.join(', ')}`)
})
