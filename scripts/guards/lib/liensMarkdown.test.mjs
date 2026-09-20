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

test('liensJugeables : un frère nu d’une AUTRE extension ne se devine pas', () => {
  assert.deepEqual(ciblesDe('[a](x) [b](image.png)'), [])
})

test('liensJugeables : un lien écrit dans un BLOC DE CODE est un exemple, pas un renvoi', () => {
  assert.deepEqual(ciblesDe('avant\n```md\n[a](fantome.md)\n```\naprès [b](reel.md)\n'), ['reel.md'])
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
