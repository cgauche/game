// Test du générateur `build-implemente` (node --test) : fixtures en chaînes, aucune dépendance aux
// fiches réelles. Re-verrouille les comportements hérités de check-implemente (graphies du libellé,
// tableau de bilan jamais scanné, exclusion de l'art de rig) + les nouveaux (#487). Lancé par `npm run test:raw`.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { ldbRe, otherRe, buildFolioMap, folioRangeIn, otherAbbrAlternation } from './_lib.mjs'
import {
  slugify, refsWithSpans, declNameOf, symbolFor, refMatches, mergeSpans,
  parseFiche, renderBlock, regenerateFiche, validateManifest, isExcludedSrc, indexCode, isDeadExport,
  GUARD_LEAK_RE, GEN_TAG, NOT_IMPL,
  buildAbbrMap, folioCitationsFromJson, findManifestOrphans, computeAll, computeFolioWinners,
} from './build-implemente.mjs'
import { closureOf } from '../guards/lib/importGraph.mjs'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const COMMENT_OR_BLANK = /^\s*(?:\/\/|\/\*|\*|$)/

// --- fabrique d'index depuis des fichiers en mémoire (miroir de indexCode) ---
function makeIndex(files) {
  const impl = [], tests = []
  const fileLines = new Map(), nonCommentText = new Map()
  for (const { rel, content, isTest } of files) {
    const lines = content.split('\n')
    const isTs = /\.tsx?$/.test(rel)
    if (isTs) fileLines.set(rel, lines)
    if (!isTest) nonCommentText.set(rel, lines.filter((ln) => !COMMENT_OR_BLANK.test(ln)).join('\n'))
    lines.forEach((ln, i) => {
      for (const r of refsWithSpans(ln)) (isTest ? tests : impl).push({ ...r, file: rel, row: i + 1, isTs })
    })
  }
  return { impl, tests, fileLines, nonCommentText }
}
const ctxOf = (index, { closure = new Set(), manifest = new Map() } = {}) => ({ index, closure, manifestByTopic: manifest })

test('slugify : accents pliés, non-alphanumériques → tirets comprimés/rognés', () => {
  assert.equal(slugify('Forcer le rythme et épuisement (MDG)'), 'forcer-le-rythme-et-epuisement-mdg')
  assert.equal(slugify('  Seconde Vue  '), 'seconde-vue')
  assert.equal(slugify('État À Terre'), 'etat-a-terre')
})

test('parseFiche : graphies du libellé (Implemente/Implémenté/ponctuation) reconnues en début de ligne', () => {
  for (const label of ['**Implémente :**', '**Implemente**', '**Implémenté** :', '**Implémente.**']) {
    const { fields } = parseFiche('a.md', `## Sujet\n\n${label} x\n`)
    assert.equal(fields.length, 1, label)
    assert.equal(fields[0].topic, 'a#sujet')
  }
})

test('parseFiche : occurrence NON en début de ligne → anomalie, PAS un champ', () => {
  const { fields, anomalies } = parseFiche('a.md', '## Sujet\n\nvoir **Implémente :** plus bas.\n')
  assert.equal(fields.length, 0)
  assert.equal(anomalies.length, 1)
  assert.equal(anomalies[0].row, 3)
})

test('parseFiche : blockquote citant **Implémente** (bannière d\'en-tête) → jamais une anomalie', () => {
  const doc = '> ⚠️ Les champs **Implémente** sont GÉNÉRÉS — ne pas éditer.\n> entre règles ; **Implémente** pointe le module.\n\n## Sujet\n\n**Implémente :** x\n'
  const { fields, anomalies } = parseFiche('a.md', doc)
  assert.equal(anomalies.length, 0)
  assert.equal(fields.length, 1)
})

test('parseFiche : tableau de BILAN (`## Implémente` + `| … |`) jamais scanné comme un champ', () => {
  const { fields } = parseFiche('x.md', '## Implémente\n\n| Mécanique | Module | État |\n|---|---|---|\n| X | — | Non implémenté |\n')
  assert.equal(fields.length, 0)
})

