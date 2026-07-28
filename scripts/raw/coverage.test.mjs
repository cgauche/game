// Test de la granularité SECTION adaptative de `coverage.mjs` (#454 défaut A/7, #604) : `sectionsOf`
// (découpe pure du texte d'un chapitre en sections, au niveau de heading `splitLevel`), `refSpansFor`
// (plages de ligne des refs `ABBR NN l.X`), `annotateSections` (recoupement section↔refs) et
// `classifyHole` (ventilation fiche/catalogue/scénario/hors-règle/trou, #604) — toutes PURES, aucun
// accès disque sauf les deux tests marqués « Disque RÉEL ». Lancé par `npm run test:raw`.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  sectionsOf, refSpansFor, annotateSections, classifyHole, SCENARIO_PUR, SECTION_LEVEL, sectionLevelOf,
} from './coverage.mjs'
import { chapterFile, readText } from './_lib.mjs'

// #604 (garde de classe) : le seam readText (_lib.mjs) normalise \r\n/\r -> \n AU POINT DE LECTURE --
// sectionsOf lui-meme reste nu (aucune tolerance interne). Repro root-cause : le '.' de regex exclut
// TOUT LineTerminator (dont \r, ECMA-262) donc le pattern de heading ancre en fin de ligne echoue net
// sur une ligne CRLF non normalisee, masquant les boundaries H2 (202 fichiers Source/**+docs/raw/**
// mutiles CRLF/mixte le 2026-07-07, contenu identique, index git reste LF). CRLF == LF une fois passe
// par readText, sur un texte porteur d'un enfoui (bullet) pour couvrir aussi ce chemin de decoupage.
test('sectionsOf (#604 garde de classe) : CRLF equivaut a LF une fois normalise par readText', () => {
  const lf = [
    '# BULLET TITRE DU CHAPITRE BULLET',
    '',
    '## Première section',
    'du texte couvert.',
    '',
    '## Section vide',
    'du texte non cité.',
  ].join('\n').replace(/BULLET/g, '•')
  const crlf = lf.replace(/\n/g, '\r\n')
  assert.deepEqual(sectionsOf(crlf.replace(/\r\n|\r/g, '\n'), 2), sectionsOf(lf, 2))
})

test('sectionsOf (#604 garde de classe) : preuve NEGATIVE du defaut -- sans normalisation, la boundary H2 disparait', () => {
    const raw = '# A\r\n## B\r\ntexte'
    assert.equal(sectionsOf(raw, 2).length, 1, 'non normalise : la boundary H2 est invisible (le bug)')
    assert.equal(sectionsOf(raw, 2)[0].title, '(intégral)')
    const normalized = raw.replace(/\r\n|\r/g, '\n')
    assert.equal(sectionsOf(normalized, 2).length, 2, 'normalise (readText) : intro + section B retrouvees')
  })
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

