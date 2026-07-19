// Test de la granularité SECTION (H2) de `coverage.mjs` (#454 défaut A/7) : `sectionsOf` (découpe
// pure du texte d'un chapitre en sections H2), `refSpansFor` (plages de ligne des refs `ABBR NN l.X`)
// et `annotateSections` (recoupement section↔refs) — les trois PURES, aucun accès disque. Lancé par
// `npm run test:raw`.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { sectionsOf, refSpansFor, annotateSections, SCENARIO_PUR } from './coverage.mjs'

test('sectionsOf : section H2 sans aucune réf recoupante → trou', () => {
  const text = [
    '# • TITRE DU CHAPITRE •',
    '',
    '## Première section',
    'du texte couvert.',
    '',
    '## Section vide',
    'du texte non cité.',
  ].join('\n')
  const sections = sectionsOf(text)
  const spans = refSpansFor('AA', '9', [{ file: 'x.md', text: 'AA 9 l.4 — couvre la première section.' }])
  const ann = annotateSections(sections, spans)
  const vide = ann.find((s) => s.title === 'Section vide')
  assert.equal(vide.refs, 0)
})

test('sectionsOf : section H2 recoupée par une réf → couverte, pas un trou', () => {
  const text = [
    '# • TITRE •',
    '',
    '## Section couverte',
    'du texte cité en l.4.',
  ].join('\n')
  const sections = sectionsOf(text)
  const spans = refSpansFor('AA', '9', [{ file: 'x.md', text: 'AA 9 l.4 — cite ce passage.' }])
  const ann = annotateSections(sections, spans)
  assert.equal(ann[0].refs, 1)
})

test('sectionsOf : titre H2 orné (•) qui N\'EST PAS le premier heading du fichier → chapitre enfoui', () => {
  const text = [
    '# • LE COMBAT MONTÉ •',
    '',
    '## **Le dressage**',
    'du texte.',
    '',
    '## LES INTÉRIMAIRES DE L\'AVENTURE • •',
    'du texte enfoui, rétrogradé de H1 à H2 par l\'extraction.',
  ].join('\n')
  const sections = sectionsOf(text)
  const dressage = sections.find((s) => s.title === 'Le dressage')
  const enfoui = sections.find((s) => s.title.includes('INTÉRIMAIRES'))
  assert.equal(dressage.enfoui, false)
  assert.equal(enfoui.enfoui, true)
})

test('sectionsOf : titre H2 orné qui EST le premier heading du fichier → faux positif écarté (c\'est le titre du chapitre lui-même)', () => {
  // Patron réel : ADE I 02/03/05/06/07/08, ADE II 01/03/04/08/09 — l'extraction rend le titre de
  // CHAPITRE en H2 orné en tête de fichier (au lieu d'un H1) ; ce n'est pas un chapitre enfoui.
  const text = [
    '*Pages PDF 23-33*',
    '',
    '## <span id="page-22-0" data-folio="22"></span>CLANS HALFLING DU REIKLAND • •',
    '',
    'du texte narratif.',
  ].join('\n')
  const sections = sectionsOf(text)
  const titre = sections.find((s) => s.title.includes('CLANS HALFLING'))
  assert.ok(titre)
  assert.equal(titre.enfoui, false)
})

test('sectionsOf : un chapitre enfoui suivi de N sections H2 ABSORBE ces sections jusqu\'au prochain enfoui ou EOF (#454 juge)', () => {
  // Patron réel `AA 09` : « LES INTÉRIMAIRES DE L'AVENTURE » (H2 enfoui, ex-H1) est suivi de 10 H2
  // normaux (COMBLER LES LACUNES, Embaucher des gros bras…) qui sont SES sous-sections, pas des
  // sœurs du chapitre hôte — sinon la plage se réduit à 4 lignes de titre au lieu des ~300 réelles.
  const text = [
    '# • LE COMBAT MONTÉ •',
    '',
    '## **Le dressage**',
    'contenu du dressage.',
    '',
    '## LES INTÉRIMAIRES DE L\'AVENTURE • •',
    'intro du chapitre enfoui.',
    '',
    '## **COMBLER LES LACUNES**',
    'sous-section absorbée 1.',
    '',
    '## **Embaucher des gros bras**',
    'sous-section absorbée 2.',
  ].join('\n')
  const sections = sectionsOf(text)
  // UNE SEULE section enfouie, pas 3 sections sœurs (le dressage + 2 sous-sections non absorbées).
  assert.equal(sections.filter((s) => !s.isIntro).length, 2)
  const dressage = sections.find((s) => s.title === 'Le dressage')
  const enfoui = sections.find((s) => s.title.includes('INTÉRIMAIRES'))
  assert.ok(!sections.some((s) => s.title === 'COMBLER LES LACUNES'))
  assert.ok(!sections.some((s) => s.title === 'Embaucher des gros bras'))
  assert.equal(dressage.hi, enfoui.lo) // le dressage s'arrête bien où commence l'enfoui
  assert.equal(enfoui.hi, text.split('\n').length + 1) // l'enfoui absorbe jusqu'à l'EOF
})