test('parseFiche : frontière de bloc = ligne vide OU heading OU fin de fichier', () => {
  const blank = parseFiche('a.md', '## S\n\n**Implémente :** h\n- a\n- b\n\napres\n').fields[0]
  assert.equal(blank.headerIdx, 2)
  assert.equal(blank.endIdx, 5) // header(2)+a(3)+b(4), stop à la ligne vide (5)
  const heading = parseFiche('a.md', '## S\n\n**Implémente :** h\n- a\n## Suite\n').fields[0]
  assert.equal(heading.endIdx, 4) // stop au heading
  const eof = parseFiche('a.md', '## S\n\n**Implémente :** h\n- a').fields[0]
  assert.equal(eof.endIdx, 4)
})

test('parseFiche : slug dupliqué dans le même fichier → suffixe -2, -3', () => {
  const { fields } = parseFiche('a.md', '## S\n\n**Implémente :** x\n\n## S\n\n**Implémente :** y\n\n## S\n\n**Implémente :** z\n')
  assert.deepEqual(fields.map((f) => f.topic), ['a#s', 'a#s-2', 'a#s-3'])
})

test('parseFiche : réfs collectées par segment, blocs de champ EXCLUS (pas de circularité)', () => {
  const doc = [
    '## H2',
    '',
    '### A',
    'texte `LDB 6 l.10`',
    '**Implémente :** ancien `src/z.ts` cite `LDB 99 l.1`',
    '',
    '### B',
    'texte `LDB 7 l.20`',
    '**Implémente :** ancien',
    '',
  ].join('\n')
  const { fields } = parseFiche('a.md', doc)
  assert.equal(fields.length, 2)
  // champ A : voit LDB 6 (pas LDB 99, qui est DANS un bloc de champ)
  assert.deepEqual(fields[0].refs.map((r) => `${r.book} ${r.ch}`), ['LDB 6'])
  // champ B : voit LDB 7 seulement (segment après le bloc de A, dans le même H2)
  assert.deepEqual(fields[1].refs.map((r) => `${r.book} ${r.ch}`), ['LDB 7'])
})

test('parseFiche : réf portée par la LIGNE DE HEADING → rattachée au topic que ce heading ouvre', () => {
  const doc = [
    '## Maladies',
    '',
    '### Racine des Tombes (`MSRC 04 l.204-229`)',
    '',
    '**Implémente :** ancien',       // topic racine → doit voir MSRC 04
    '',
    '### Rouille Mouchetée (`MSRC 04 l.241-252`)',
    '',
    '**Implémente :** ancien',       // topic rouille → MSRC 04 l.241-252, PAS l.204-229
    '',
  ].join('\n')
  const { fields } = parseFiche('m.md', doc)
  assert.equal(fields.length, 2)
  assert.deepEqual(fields[0].refs.map((r) => `${r.book} ${r.ch} l.${r.lo}-${r.hi}`), ['MSRC 4 l.204-229'])
  // le heading du topic SUIVANT ne contamine pas le précédent (son champ a déjà vidé pending)
  assert.deepEqual(fields[1].refs.map((r) => `${r.book} ${r.ch} l.${r.lo}-${r.hi}`), ['MSRC 4 l.241-252'])
})

test('refsWithSpans : LDB + autre livre avec suffixe de plage déplié', () => {
  assert.deepEqual(refsWithSpans('`LDB 13 l.21-38`'), [{ book: 'LDB', ch: 13, lo: 21, hi: 38 }])
  assert.deepEqual(refsWithSpans('`MDG 13 l.68-75`'), [{ book: 'MDG', ch: 13, lo: 68, hi: 75 }])
  assert.deepEqual(refsWithSpans('`AA l.4395` sans chapitre'), []) // pas de chapitre → skip
})

test('refMatches : fenêtre ±10 (dedans / dehors / chevauchement partiel)', () => {
  const ref = { book: 'LDB', ch: 13, lo: 21, hi: 38 }
  assert.equal(refMatches(ref, { book: 'LDB', ch: 13, lo: 30, hi: 30 }), true)  // dedans
  assert.equal(refMatches(ref, { book: 'LDB', ch: 13, lo: 48, hi: 48 }), true)  // 48 == 38+10
  assert.equal(refMatches(ref, { book: 'LDB', ch: 13, lo: 49, hi: 49 }), false) // 49 > 38+10
  assert.equal(refMatches(ref, { book: 'LDB', ch: 13, lo: 11, hi: 11 }), true)  // 11 == 21-10
  assert.equal(refMatches(ref, { book: 'LDB', ch: 13, lo: 10, hi: 10 }), false) // 10 < 21-10
  assert.equal(refMatches(ref, { book: 'LDB', ch: 13, lo: 5, hi: 15 }), true)   // chevauchement partiel
  assert.equal(refMatches(ref, { book: 'LDB', ch: 14, lo: 30, hi: 30 }), false) // autre chapitre
  assert.equal(refMatches(ref, { book: 'MDG', ch: 13, lo: 30, hi: 30 }), false) // autre livre
})

