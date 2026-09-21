import test from 'node:test'
import assert from 'node:assert/strict'
import { liensJugeables, sansBlocsDeCode } from './liensMarkdown.mjs'

const ciblesDe = (texte) => liensJugeables(texte).liens.map((l) => l.cible)

test('liensJugeables : le frère NU vers un `.md` est jugé — c’est la forme dominante entre pages sœurs', () => {
  assert.deepEqual(ciblesDe('voir [`combat.md`](combat.md) et [x](provisions.md).'), ['combat.md', 'provisions.md'])
})

test('liensJugeables : le relatif EXPLICITE reste jugé, toute extension, ancre retirée', () => {
  assert.deepEqual(
    ciblesDe('[a](./y.ts) [b](../x.md) [c](../../CLAUDE.md#sources) [d](sous/z.md?v=1)'),
    ['./y.ts', '../x.md', '../../CLAUDE.md', 'sous/z.md'],
  )
})

test('liensJugeables : une URL à SCHÉMA n’est pas un chemin du dépôt', () => {
  assert.deepEqual(ciblesDe('[a](http://ex.test/p.md) [b](https://ex.test/) [c](mailto:x@ex.test)'), [])
})

test('liensJugeables : l’ancre SEULE et le chemin ABSOLU ne désignent aucun fichier voisin', () => {
  assert.deepEqual(ciblesDe('[a](#un-titre) [b](/ailleurs/x.md)'), [])
})

test('liensJugeables : l’ancre d’un lien est RENDUE, URL-décodée — `null` quand il n’en porte pas', () => {
  assert.deepEqual(
    liensJugeables('[a](x.md#un-titre) [b](y.md) [c](./z.md#acc%C3%A8s) [d](w.md#a?v=1)').liens.map((l) => l.ancre),
    ['un-titre', null, 'accès', 'a'],
  )
})

test('liensJugeables : l’ancre SEULE entre sous `ancresSeules`, avec une cible VIDE — la page courante', () => {
  const liens = liensJugeables('[a](#un-titre) [b](x.md#autre) [c](#)', { ancresSeules: true }).liens
  assert.deepEqual(liens.map((l) => [l.cible, l.ancre]), [['', 'un-titre'], ['x.md', 'autre']])
})

test('liensJugeables : un frère nu d’une AUTRE extension ne se devine pas', () => {
  assert.deepEqual(ciblesDe('[a](x) [b](image.png)'), [])
})

test('liensJugeables : un lien écrit dans un BLOC DE CODE est un exemple, pas un renvoi', () => {
  assert.deepEqual(ciblesDe('avant\n```md\n[a](fantome.md)\n```\naprès [b](reel.md)\n'), ['reel.md'])
})

test('liensJugeables : un lien écrit dans un SPAN de code en ligne est un exemple de syntaxe, pas un renvoi', () => {
  assert.deepEqual(ciblesDe('la forme `](autre.md#un-titre)` s’écrit ainsi, et [b](reel.md) est un lien'), ['reel.md'])
})

test('liensJugeables : le span à backticks MULTIPLES est neutralisé comme le simple', () => {
  assert.deepEqual(ciblesDe('``[a](fantome.md)`` et ```[b](aussi-fantome.md)``` puis [c](reel.md)'), ['reel.md'])
})

test('liensJugeables : un span NEUTRALISÉ ne décale pas le lien qui le suit sur la même ligne', () => {
  const texte = 'l1\nl2 `](fantome.md)` puis [b](reel.md)\n'
  const { texteScanne, liens } = liensJugeables(texte)
  assert.equal(texteScanne.length, texte.length)
  assert.deepEqual(liens.map((l) => l.cible), ['reel.md'])
  assert.equal(texteScanne.slice(0, liens[0].index).split('\n').length, 2)
  assert.equal(texte.slice(liens[0].index), texteScanne.slice(liens[0].index))
})

test('liensJugeables : le texte scanné PRÉSERVE le compte de lignes — la ligne rapportée est celle du document', () => {
  const texte = 'l1\n```\n[a](fantome.md)\n```\nl5 [b](reel.md)\n'
  const { texteScanne, liens } = liensJugeables(texte)
  assert.equal(texteScanne.split('\n').length, texte.split('\n').length)
  assert.equal(texteScanne.slice(0, liens[0].index).split('\n').length, 5)
})

test('sansBlocsDeCode : les clôtures et leur contenu partent, les lignes restent comptées', () => {
  assert.equal(sansBlocsDeCode('a\n```js\nx\n```\nb'), 'a\n\n\n\nb')
})
