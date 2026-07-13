// Test du hook `exception-add-guard` (node --test) : les contournements PROUVÉS de l'audit
// adversarial (2026-07-13) échouent désormais, et les cas légitimes restent silencieux.
// Lancé par `npm run test:hooks`.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { entries, evaluate } from './exception-add-guard.mjs'

const GUARD = 'src/state/label-logic-guard.test.ts' // matche GUARDED
const edit = (before, after, file = GUARD) => evaluate({ file, before, after, isWrite: false, exists: true })
const asks = (d) => assert.ok(d && typeof d.reason === 'string', 'attendu : ask')
const silent = (d) => assert.equal(d, null, `attendu : silence, obtenu : ${d?.reason}`)

// ── Contournements PROUVÉS (doivent ASK) ─────────────────────────────────────────────────────────
test('bypass (a) : deux entrées quotées PACKÉES sur une seule ligne → détecté', () => {
  const before = 'const W = [\n]'
  const after = "const W = [\n  'x.ts:1', 'y.ts:2',\n]"
  const b = entries(before), a = entries(after)
  assert.equal(a.get('x.ts:1'), 1)
  assert.equal(a.get('y.ts:2'), 1)
  assert.equal(b.get('x.ts:1') ?? 0, 0)
  asks(edit(before, after))
})

test('bypass (b) : clé d\'objet NON quotée ajoutée → détecté', () => {
  const before = 'const W = {\n}'
  const after = 'const W = {\n  newKey: true,\n}'
  assert.equal(entries(after).get('newKey'), 1)
  asks(edit(before, after))
})

test('bypass (c) : CRÉATION d\'un fichier de garde (Write, inexistant) → ask systématique', () => {
  const d = evaluate({ file: 'src/ui/relocated-guard.test.ts', before: '', after: 'anything', isWrite: true, exists: false })
  asks(d)
  assert.match(d.reason, /création d'un fichier de garde/)
})

test('CRÉATION d\'une lib guards/ neuve → ask', () => {
  asks(evaluate({ file: 'scripts/guards/lib/newThing.mjs', before: '', after: 'export const x = 1', isWrite: true, exists: false }))
})

test('HAUSSE de baseline de cliquet → ask', () => {
  asks(edit("const B = { 'components': 3 }", "const B = { 'components': 5 }"))
})

// ── Cas légitimes (doivent RESTER silencieux) ────────────────────────────────────────────────────
test('re-pointage (chemin:ligne dont la ligne bouge) → silence', () => {
  silent(edit("const W = [\n  'a/b.ts:10',\n]", "const W = [\n  'a/b.ts:12',\n]"))
})

test('RETRAIT d\'une entrée → silence', () => {
  silent(edit("const W = [\n  'a.ts:1',\n  'b.ts:2',\n]", "const W = [\n  'a.ts:1',\n]"))
})

test('BAISSE de baseline → silence', () => {
  silent(edit("const B = { 'components': 5 }", "const B = { 'components': 3 }"))
})

test('fichier NON gardé (hors motif) → silence même en ajoutant des entrées', () => {
  silent(evaluate({ file: 'src/engine/combat.ts', before: 'const x = []', after: "const x = ['new.ts:1']", isWrite: false, exists: true }))
})

test('Write sur fichier de garde EXISTANT sans ajout net → silence', () => {
  silent(evaluate({ file: GUARD, before: "const W = ['a.ts:1']", after: "const W = ['a.ts:1']", isWrite: true, exists: true }))
})