test('mergeSpans : chevauchement fusionné, adjacence conservée', () => {
  assert.deepEqual(mergeSpans([[1, 5], [5, 8]]), [[1, 8]]) // se chevauchent
  assert.deepEqual(mergeSpans([[1, 5], [6, 8]]), [[1, 5], [6, 8]]) // adjacents, séparés
})

test('symbolFor : déclaration englobante', () => {
  const lines = ['export function foo() {', '  // LDB 6 l.1', '}'].join('\n').split('\n')
  assert.equal(symbolFor(lines, 2), 'foo')
})

test('symbolFor : JSDoc d\'en-tête → déclaration SUIVANTE', () => {
  const lines = ['/**', ' * doc (LDB 13 l.30)', ' */', 'export function initiativeOrder() {}'].join('\n').split('\n')
  assert.equal(symbolFor(lines, 2), 'initiativeOrder')
})

test('symbolFor : en-tête de fichier (aucune déclaration englobante) → null (fichier seul)', () => {
  const lines = ['// en-tête de fichier (LDB 6 l.1)', "import { z } from './z'", 'const x = 1'].join('\n').split('\n')
  assert.equal(symbolFor(lines, 1), null)
})

test('declNameOf : reconnaît function/const/class/type', () => {
  assert.equal(declNameOf('export const foo = 1'), 'foo')
  assert.equal(declNameOf('export default async function bar() {}'), 'bar')
  assert.equal(declNameOf('  const notTopLevel = 1'), null)
})

test('isExcludedSrc : art de rig (tenues/defs) exclu', () => {
  assert.equal(isExcludedSrc('src/gameIso/rig/parts/tenues/defs/Loup.ts'), true)
  assert.equal(isExcludedSrc('src/engine/combat.ts'), false)
})

test('indexCode : fichiers .test./.spec. → index SÉPARÉ (jamais implémentation)', () => {
  const root = mkdtempSync(join(tmpdir(), 'bi-idx-'))
  mkdirSync(join(root, 'engine'), { recursive: true })
  writeFileSync(join(root, 'engine', 'a.ts'), '// LDB 6 l.1\nexport const a = 1\n')
  writeFileSync(join(root, 'engine', 'a.test.ts'), '// LDB 6 l.2\n')
  try {
    const idx = indexCode(root)
    assert.equal(idx.impl.length, 1)
    assert.equal(idx.tests.length, 1)
    assert.equal(idx.impl[0].isTs, true)
  } finally { rmSync(root, { recursive: true, force: true }) }
})

// --- rendu ---
const FICHE_IMPL = ['## Initiative', '', '**Sources RAW :** `LDB 13 l.21-38`, `LDB 13 l.47`, `LDB 14 l.5`', '', '**Implémente :** ancien texte à écraser', ''].join('\n')

function implCtx() {
  const index = makeIndex([
    { rel: 'src/engine/combat.ts', content: ['/**', ' * ordre (LDB 13 l.30)', ' */', 'export function initiativeOrder() {}', 'export function rollInitiative() {} // LDB 13 l.47'].join('\n') },
    { rel: 'src/state/combatSetup.ts', content: ["import { initiativeOrder, rollInitiative } from './combat'", '// setup (LDB 13 l.25)', 'export function setup() { initiativeOrder(); rollInitiative() }'].join('\n') },
  ])
  return ctxOf(index, { closure: new Set(['src/engine/combat.ts', 'src/state/combatSetup.ts']) })
}

