// La preuve de conservation d'une migration CSS (#1806) : ce qu'elle voit, et ce qu'elle laisse
// passer à bon droit. Aucun disque : chaque image est une table `chemin → texte`.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { aplatir, bascules, comparerPoids, deplierImports, ecarts, inversions, specificite, sujet } from './cssConservation.mjs'

const image = (fichiers) => (rel) => fichiers[rel] ?? null
const ENTREE = 'src/ui/styles.css'

test('deplierImports : ordre de cascade, import déplié AVANT sa feuille, feuille absente ignorée', () => {
  const lire = image({
    [ENTREE]: "@import './styles/a.css';\n@import './styles/absente.css';\n@import './styles/b.css';\n.racine { color: red }",
    'src/ui/styles/a.css': "@import './b.css';\n.a { color: red }",
    'src/ui/styles/b.css': '.b { color: red }',
  })
  assert.deepEqual(deplierImports(ENTREE, lire).map((f) => f.rel), ['src/ui/styles/b.css', 'src/ui/styles/a.css', ENTREE])
})

test('specificite et sujet : composé de droite, attributs et pseudo-classes en classes', () => {
  assert.equal(specificite('.btn.vc-btn'), '0-2-0')
  assert.equal(specificite('.skin-tole[data-ton]'), '0-2-0')
  assert.equal(specificite('.pd-micro > i'), '0-1-1')
  assert.equal(specificite('.a:hover::before'), '0-2-1')
  // `:not()` pèse son ARGUMENT, pas une classe de plus ; une pseudo-classe après un élément ne
  // compte pas un second élément ; `:where()` ne pèse rien ; `:nth-child()` pèse une classe.
  assert.equal(specificite('.btn:not(:disabled):hover'), '0-3-0')
  assert.equal(specificite('.btn:not(.a, #x)'), '1-1-0')
  assert.equal(specificite('a:hover'), '0-1-1')
  assert.equal(specificite(':where(.a, .b) li:nth-child(2n + 1)'), '0-1-1')
  assert.equal(specificite('#app .stage > .party-dock.on'), '1-3-0')
  assert.equal(comparerPoids('.stage > .party-dock.on', '.stage > .party-dock'), 1)
  assert.equal(comparerPoids('.a .b .c .d .e .f .g .h .i .j .k', '#x'), -1)
  assert.equal(sujet('.party-dock .ptile-states[data-reserve]'), 'ptile-states')
  assert.equal(sujet('.btn.vc-btn'), 'btn.vc-btn')
  assert.equal(sujet('.pd-micro > i'), 'i')
})

test('ecarts : une règle DÉPLACÉE telle quelle ne laisse aucun reliquat', () => {
  const avant = aplatir(ENTREE, image({ [ENTREE]: "@import './styles/hud.css';", 'src/ui/styles/hud.css': '.ptile { color: red; gap: 4px }' }))
  const apres = aplatir(ENTREE, image({ [ENTREE]: "@import './styles/tile.css';", 'src/ui/styles/tile.css': '.ptile { color: red; gap: 4px }' }))
  assert.deepEqual(ecarts(avant, apres), { disparues: [], apparues: [] })
})

test('ecarts : une déclaration PERDUE au déplacement est nommée, une valeur changée sort des deux côtés', () => {
  const avant = aplatir(ENTREE, image({ [ENTREE]: '.purse { font-size: 12px; color: var(--muted); margin: 0 }' }))
  const apres = aplatir(ENTREE, image({ [ENTREE]: '.purse { margin: 0; color: var(--gold) }' }))
  const { disparues, apparues } = ecarts(avant, apres)
  assert.deepEqual(disparues.map((e) => `${e.prop}: ${e.valeur}`), ['font-size: 12px', 'color: var(--muted)'])
  assert.deepEqual(apparues.map((e) => `${e.prop}: ${e.valeur}`), ['color: var(--gold)'])
})

test('ecarts : le MÉDIA fait partie de l’identité — une règle sortie de son @media est un écart', () => {
  const avant = aplatir(ENTREE, image({ [ENTREE]: '@media (max-width: 700px) { .modal-actions { flex-wrap: wrap } }' }))
  const apres = aplatir(ENTREE, image({ [ENTREE]: '.modal-actions { flex-wrap: wrap }' }))
  assert.equal(ecarts(avant, apres).disparues[0].media, '@media (max-width: 700px)')
  assert.equal(ecarts(avant, apres).apparues[0].media, '')
})