test('sectionsOf : un DEUXIÈME chapitre enfoui borne l\'absorption du premier (n\'avale pas tout le fichier)', () => {
  const text = [
    '# • TITRE •',
    '',
    '## PREMIER CHAPITRE ENFOUI • •',
    'contenu 1.',
    '',
    '## sous-section du premier',
    'contenu absorbé.',
    '',
    '## SECOND CHAPITRE ENFOUI • •',
    'contenu 2.',
  ].join('\n')
  const sections = sectionsOf(text)
  const enfouis = sections.filter((s) => s.enfoui)
  assert.equal(enfouis.length, 2)
  const premier = enfouis.find((s) => s.title.includes('PREMIER'))
  const second = enfouis.find((s) => s.title.includes('SECOND'))
  assert.equal(premier.hi, second.lo) // le premier s'arrête où commence le second, pas à l'EOF
  assert.ok(!sections.some((s) => s.title === 'sous-section du premier'))
})

test('annotateSections : un chapitre enfoui absorbant N sous-sections ne produit PAS N trous indépendants', () => {
  const text = [
    '# • TITRE •',
    '## CHAPITRE ENFOUI • •',
    'a',
    '## sous-section A',
    'b',
    '## sous-section B',
    'c',
  ].join('\n')
  const sections = sectionsOf(text)
  const ann = annotateSections(sections, [])
  assert.equal(ann.length, 1) // 1 entrée (l'enfoui), pas 3
  assert.equal(ann[0].enfoui, true)
})

test('refSpansFor : suffixe "+N+M" (points DISCRETS) ne fabrique PAS une bbox couvrant tout l\'intervalle', () => {
  // Régression du bug mesuré sur `AA 09 l.157+228` : span()-bbox couvrait à tort [157,228], recoupant
  // 4 sections intermédiaires qui ne contiennent NI l.157 NI l.228.
  const spans = refSpansFor('AA', '9', [{ file: 'x.md', text: 'AA 9 l.157+228 — deux points isolés, pas un intervalle continu.' }])
  assert.deepEqual(spans.map((s) => [s.lo, s.hi]).sort((a, b) => a[0] - b[0]), [[157, 157], [228, 228]])
  const sections = [
    { title: 'entre les deux points', lo: 160, hi: 200, enfoui: false, isIntro: false },
  ]
  const ann = annotateSections(sections, spans)
  assert.equal(ann[0].refs, 0)
})

test('refSpansFor : suffixe "-N" (intervalle continu) recoupe toute section chevauchant la plage', () => {
  const spans = refSpansFor('LDB', '6', [{ file: 'x.md', text: 'LDB 6 l.10-20 — plage continue.' }])
  assert.deepEqual(spans, [{ lo: 10, hi: 20, file: 'x.md' }])
  const sections = [{ title: 'chevauche le milieu', lo: 15, hi: 18, enfoui: false, isIntro: false }]
  const ann = annotateSections(sections, spans)
  assert.equal(ann[0].refs, 1)
})

test('annotateSections : la section "(intro)" (avant le premier H2) est TOUJOURS écartée du détail', () => {
  const sections = sectionsOf(['*Folio 6+*', '', '# • TITRE •', '', '## Seule section', 'texte.'].join('\n'))
  assert.ok(sections.some((s) => s.isIntro))
  const ann = annotateSections(sections, [])
  assert.ok(!ann.some((s) => s.isIntro))
})

test('SCENARIO_PUR (#454 juge tour 2, défaut 1) : ventile les campagnes PURES des compagnons MIXTES', () => {
  // Campagnes pures (EDO/MSR/PDT/AU1) : un chapitre ✅ n'y couvre jamais une règle propre, juste une
  // rencontre qui EN APPELLE une définie ailleurs — leurs trous de section sont du bruit de scénario.
  for (const ab of ['EDO', 'MSR', 'PDT', 'AU1']) assert.ok(SCENARIO_PUR.has(ab), `${ab} doit être SCENARIO_PUR`)
  // ACE (Annexe I de règles) et NADJ (jeux de taverne, cf. NADJ 16) restent des livres MIXTES : un
  // trou de section peut y cacher une vraie règle, jamais assimilables au bruit des campagnes pures.
  for (const ab of ['ACE', 'NADJ']) assert.ok(!SCENARIO_PUR.has(ab), `${ab} ne doit PAS être SCENARIO_PUR`)
  // Un livre de règles pur (jamais dans SCENARIO_BOOKS) n'est a fortiori pas SCENARIO_PUR.
  assert.ok(!SCENARIO_PUR.has('LDB'))
})