test('renderBlock : topic implémenté → puce par livre+chapitre, symboles avant fichiers, sans-code des réfs non matchées', () => {
  const field = parseFiche('a.md', FICHE_IMPL).fields[0]
  const block = renderBlock(field, implCtx())
  assert.ok(block[0].includes(GEN_TAG))
  const combat = block.find((l) => l.startsWith('- `LDB 13`'))
  assert.match(combat, /\(l\.21-38, l\.47\)/)
  assert.match(combat, /`initiativeOrder`/)
  assert.match(combat, /`rollInitiative`/)
  assert.match(combat, /`src\/engine\/combat\.ts`/)
  assert.ok(combat.indexOf('→') < combat.indexOf('—')) // symboles avant fichiers
  // LDB 14 l.5 n'a aucun code → sans-code
  const sans = block.find((l) => l.startsWith('- sans code :'))
  assert.match(sans, /`LDB 14` \(l\.5\)/)
})

test('renderBlock : symbole sans appelant → ⚠sans-appelant ; fichier hors closure → ⚠hors-app', () => {
  const index = makeIndex([
    { rel: 'src/engine/orphan.ts', content: ['// LDB 20 l.3', 'export function loneSym() {}'].join('\n') },
  ])
  const ctx = ctxOf(index, { closure: new Set() }) // aucune fiche in-app
  const field = parseFiche('a.md', '## S\n\n**Sources RAW :** `LDB 20 l.3`\n\n**Implémente :** x\n').fields[0]
  const block = renderBlock(field, ctx)
  const b = block.find((l) => l.startsWith('- `LDB 20`'))
  assert.match(b, /`loneSym` ⚠sans-appelant/)
  assert.match(b, /`src\/engine\/orphan\.ts` ⚠hors-app/)
})

test('isDeadExport : symbole NON exporté (usage local) → jamais flagué', () => {
  const index = makeIndex([
    { rel: 'src/engine/f.ts', content: ['function localSym() {}', 'localSym()'].join('\n') },
  ])
  assert.equal(isDeadExport('localSym', 'src/engine/f.ts', index), false)
})

test('isDeadExport : exporté MAIS appelé localement (hors commentaire, hors déclaration) → pas mort', () => {
  const index = makeIndex([
    { rel: 'src/state/v.ts', content: ['export function effectiveSeaM() {}', '// note : effectiveSeaM ancienne', 'const x = effectiveSeaM()'].join('\n') },
  ])
  assert.equal(isDeadExport('effectiveSeaM', 'src/state/v.ts', index), false)
})

test('isDeadExport : exporté avec appelant dans un AUTRE fichier (hors commentaire) → pas mort (cas capriciousMod)', () => {
  const index = makeIndex([
    { rel: 'src/engine/social.ts', content: ['export function capriciousMod() {}'].join('\n') },
    { rel: 'src/state/combatEffects.ts', content: ['import { capriciousMod } from "../engine/social"', 'const m = capriciousMod()'].join('\n') },
  ])
  assert.equal(isDeadExport('capriciousMod', 'src/engine/social.ts', index), false)
})

test('isDeadExport : appelant UNIQUEMENT en commentaire → toujours mort (le commentaire ne compte pas)', () => {
  const index = makeIndex([
    { rel: 'src/engine/orphan.ts', content: ['export function ghost() {}'].join('\n') },
    { rel: 'src/state/other.ts', content: ['// TODO: brancher ghost() un jour', 'export const y = 1'].join('\n') },
  ])
  assert.equal(isDeadExport('ghost', 'src/engine/orphan.ts', index), true)
})

test('closureOf : suit les imports DYNAMIQUES import(\'…\') (lazy) — #487 correctif', () => {
  const root = mkdtempSync(join(tmpdir(), 'bi-clo-'))
  mkdirSync(join(root, 'src', 'ui'), { recursive: true })
  writeFileSync(join(root, 'src', 'main.tsx'), "const App = lazy(() => import('./ui/CampaignView'))\n")
  writeFileSync(join(root, 'src', 'ui', 'CampaignView.tsx'), "import { WorldMapView } from './WorldMapView'\nexport const CampaignView = 1\n")
  writeFileSync(join(root, 'src', 'ui', 'WorldMapView.tsx'), 'export const WorldMapView = 1\n')
  try {
    const clo = closureOf([join(root, 'src', 'main.tsx')])
    const rels = [...clo].map((p) => p.split('/').slice(-1)[0])
    assert.ok(rels.includes('CampaignView.tsx'), 'import dynamique suivi')
    assert.ok(rels.includes('WorldMapView.tsx'), 'chaîne transitive via l\'import dynamique')
  } finally { rmSync(root, { recursive: true, force: true }) }
})

