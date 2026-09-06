// Verdict de PÉREMPTION du stock des fuites DOM (#1679 L3b) : `src/dom-residu-stock.test.ts` refuse
// une ligne sans fichier, la barrière de `src/test-setup.ts` refuse une fuite HORS stock — ce volet-ci
// refuse une ligne qui ne protège PLUS rien. Rendu par `scripts/test/run.mjs` après une suite complète.
import test from 'node:test'
import assert from 'node:assert/strict'
import { entreesPerimees, messagePeremption, DOM_RESIDU_STOCK } from './domResiduStock.mjs'

const STOCK = new Set(['src/ui/A.test.tsx', 'src/ui/B.test.tsx'])

test('un fichier du stock qui a joué SANS fuir est périmé', () => {
  assert.deepEqual(
    entreesPerimees(['src/ui/A.test.tsx\tpropre', 'src/ui/B.test.tsx\tfui'], STOCK),
    ['src/ui/A.test.tsx'],
  )
})

test('un fichier du stock qui a fui AU MOINS une fois n’est pas périmé', () => {
  assert.deepEqual(
    entreesPerimees(['src/ui/A.test.tsx\tpropre', 'src/ui/A.test.tsx\tfui'], STOCK),
    [],
  )
})

test('un fichier du stock qui n’a PAS joué n’est pas jugé (run filtré, suite écourtée)', () => {
  assert.deepEqual(entreesPerimees(['src/ui/B.test.tsx\tfui'], STOCK), [])
  assert.deepEqual(entreesPerimees([], STOCK), [])
})

test('un fichier HORS stock, propre ou fuyant, ne fait pas de périmé', () => {
  assert.deepEqual(entreesPerimees(['src/ui/Z.test.tsx\tpropre', 'src/ui/Z.test.tsx\tfui'], STOCK), [])
})

test('une ligne malformée est ignorée, jamais lue comme un passage', () => {
  assert.deepEqual(entreesPerimees(['', 'src/ui/A.test.tsx', 'bruit'], STOCK), [])
})

test('le message NOMME les entrées à retirer, et se tait quand il n’y a rien', () => {
  assert.equal(messagePeremption([]), null)
  const msg = messagePeremption(['src/ui/A.test.tsx'])
  assert.match(msg, /src\/ui\/A\.test\.tsx/)
  assert.match(msg, /domResiduStock\.mjs/)
})

test('le stock réel est le défaut du jugement', () => {
  const uneEntree = [...DOM_RESIDU_STOCK][0]
  assert.deepEqual(entreesPerimees([`${uneEntree}\tpropre`]), [uneEntree])
})