test('sectionsOf : titre H1 orné (•) NON-premier = chapitre voisin bavé par l\'extraction → enfoui, absorbe sa sous-section H2 (patron réel ADE II 04 → 05)', () => {
  // `04 - Un peu de magie.md` se termine par `# • LE GRAND HOSPICE •` (folio 68, titre du chapitre 05)
  // suivi de `## DES HAVRES DE REPOS` : Marker a fait baver l'ouverture du ch.05 en queue du ch.04.
  // Le H1 orné doit être une frontière `enfoui` (le mécanisme ne voyait que H2→splitLevel) sinon la
  // sous-section H2 narrative compte à tort comme un trou de règle du ch.04.
  const text = [
    '## UN PEU DE MAGIE • •',            // titre PROPRE du fichier (premier heading, H2 orné) — pas enfoui
    '',
    '## TABLEAU DES BAGUETTES',           // vraie section de règle du chapitre courant
    'du texte de règle.',
    '',
    '# • LE GRAND HOSPICE •',             // titre de CHAPITRE (H1 orné) bavé — chapitre VOISIN
    '',
    '## **DES HAVRES DE REPOS**',
    'prose narrative de l\'hospice, aucune règle.',
  ].join('\n')
  const sections = sectionsOf(text)
  const hospice = sections.find((s) => s.title.includes('GRAND HOSPICE'))
  const havres = sections.find((s) => s.title.includes('HAVRES'))
  assert.ok(hospice, 'le H1 orné bavé est bien devenu une frontière')
  assert.equal(hospice.enfoui, true, 'le chapitre voisin H1 orné est enfoui')
  assert.equal(havres, undefined, 'sa sous-section H2 est ABSORBÉE dans la plage enfouie, pas une section trouable')
  const baguettes = sections.find((s) => s.title === 'TABLEAU DES BAGUETTES')
  assert.equal(baguettes.enfoui, false, 'la vraie section de règle en amont reste une section ordinaire')
  assert.equal(baguettes.hi, hospice.lo, 'elle s\'arrête là où commence le chapitre bavé (n\'avale pas le titre voisin)')
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

test('refSpansFor (#606) : une ref FOLIO `ABBR NN p.X` credite le meme chapitre que `l.X`, sans throw', () => {
  // Disque REEL (LDB 10 = Talents, le cas fondateur du ticket) : la graphie p.<folio> (canonique #585)
  // resout une plage de lignes VIA folioRange -- jamais 0 span silencieux.
  const docs = [{ file: 'talents.md', text: 'LDB 10 p.132 — Table des Talents.' }]
  const stats = { ignoredFolios: 0 }
  const spans = refSpansFor('LDB', '10', docs, stats)
  assert.equal(spans.length, 1)
  assert.ok(spans[0].hi >= spans[0].lo && spans[0].lo > 0)
  assert.equal(stats.ignoredFolios, 0)
})

test('refSpansFor (#606) : un folio qui resout vers un AUTRE chapitre (frontiere) est IGNORE proprement, jamais credite au mauvais chapitre', () => {
  // Cas reel `LDB 49 p.255` (corruption.md) : le folio 255 vit en realite en LDB 48 (residu #454/#522).
  const docs = [{ file: 'corruption.md', text: 'Mauvais œil (LDB 49 p.255).' }]
  const stats = { ignoredFolios: 0 }
  const spans = refSpansFor('LDB', '49', docs, stats)
  assert.deepEqual(spans, [])
  assert.equal(stats.ignoredFolios, 1)
})

// --- #604 : granularité adaptative (SECTION_LEVEL) ---

test('sectionsOf(text, 3) : découpe sur H3, pas H2 — le LDB/MCLB ne ressortent plus vides', () => {
  const text = [
    '# • TITRE •',
    '',
    '### Première sous-section H3',
    'du texte couvert.',
    '',
    '### Deuxième sous-section H3',
    'du texte non cité.',
  ].join('\n')
  const sections = sectionsOf(text, 3)
  assert.equal(sections.filter((s) => !s.isIntro).length, 2)
  assert.ok(sections.some((s) => s.title === 'Deuxième sous-section H3'))
})

test('sectionsOf(text, 3) : sans override, splitLevel=2 par défaut → un texte purement H3 ne produit aucune section (comportement historique préservé pour les fixtures existantes)', () => {
  const text = ['# TITRE', '', '### Sous-section H3', 'texte.'].join('\n')
  const sections = sectionsOf(text) // splitLevel implicite = 2
  assert.equal(sections.filter((s) => !s.isIntro).length, 0)
  assert.equal(sections[0].title, '(intégral)') // capitule seulement si l'appelant n'a pas fourni le bon niveau
})

test('sectionsOf(text, 3) : CASCADE — les headings H2 restent aussi des boundaries quand splitLevel=3 (patron NADJ 16 : jeux H2 et H3 entrelacés)', () => {
  const text = [
    '# • JEUX DE TAVERNE •',
    '',
    '### LE BRAS DE FER',
    'jeu 1 (H3).',
    '',
    '## LA BÊTE PARMI LES TAILLEURS',
    'jeu 2 (H2, sœur malgré le niveau différent).',
    '',
    '### MIDDENBALL',
    'jeu 3 (H3), ne doit pas être absorbé dans LA BÊTE.',
  ].join('\n')
  const sections = sectionsOf(text, 3)
  const titles = sections.filter((s) => !s.isIntro).map((s) => s.title)
  assert.deepEqual(titles, ['LE BRAS DE FER', 'LA BÊTE PARMI LES TAILLEURS', 'MIDDENBALL'])
})

test('SECTION_LEVEL/sectionLevelOf (#604) : granularité par livre — H3-dominant, H4 à part, H2 par défaut', () => {
  for (const ab of ['LDB', 'MCLB', 'ACE', 'EDOC', 'MSRC', 'MSR', 'PDT', 'NADJ', 'MDG', 'ZI']) {
    assert.equal(sectionLevelOf(ab), 3, `${ab} doit découper au H3`)
  }
  assert.equal(sectionLevelOf('AU1'), 4, 'AU1 (H4-dominant) découpe au H4')
  for (const ab of ['AA', 'ADE I', 'ADE II', 'EDO']) {
    assert.equal(sectionLevelOf(ab), 2, `${ab} reste au H2 (défaut, structuration réelle en H2)`)
  }
  assert.ok(!SECTION_LEVEL.has('AA'), 'AA absent de la table = défaut 2, jamais un 2 explicite redondant')
})

test('classifyHole (#604) : ventilation ferme, JAMAIS un masquage silencieux', () => {
  assert.equal(classifyHole(3, {}), 'fiche') // recoupée par une réf de fiche → traitée
  assert.equal(classifyHole(0, { horsRegle: true, cat: true, isPur: true }), 'hors-regle') // priorité au périmètre explicite
  assert.equal(classifyHole(0, { cat: true, isPur: true }), 'catalogue') // transcrite, pas hors-règle → catalogue prime sur scénario
  assert.equal(classifyHole(0, { isPur: true }), 'scenario')
  assert.equal(classifyHole(0, {}), 'trou') // aucune exemption : candidat trou de règle
})

test('classifyHole (#604) : un chapitre catalogué mais crédité par une réf de fiche à CETTE section précise reste `fiche`, jamais `catalogue`', () => {
  assert.equal(classifyHole(1, { cat: true }), 'fiche')
})

// --- Disque RÉEL : les 3 recettes du DoD #604 ---

test('#604 recette : NADJ 16 « MIDDENBALL » (H3 l.113) ressort nommément comme sa PROPRE section, plus absorbé par LE TORCHON TREMPÉ (H2)', () => {
  const info = chapterFile('NADJ', '16')
  const text = readText(info.path)
  const sections = sectionsOf(text, sectionLevelOf('NADJ'))
  const middenball = sections.find((s) => s.title === 'MIDDENBALL')
  assert.ok(middenball, 'MIDDENBALL doit apparaître comme sa propre section (H3, plus jamais absorbé par un H2 voisin)')
  assert.equal(middenball.lo, 113)
  const torchon = sections.find((s) => s.title === 'LE TORCHON TREMPÉ')
  assert.ok(torchon)
  assert.ok(torchon.hi <= middenball.lo, 'LE TORCHON TREMPÉ (H2) ne doit plus engloutir MIDDENBALL (H3) dans sa plage')
})

test('#604 recette : MCLB (0 section en H2) obtient de VRAIES sections en H3 adaptatif', () => {
  const info = chapterFile('MCLB', '2') // Guide du visiteur — 0 H2, 255 H3 (mesuré)
  const text = readText(info.path)
  const h2Sections = sectionsOf(text, 2).filter((s) => !s.isIntro)
  const h3Sections = sectionsOf(text, sectionLevelOf('MCLB')).filter((s) => !s.isIntro)
  assert.equal(h2Sections.length, 0, 'confirme l\'angle mort H2 mesuré (#604)')
  assert.ok(h3Sections.length > 0, 'la granularité adaptative doit produire de vraies sections MCLB')
})

test('#604 recette (régression #453) : AA 09 « LES INTÉRIMAIRES DE L\'AVENTURE » reste un chapitre enfoui l.191-502 (AA reste H2, non affecté par la granularité adaptative)', () => {
  const info = chapterFile('AA', '9')
  const text = readText(info.path)
  const sections = sectionsOf(text, sectionLevelOf('AA'))
  const enfoui = sections.find((s) => s.title.includes('INTÉRIMAIRES'))
  assert.ok(enfoui, 'le chapitre enfoui doit toujours être détecté')
  assert.equal(enfoui.enfoui, true)
  assert.equal(enfoui.lo, 191)
  assert.equal(enfoui.hi - 1, 502)
})

// --- #604 défaut adversarial (juge) : intégration render/compte, pas seulement `classifyHole` en PUR ---
// Le défaut initial vivait dans le MAILLON entre `classifyHole` (déjà correct) et son consommateur
// (`HOLE_MARK`/`HOLE_LABEL` sans clé `'hors-regle'`, boucle de comptage sans branche `'hors-regle'`) —
// invisible des 22 tests PURS ci-dessus, qui n'exercent jamais ce maillon de rendu/comptage. Preuve par
// un run RÉEL du script complet (`main()`, via sous-processus — le seul moyen d'exercer main() qui n'est
// PAS exporté) sur `docs/raw/coverage.md` généré.
test('#604 intégration (régression juge adversarial) : coverage.md régénéré ne contient AUCUNE ligne `undefined` (chapitre ✅/📖 par ailleurs HORS_REGLE, ex. AA 02/EDOC 13/MDG 03)', async () => {
  const { execFileSync } = await import('node:child_process')
  execFileSync(process.execPath, ['scripts/raw/coverage.mjs'], { cwd: process.cwd(), stdio: 'pipe' })
  const md = readText('docs/raw/coverage.md')
  const undefinedLines = md.split('\n').filter((l) => l.includes('undefined'))
  assert.deepEqual(undefinedLines, [], `aucune ligne « undefined » ne doit apparaître (poison de rendu, #604 juge) — trouvé :\n${undefinedLines.join('\n')}`)
})

test('#604 intégration : une section 0-réf d\'un chapitre ✅/📖 HORS_REGLE (ex. AA 02 « INTRODUCTION », front-matter) rend `➖` (mark hors-regle), jamais un fallback undefined', () => {
  const md = readText('docs/raw/coverage.md')
  const block = md.slice(md.indexOf('- **AA 02**'), md.indexOf('- **AA 02**') + 400)
  assert.ok(block.includes('➖ l.'), 'AA 02 doit porter au moins une section ➖ hors-règle détaillée')
  assert.ok(!block.includes('undefined'))
})

test('#604 intégration : le total ventilé (catalogue + hors-règle + scénario + trou) de la ligne de résumé est COHÉRENT avec la somme annoncée, jamais un total qui dérive du détail', () => {
  const md = readText('docs/raw/coverage.md')
  const summary = md.split('\n').find((l) => l.startsWith('**Couverture'))
  assert.ok(summary)
  const totalM = /sur (\d+) section\(s\) non couvertes par une fiche/.exec(summary)
  const catM = /(\d+) transcrite\(s\) en catalogue/.exec(summary)
  const horsM = /(\d+) hors-règle/.exec(summary)
  const scenM = /(\d+) bruit de scénario/.exec(summary)
  const trouM = /(\d+) candidat\(s\) trou de règle/.exec(summary)
  assert.ok(totalM && catM && horsM && scenM && trouM)
  const sum = Number(catM[1]) + Number(horsM[1]) + Number(scenM[1]) + Number(trouM[1])
  assert.equal(sum, Number(totalM[1]), 'la somme des 4 buckets doit reconstituer EXACTEMENT le total annoncé')
})