test('renderBlock : topic sans match non-test → (non implémenté) + cité par tests seulement + manifest', () => {
  const index = makeIndex([
    { rel: 'src/engine/x.test.ts', content: '// LDB 30 l.5\n', isTest: true },
  ])
  const manifest = new Map([['a#s', { topic: 'a#s', ticket: '#463' }]])
  const ctx = ctxOf(index, { manifest })
  const field = parseFiche('a.md', '## S\n\n**Sources RAW :** `LDB 30 l.5`\n\n**Implémente :** x\n').fields[0]
  const block = renderBlock(field, ctx)
  assert.equal(block[0], `**Implémente :** ${NOT_IMPL}`)
  assert.ok(block.some((l) => l.startsWith('- cité par tests seulement : `src/engine/x.test.ts`')))
  assert.ok(block.includes('- dette : #463'))
})

test('renderBlock : marqueur (non implémenté) est la SEULE graphie du non-implémenté', () => {
  const field = parseFiche('a.md', '## S\n\n**Sources RAW :** `LDB 30 l.5`\n\n**Implémente :** non-implémenté ancien\n').fields[0]
  const block = renderBlock(field, ctxOf(makeIndex([])))
  assert.equal(block[0], `**Implémente :** ${NOT_IMPL}`)
})

test('rendu déterministe : deux appels renvoient les mêmes octets', () => {
  const field = parseFiche('a.md', FICHE_IMPL).fields[0]
  const ctx = implCtx()
  assert.deepEqual(renderBlock(field, ctx), renderBlock(field, ctx))
})

test('GUARD_LEAK_RE DÉRIVE de otherAbbrAlternation (_lib.mjs), pas un duplicata (#434 défaut 10)', () => {
  assert.equal(GUARD_LEAK_RE.source, `\\b(?:LDB|${otherAbbrAlternation()}) ?\\d* l\\.`)
})

test('invisibilité des gardes : aucune ligne générée ne matche ldbRe/otherRe/GUARD_LEAK_RE', () => {
  const field = parseFiche('a.md', FICHE_IMPL).fields[0]
  const block = renderBlock(field, implCtx())
  for (const line of block) {
    assert.equal([...line.matchAll(ldbRe())].length, 0, `ldbRe: ${line}`)
    assert.equal([...line.matchAll(otherRe())].length, 0, `otherRe: ${line}`)
    assert.equal(GUARD_LEAK_RE.test(line), false, `GUARD_LEAK_RE: ${line}`)
  }
})

test('regenerateFiche : SEUL le bloc du champ change, le reste octet pour octet identique', () => {
  const before = FICHE_IMPL + '\n---\n\n## Suite\n\ncontenu.\n'
  const after = regenerateFiche('a.md', before, implCtx())
  assert.ok(after.includes('## Initiative'))
  assert.ok(after.includes('## Suite\n\ncontenu.\n'))
  assert.ok(after.includes(GEN_TAG))
  assert.ok(!after.includes('ancien texte à écraser'))
})

test('validateManifest : id inconnu / doublon / entrée sans ticket ni bloque → fail-fast', () => {
  const known = new Set(['a#s'])
  assert.throws(() => validateManifest([{ id: 'a#inconnu', ticket: '#1' }], known), /id inconnu des fiches/)
  assert.throws(() => validateManifest([{ id: 'a#s', ticket: '#1' }, { id: 'a#s', ticket: '#2' }], known), /dupliqué/)
  assert.throws(() => validateManifest([{ id: 'a#s' }], known), /sans ticket ni bloque/)
  assert.throws(() => validateManifest([{ ticket: '#1' }], known), /entrée manifest sans id/)
  assert.doesNotThrow(() => validateManifest([{ id: 'a#s', bloque: 'attente RAW' }], known))
})

// --- Pont FOLIO (#434) ---