test('inversions : à spécificité ÉGALE, deux règles réparties dans deux modules importés à l’envers', () => {
  const regles = { rack: '.ptile-states[data-reserve] { --alv: 15px }', dock: '.party-dock .ptile-states { --alv: 20px }' }
  const avant = aplatir(ENTREE, image({ [ENTREE]: `${regles.rack}\n${regles.dock}` }))
  const feuilles = { 'src/ui/styles/chips.css': regles.rack, 'src/ui/styles/dock.css': regles.dock }
  const bonOrdre = aplatir(ENTREE, image({ [ENTREE]: "@import './styles/chips.css';\n@import './styles/dock.css';", ...feuilles }))
  const mauvaisOrdre = aplatir(ENTREE, image({ [ENTREE]: "@import './styles/dock.css';\n@import './styles/chips.css';", ...feuilles }))
  assert.deepEqual(inversions(avant, bonOrdre), [])
  const trouvees = inversions(avant, mauvaisOrdre)
  assert.equal(trouvees.length, 1)
  assert.equal(trouvees[0].groupe, 'ptile-states|--alv|0-2-0')
})

test('inversions : une base passée APRÈS sa surcharge responsive est vue ; une spécificité différente ne l’est pas', () => {
  const base = '.pd-track { gap: 8px }'
  const etroit = '@media (max-width: 560px) { .pd-track { gap: 4px } }'
  const avant = aplatir(ENTREE, image({ [ENTREE]: `${base}\n${etroit}` }))
  const apres = aplatir(ENTREE, image({ [ENTREE]: `${etroit}\n${base}` }))
  assert.equal(inversions(avant, apres).length, 1)
  const fort = aplatir(ENTREE, image({ [ENTREE]: '.a .pd-track { gap: 8px }\n.pd-track { gap: 4px }' }))
  const fortInverse = aplatir(ENTREE, image({ [ENTREE]: '.pd-track { gap: 4px }\n.a .pd-track { gap: 8px }' }))
  assert.deepEqual(inversions(fort, fortInverse), [])
})

test('inversions : une paire `!important` / non important n’en est pas une (l’importance tranche avant l’ordre)', () => {
  const arche = '.cc-arch .ptile { width: 40px !important }'
  const frise = '.is-tiles .ptile { width: 34px }'
  const avant = aplatir(ENTREE, image({ [ENTREE]: `${arche}\n${frise}` }))
  const apres = aplatir(ENTREE, image({ [ENTREE]: `${frise}\n${arche}` }))
  assert.deepEqual(inversions(avant, apres), [])
  const deuxFortes = (x, y) => aplatir(ENTREE, image({ [ENTREE]: `${x}\n${y}` }))
  const friseForte = '.is-tiles .ptile { width: 34px !important }'
  assert.equal(inversions(deuxFortes(arche, friseForte), deuxFortes(friseForte, arche)).length, 1)
})

// Le défaut mesuré au 2a : l'ancrage `.party-dock` (0-1-0) rendu à son hôte devient
// `.stage > .party-dock` (0-2-0), à égalité avec l'état `.party-dock.on` que la primitive importe
// AVANT — le rang de repos (45) écrase le rang déplié (60). Aucune déclaration n'est « conservée »
// du côté renommé : `inversions` est aveugle, `bascules` le voit.
test('bascules : un sélecteur RE-PONDÉRÉ qui passe devant une déclaration conservée est nommé', () => {
  const etat = '@media (max-width: 560px) { .party-dock.on { z-index: 60 } }'
  const avant = aplatir(ENTREE, image({ [ENTREE]: `.party-dock { z-index: 45; top: 10px }\n${etat}` }))
  const feuilles = { 'src/ui/styles/dock.css': etat, 'src/ui/styles/hud.css': '.stage > .party-dock { z-index: 45; top: 10px }' }
  const apres = aplatir(ENTREE, image({ [ENTREE]: "@import './styles/dock.css';\n@import './styles/hud.css';", ...feuilles }))
  assert.deepEqual(inversions(avant, apres), [])
  assert.deepEqual(bascules(avant, apres), [{
    avant: '|.party-dock|z-index|45',
    apres: '|.stage > .party-dock|z-index|45',
    contre: '@media (max-width: 560px)|.party-dock.on|z-index|60',
    gagnaitAvant: false,
    gagneApres: true,
  }])
})

test('bascules : un renommage qui garde le même verdict contre ses rivales ne rapporte rien', () => {
  const rivale = '.btn.small { font-size: 12px }'
  const avant = aplatir(ENTREE, image({ [ENTREE]: `${rivale}\n.btn.vc-btn { font-size: 20px }` }))
  const apres = aplatir(ENTREE, image({ [ENTREE]: `${rivale}\n.view-controls .vc-btn { font-size: 20px }` }))
  assert.deepEqual(bascules(avant, apres), [])
})
