// Le PARSEUR des trois couches CSS (#1800, `node --test` — joué par `npm run test:hooks`) : ce qu'il
// rend, et ce qu'il refuse d'abriter. Aucun disque : chaque cas est une fixture de texte. La MESURE
// sur le corpus réel se prouve ailleurs (`src/ui/ui-ratchets.test.ts`, cliquets (xxi)/(xxii)).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { declarations, decoupeSelecteurs, estPlacement, moduleHorsCouche, reglesCss, valeurHorsEchelle } from './cssCouches.mjs'

test('reglesCss : règle de premier niveau — sélecteurs séparés, corps rendu, media nul', () => {
  assert.deepEqual(reglesCss('.a, .b > .c { color: red; gap: 4px }'), [
    { selecteurs: ['.a', '.b > .c'], corps: ' color: red; gap: 4px ', media: null },
  ])
})

test('reglesCss : blocs IMBRIQUÉS — le contexte at-rule est empilé, rendu, et n’abrite rien', () => {
  const regles = reglesCss('@media (a) { @supports (b) { .x { color: red } } } @keyframes k { from { color: red } }')
  assert.equal(regles.length, 1)
  assert.deepEqual(regles[0].selecteurs, ['.x'])
  assert.equal(regles[0].media, '@media (a) && @supports (b)')
})

test('reglesCss : @keyframes / @font-face sautés en BLOC (leur corps n’est pas fait de sélecteurs)', () => {
  assert.deepEqual(
    reglesCss('@keyframes p { 0%, 100% { opacity: 0.5 } 50% { opacity: 1 } } .z { color: red }'),
    [{ selecteurs: ['.z'], corps: ' color: red ', media: null }],
  )
  assert.deepEqual(reglesCss('@font-face { font-family: X; src: url(a.woff) }'), [])
})

test('reglesCss : un commentaire ne déclare rien, un prélude at-rule n’est jamais un sélecteur', () => {
  assert.deepEqual(reglesCss('/* .faux { color: red } */ .vrai { gap: 0 }').map((r) => r.selecteurs), [['.vrai']])
  assert.deepEqual(reglesCss('@media (max-width: 700px) { .x { gap: 0 } }')[0].selecteurs, ['.x'])
})

test('reglesCss : une at-rule DÉCLARATION se clôt sur son `;` et ne colle pas à la règle suivante', () => {
  const apresImport = reglesCss('@import "a.css"; .x { color: red }')
  assert.deepEqual(apresImport, [{ selecteurs: ['.x'], corps: ' color: red ', media: null }])
  const apresCharset = reglesCss('@charset "u"; @media (max-width:700px) { .x { color: red } }')
  assert.equal(apresCharset.length, 1)
  assert.equal(apresCharset[0].media, '@media (max-width:700px)')
})

test('reglesCss : une accolade CITÉE dans une valeur ne ferme pas le bloc', () => {
  assert.deepEqual(reglesCss(".a::after { content: '}' } .b { color: red }").map((r) => r.selecteurs), [['.a::after'], ['.b']])
})

test('declarations : sépare sur les `;` de premier niveau seulement', () => {
  assert.deepEqual(declarations('padding: 0 max(12px, env(safe-area-inset-left)); color: red;'), [
    { prop: 'padding', valeur: '0 max(12px, env(safe-area-inset-left))' },
    { prop: 'color', valeur: 'red' },
  ])
  assert.deepEqual(declarations('  ;  '), [])
})

test('estPlacement : la liste FERMÉE place, tout le reste PEINT', () => {
  for (const p of ['display', 'flex', 'flex-direction', 'grid-template-columns', 'gap', 'padding-left',
    'margin-inline-start', 'min-width', 'max-height', 'overflow-y', 'position', 'z-index', 'text-align',
    'white-space', 'list-style', 'touch-action', 'user-select', 'transform', '--ma-var',
    'contain', 'container', 'container-type', 'container-name']) {
    assert.equal(estPlacement(p), true, `${p} PLACE`)
  }
  for (const p of ['color', 'background', 'border', 'border-color', 'border-radius', 'box-shadow',
    'font-size', 'font-weight', 'opacity', 'cursor', 'transition', 'filter', 'line-height']) {
    assert.equal(estPlacement(p), false, `${p} PEINT`)
  }
})

test('valeurHorsEchelle : un littéral de longueur NON NUL, et rien d’autre', () => {
  for (const v of ['10px', '0 10px', '1.5rem', '0 max(12px, env(safe-area-inset-left))', '8px 10px']) {
    assert.equal(valeurHorsEchelle(v), true, v)
  }
  for (const v of ['0', 'auto', '0 auto', 'var(--sp-md)', 'calc(3 * var(--sp-md))', '50%', '2vw', '0px']) {
    assert.equal(valeurHorsEchelle(v), false, v)
  }
})

test('reglesCss : une virgule DANS `:has()`/`:is()` ne coupe pas la liste (#1806)', () => {
  const regles = reglesCss('label:has(> a, > .btn) { color: red }')
  assert.deepEqual(regles[0].selecteurs, ['label:has(> a, > .btn)'])
  // Les virgules de NIVEAU 0 séparent toujours, y compris autour d'un sélecteur à parenthèses.
  assert.deepEqual(reglesCss('.a:is(.x, .y), .b[data-k="1,2"] { color: red }')[0].selecteurs, [
    '.a:is(.x, .y)',
    '.b[data-k="1,2"]',
  ])
})

test('decoupeSelecteurs : niveau 0 seulement, espaces réduits, vides écartés', () => {
  assert.deepEqual(decoupeSelecteurs('  .a ,  .b:not(.c, .d) , '), ['.a', '.b:not(.c, .d)'])
})

test('moduleHorsCouche : `src/ui/styles/`, ou la zone du `fichier` hors de `src/ui` (#1806 A3)', () => {
  assert.equal(moduleHorsCouche('src/ui/RollShell.tsx', 'src/ui/styles/roll-shell.css'), false)
  assert.equal(moduleHorsCouche('src/gameIso/stage/GameStage3D.tsx', 'src/gameIso/anim.css'), false)
  assert.equal(moduleHorsCouche('src/gameIso/stage/GameStage3D.tsx', 'src/ui/styles/hud.css'), false)
  // Une primitive de `src/ui` ne colocalise pas sa feuille ; une autre ne sort pas de SA zone.
  assert.equal(moduleHorsCouche('src/ui/RollShell.tsx', 'src/ui/RollShell.css'), true)
  assert.equal(moduleHorsCouche('src/gameIso/stage/GameStage3D.tsx', 'src/state/anim.css'), true)
  assert.equal(moduleHorsCouche('src/gameIso/stage/GameStage3D.tsx', 'src/gameIso/anim.ts'), true)
})