test('buildAbbrMap : abbr → slug ; abbr inconnue de BOOKS → fail-fast ; entrée sans dir → hors map (VO)', () => {
  assert.throws(() => buildAbbrMap([{ id: 'x', abbr: 'ZZZ', dir: 'Source/x' }]), /abbr inconnue de BOOKS/)
  const { abbrOf, knownIds } = buildAbbrMap([
    { id: 'aux-armes', abbr: 'AA', dir: 'Source/WH - V4 - Aux Armes' },
    { id: 'mort-sur-le-reik-compagnon', abbr: 'MSRC', dir: 'Source/Warhammer v4 - 2.0 Mort sur le Reik Compagnon' },
    { id: 'lustria', abbr: 'Lustria' }, // VO hors Atlas — a désormais un abbr mais aucun dir (#585)
  ])
  assert.equal(abbrOf.get('aux-armes'), 'AA')
  assert.equal(abbrOf.get('mort-sur-le-reik-compagnon'), 'MSRC')
  assert.equal(abbrOf.has('lustria'), false)
  assert.deepEqual([...knownIds].sort(), ['aux-armes', 'lustria', 'mort-sur-le-reik-compagnon'])
})

test('buildFolioMap + folioRangeIn : plage jusqu\'à l\'ancre suivante / EOF / introuvable / ambigu', () => {
  const chapters = [
    { ch: 9, lines: ['a', '<span data-folio="108"></span>', 'b', '<span data-folio="109"></span>', 'c', 'd'] },
    { ch: 12, lines: ['e', '<span data-folio="200"></span>', 'f'] },
    { ch: 13, lines: ['g', '<span data-folio="200"></span>', 'h'] }, // 200 aussi ici → ambigu
  ]
  const map = buildFolioMap(chapters)
  assert.deepEqual(folioRangeIn(map, 108), { ch: 9, lo: 2, hi: 4 })   // jusqu'à l'ancre suivante (ligne 4)
  assert.deepEqual(folioRangeIn(map, 109), { ch: 9, lo: 4, hi: 6 })   // dernière ancre → EOF (6 lignes)
  assert.equal(folioRangeIn(map, 999), null)                          // introuvable
  assert.equal(folioRangeIn(map, 200), 'ambiguous')                   // deux chapitres
})

const AA_MAP = { abbrOf: new Map([['aux-armes', 'AA']]), knownIds: new Set(['aux-armes']) }
const freshStats = () => ({ byBook: new Map(), noAtlas: 0, noPage: 0 })

test('folioCitationsFromJson : slug inconnu de books.json → fail-fast', () => {
  assert.throws(
    () => folioCitationsFromJson('src/data/x.json', '[{ "id": "a", "source": { "book": "inconnu", "page": 1 } }]\n',
      { ...AA_MAP, stats: freshStats() }),
    /inconnu de books\.json/,
  )
})

test('folioCitationsFromJson : slug hors Atlas / folio introuvable → 0 match (jamais inventé), compté', () => {
  const s1 = freshStats()
  assert.equal(folioCitationsFromJson('src/data/x.json',
    '[{ "id": "a", "source": { "book": "lustria", "page": 1 } }]\n',
    { abbrOf: new Map(), knownIds: new Set(['lustria']), stats: s1 }).length, 0)
  assert.equal(s1.noAtlas, 1) // connu mais sans abbr → hors Atlas
  const s2 = freshStats()
  assert.equal(folioCitationsFromJson('src/data/x.json',
    '[{ "id": "a", "source": { "book": "aux-armes", "page": 999999 } }]\n',
    { ...AA_MAP, stats: s2 }).length, 0)
  assert.equal(s2.byBook.get('AA').notFound, 1)
})

test('folioCitationsFromJson : id le plus proche AU-DESSUS (nested) devient le symbole', () => {
  // Résolution réelle : AA folio 109 existe (Source/WH - V4 - Aux Armes/09 - LE COMBAT MONTÉ.md → ch 9).
  const content = [
    '[',
    '  { "id": "entree",',
    '    "levels": [ { "id": "niveau-2" } ],',
    '    "source": { "book": "aux-armes", "page": 109 } }',
    ']',
  ].join('\n')
  const out = folioCitationsFromJson('src/data/creatures.json', content, { ...AA_MAP, stats: freshStats() })
  assert.equal(out.length, 1)
  assert.equal(out[0].book, 'AA')
  assert.equal(out[0].ch, 9)
  assert.equal(out[0].isTs, false)
  assert.equal(out[0].sym, 'niveau-2') // id le plus proche au-dessus de "source", pas "entree"
})

test('computeFolioWinners : deux topics sur la même plage → meilleur recouvrement seul ; égalité → les deux', () => {
  // Deux citations folio de MÊME plage LDB 23 l.100-140 ; trois topics candidats.
  const cA = { book: 'LDB', ch: 23, lo: 100, hi: 140, folio: true, sym: 'a', file: 'src/data/x.json', row: 1, isTs: false }
  const index = { impl: [cA], tests: [], fileLines: new Map(), nonCommentText: new Map() }
  const mkFiche = (defs) => ({ parsed: { fields: defs.map(([topic, refs]) => ({ topic, refs })) } })
  const fiches = [mkFiche([
    ['big', [{ book: 'LDB', ch: 23, lo: 110, hi: 135 }]],  // recouvre 26 l. → gagne
    ['small', [{ book: 'LDB', ch: 23, lo: 130, hi: 133 }]], // recouvre 4 l. → perd
  ])]
  const w = computeFolioWinners(fiches, index, 10)
  assert.deepEqual([...w.get(cA)], ['big'])
  // égalité : deux topics au même recouvrement → les deux gardent
  const fiches2 = [mkFiche([
    ['t1', [{ book: 'LDB', ch: 23, lo: 110, hi: 120 }]], // 11 l.
    ['t2', [{ book: 'LDB', ch: 23, lo: 125, hi: 135 }]], // 11 l.
  ])]
  const w2 = computeFolioWinners(fiches2, index, 10)
  assert.deepEqual([...w2.get(cA)].sort(), ['t1', 't2'])
})

// --- Garde manifest (Sens B, #434) ---

test('findManifestOrphans : non-impl sans entrée → orphelin ; non-impl AVEC entrée → OK ; impl sans entrée → OK', () => {
  const index = makeIndex([
    { rel: 'src/engine/f.ts', content: ['// LDB 6 l.10', 'export const foo = 1'].join('\n') },
  ])
  const content = [
    '## Impl Topic', '', '**Sources RAW :** `LDB 6 l.10`', '', '**Implémente :** x', '',
    '## Non Tickete', '', '**Sources RAW :** `LDB 99 l.500`', '', '**Implémente :** x', '',
    '## Orphelin', '', '**Sources RAW :** `LDB 88 l.400`', '', '**Implémente :** x', '',
  ].join('\n')
  const fiches = [{ doc: 'a.md', content, parsed: parseFiche('a.md', content) }]
  const manifestByTopic = new Map([['a#non-tickete', { topic: 'a#non-tickete', ticket: '#1' }]])
  const ctx = { index, closure: new Set(), manifestByTopic, fiches }
  // sanity : les 3 états attendus
  const states = new Map(computeAll(ctx).perTopic.map((t) => [t.topic, t.implemented]))
  assert.equal(states.get('a#impl-topic'), true)
  assert.equal(states.get('a#non-tickete'), false)
  assert.equal(states.get('a#orphelin'), false)
  // seul l'orphelin (non-impl SANS entrée) est retourné
  assert.deepEqual(findManifestOrphans(ctx), ['a#orphelin'])
})

test('renderBlock : topic non matché par lignes mais MATCHÉ par folio → implémenté, id = symbole', () => {
  const index = {
    impl: [{ book: 'AA', ch: 9, lo: 146, hi: 160, file: 'src/data/creatures.json', row: 5160, isTs: false, sym: 'demigriffon-adulte-dresse' }],
    tests: [], fileLines: new Map(), nonCommentText: new Map(),
  }
  const ctx = { index, closure: new Set(), manifestByTopic: new Map() }
  const field = parseFiche('a.md', '## Demigriffon\n\n**Sources RAW :** `AA 9 l.150`\n\n**Implémente :** ancien\n').fields[0]
  const block = renderBlock(field, ctx)
  assert.ok(block[0].includes(GEN_TAG))
  const b = block.find((l) => l.startsWith('- `AA 9`'))
  assert.match(b, /`demigriffon-adulte-dresse`/) // id d'entrée = symbole
  assert.match(b, /`src\/data\/creatures\.json`/)
  // déterminisme : deux rendus identiques
  assert.deepEqual(renderBlock(field, ctx), renderBlock(field, ctx))
})
