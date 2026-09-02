// Contrat de l'EMPREINTE DE SOURCES (#1679 L1b) : ce qu'un générateur lit se MESURE, le pied du doc
// porte l'empreinte des sources du DISQUE, `--empreinte` la recalcule sur l'INDEX.
//   node --test scripts/docs/lib/enregistreur-lectures.test.mjs
//
// Chaque mesure de générateur ci-dessous est une MORSURE : elle rougit si l'une des trois mécaniques
// est débranchée — `module.syncBuiltinESMExports()` (les liaisons ESM figées rendent l'enveloppe de
// `fs` invisible), la propagation par `NODE_OPTIONS` (les dumpers lancés en sous-processus), et
// l'entrée `tsx/esm` (l'exécutable `tsx` re-spawne un processus qui perd le préchargeur).
import test from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import {
  avecPied, ecrireDoc, empreinteDuDisque, empreinteDeLIndex, fusionnerLectures, hashListing,
  indexGit, lirePied, retirerPied, serialiserSourcesLues,
} from './empreinte-sources.mjs'
import { ciblesNonSignees, refusSourcesInsuffisantes } from '../build-all.mjs'
import { generateursArmes } from '../../guards/lib/empreinteStage.mjs'

const ICI = path.dirname(fileURLToPath(import.meta.url))
const RACINE = path.resolve(ICI, '..', '..', '..')
const ENREGISTREUR = pathToFileURL(path.join(ICI, 'enregistreur-lectures.mjs')).href
const TSX_ESM = path.join(RACINE, 'node_modules', 'tsx', 'dist', 'esm', 'index.mjs')

/** Joue un générateur en `--check` sous l'enregistreur et rend son set de lectures fusionné. */
function mesurer(script, cible, { tsx = false } = {}) {
  const sortie = mkdtempSync(path.join(tmpdir(), 'lectures-'))
  try {
    execFileSync(process.execPath, [...(tsx ? ['--import', pathToFileURL(TSX_ESM).href] : []), script, '--check'], {
      cwd: RACINE,
      stdio: 'ignore',
      env: {
        ...process.env,
        NODE_OPTIONS: `${process.env.NODE_OPTIONS ?? ''} --import ${ENREGISTREUR}`.trim(),
        WFRP_LECTURES_RACINE: RACINE,
        WFRP_LECTURES_SORTIE: path.join(sortie, 'l'),
        WFRP_LECTURES_CIBLE: cible,
      },
    })
    return fusionnerLectures(sortie)
  } finally {
    rmSync(sortie, { recursive: true, force: true })
  }
}

test('témoin : build-index-moteur mesure plus de 100 sources (liaisons ESM synchronisées)', () => {
  const lues = mesurer('scripts/docs/build-index-moteur.mjs', 'docs/index-moteur.md')
  assert.ok(lues.fichiers.length > 100, `sources mesurées : ${lues.fichiers.length}`)
  assert.ok(lues.fichiers.includes('src/engine/combat.ts'), 'src/engine/combat.ts absent du set')
  assert.ok(!lues.fichiers.includes('docs/index-moteur.md'), 'le doc CIBLE ne peut pas être sa propre source')
})

test('sous-processus : build-donnees mesure les schémas lus par son dumper tsx (NODE_OPTIONS)', () => {
  const lues = mesurer('scripts/docs/build-donnees.mjs', 'docs/donnees.md')
  const schemas = lues.fichiers.filter((f) => f.startsWith('src/data/schemas/'))
  assert.ok(schemas.length > 100, `schémas mesurés : ${schemas.length} (le dumper est un sous-processus)`)
})

test('runner tsx : build-structures mesure src/data ET src/scenes (entrée tsx/esm)', () => {
  const lues = mesurer('scripts/docs/build-structures.mts', 'docs/structures-donnees.md', { tsx: true })
  assert.ok(lues.fichiers.some((f) => f.startsWith('src/data/')), 'aucune source src/data')
  assert.ok(lues.fichiers.some((f) => f.startsWith('src/scenes/')), 'aucune source src/scenes')
})

test('un set vide ou minuscule ARRÊTE la génération, en nommant le générateur', () => {
  assert.match(refusSourcesInsuffisantes('scripts/docs/build-x.mjs', 0), /build-x\.mjs.*0 source\(s\).*AVEUGLE/)
  assert.match(refusSourcesInsuffisantes('scripts/docs/build-x.mjs', 1), /1 source\(s\)/)
  assert.equal(refusSourcesInsuffisantes('scripts/docs/build-x.mjs', 2), null)
})

test('un fichier AJOUTÉ à un dossier lu change l\'empreinte, sans qu\'aucun contenu ne soit lu', () => {
  const racine = mkdtempSync(path.join(tmpdir(), 'empreinte-'))
  try {
    mkdirSync(path.join(racine, 'd'))
    writeFileSync(path.join(racine, 'd', 'a.json'), '{}')
    const lues = () => ({ fichiers: ['d/a.json'], dossiers: new Map([['d', readdirSync(path.join(racine, 'd'))]]) })
    const avant = empreinteDuDisque(racine, lues(), new Set()).empreinte
    writeFileSync(path.join(racine, 'd', 'b.json'), '{}')
    const apres = empreinteDuDisque(racine, lues(), new Set()).empreinte
    assert.notEqual(avant, apres, 'le listing du dossier n\'entre pas dans l\'empreinte')
    assert.notEqual(hashListing(['a.json']), hashListing(['a.json', 'b.json']))
  } finally {
    rmSync(racine, { recursive: true, force: true })
  }
})

/** Dépôt jetable : une source, un doc dérivé signé, un `docs/.sources-lues.json`. */
function depotFixture() {
  const racine = mkdtempSync(path.join(tmpdir(), 'depot-'))
  const git = (...args) => execFileSync('git', args, { cwd: racine, encoding: 'utf8' })
  git('init', '-q')
  git('config', 'user.email', 'test@local')
  git('config', 'user.name', 'test')
  mkdirSync(path.join(racine, 'docs'))
  mkdirSync(path.join(racine, 'src'))
  writeFileSync(path.join(racine, 'src', 'source.ts'), 'export const x = 1\n')
  writeFileSync(path.join(racine, 'docs', 'reprise-apres-pause.md'), '# doc\n')
  writeFileSync(
    path.join(racine, 'docs', '.sources-lues.json'),
    serialiserSourcesLues({
      'scripts/docs/build-reprise.mjs': { cibles: ['docs/reprise-apres-pause.md'], fichiers: ['src/source.ts'], dossiers: ['src'] },
    }),
  )
  return { racine, git }
}

/** Signe le doc comme le ferait `build-all` : empreinte des sources TELLES QUE LE DISQUE les porte. */
function signer(racine) {
  const lues = { fichiers: ['src/source.ts'], dossiers: new Map([['src', readdirSync(path.join(racine, 'src'))]]) }
  const { empreinte } = empreinteDuDisque(racine, lues, new Set())
  const doc = path.join(racine, 'docs', 'reprise-apres-pause.md')
  writeFileSync(doc, avecPied(readFileSync(doc, 'utf8'), { empreinte, fichiers: 1, dossiers: 1 }))
}

function empreinter(racine) {
  try {
    return { code: 0, sortie: execFileSync(process.execPath, [path.join(RACINE, 'scripts', 'docs', 'build-all.mjs'), '--empreinte'], { cwd: racine, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }) }
  } catch (e) {
    return { code: e.status, sortie: `${e.stdout ?? ''}${e.stderr ?? ''}` }
  }
}

test('--empreinte : tout stagé passe, une source régénérée hors index est REFUSÉE par son nom', () => {
  const { racine, git } = depotFixture()
  try {
    signer(racine)
    git('add', '-A')
    const vert = empreinter(racine)
    assert.equal(vert.code, 0, vert.sortie)
    assert.match(vert.sortie, /docs:empreinte — OK/)

    // La source change sur le DISQUE et n'est PAS stagée ; le doc est régénéré sur cet arbre-là.
    writeFileSync(path.join(racine, 'src', 'source.ts'), 'export const x = 2\n')
    signer(racine)
    git('add', 'docs/reprise-apres-pause.md')
    const rouge = empreinter(racine)
    assert.equal(rouge.code, 1)
    assert.match(rouge.sortie, /docs\/reprise-apres-pause\.md : doc régénéré depuis un arbre ≠ index/)
    assert.match(rouge.sortie, /src\/source\.ts/)
  } finally {
    rmSync(racine, { recursive: true, force: true })
  }
})

test('--empreinte : une source NON SUIVIE est nommée, jamais hashée à vide', () => {
  const { racine, git } = depotFixture()
  try {
    signer(racine)
    git('add', '-A')
    git('rm', '--cached', '-q', 'src/source.ts')
    const rouge = empreinter(racine)
    assert.equal(rouge.code, 1)
    assert.match(rouge.sortie, /source non suivie « src\/source\.ts »/)
  } finally {
    rmSync(racine, { recursive: true, force: true })
  }
})

test('le pied se pose et se retire À L\'OCTET, en un seul exemplaire', () => {
  const corps = '# doc\n\ncontenu\n\n'
  const signe = avecPied(corps, { empreinte: 'a'.repeat(40), fichiers: 3, dossiers: 1 })
  assert.equal(retirerPied(signe), corps)
  assert.deepEqual(lirePied(signe), { empreinte: 'a'.repeat(40), fichiers: 3, dossiers: 1 })
  assert.equal(retirerPied(avecPied(signe, { empreinte: 'b'.repeat(40), fichiers: 1, dossiers: 0 })), corps)
  assert.equal(lirePied(corps), null)
})

test('docs/.sources-lues.json est DÉTERMINISTE : l\'ordre de mesure ne le change pas', () => {
  const entree = (n) => ({ cibles: [`docs/${n}.md`], fichiers: [`src/b/${n}.ts`, `src/a/${n}.ts`], dossiers: ['src/b', 'src/a'] })
  const direct = serialiserSourcesLues({ 'scripts/a.mjs': entree('a'), 'scripts/b.mjs': entree('b') })
  const inverse = serialiserSourcesLues({ 'scripts/b.mjs': entree('b'), 'scripts/a.mjs': entree('a') })
  assert.equal(direct, inverse)
  assert.match(direct, /"src\/a\/a\.ts",\n {6}"src\/b\/a\.ts"/)
})

test('un fichier NON SUIVI dans un dossier lu écarte l\'empreinte du disque de celle de l\'index', () => {
  const { racine, git } = depotFixture()
  try {
    git('add', '-A')
    const lues = () => ({ fichiers: ['src/source.ts'], dossiers: new Map([['src', readdirSync(path.join(racine, 'src'))]]) })
    const blobs = indexGit(racine)
    const parLIndex = empreinteDeLIndex(blobs, { fichiers: ['src/source.ts'], dossiers: new Map([['src', []]]) }).empreinte
    assert.equal(empreinteDuDisque(racine, lues(), new Set()).empreinte, parLIndex)
    writeFileSync(path.join(racine, 'src', 'intrus.ts'), 'export const y = 2\n')
    assert.notEqual(empreinteDuDisque(racine, lues(), new Set()).empreinte, parLIndex)
    // Le même fichier IGNORÉ par git ne sort pas du listing de l'index : l'empreinte ne bouge pas.
    assert.equal(empreinteDuDisque(racine, lues(), new Set(['src/intrus.ts'])).empreinte, parLIndex)
  } finally {
    rmSync(racine, { recursive: true, force: true })
  }
})

test('indexGit rend les chemins NON-ASCII tels quels (core.quotepath neutralisé)', () => {
  const blobs = indexGit(RACINE)
  const accentue = 'Source/WH - V4 - Aux Armes/01 - CRÉDITS.md'
  assert.ok(blobs.has(accentue), `« ${accentue} » absent de l'index lu : git l'a rendu échappé en octal`)
  assert.ok([...blobs.keys()].every((p) => !p.startsWith('"')), 'un chemin est rendu entre guillemets')
  assert.match(blobs.get(accentue), /^[0-9a-f]{40}$/)
})

test('une cible SANS pied est nommée par l\'auto-contrôle de fin de génération', () => {
  const racine = mkdtempSync(path.join(tmpdir(), 'signature-'))
  try {
    mkdirSync(path.join(racine, 'docs'))
    const doc = path.join(racine, 'docs', 'systemes.md')
    writeFileSync(doc, '# corps\n')
    const par = { 'scripts/docs/build-systemes.mjs': { cibles: ['docs/systemes.md'], fichiers: [], dossiers: [] } }
    assert.deepEqual(ciblesNonSignees(racine, par), ['docs/systemes.md (écrit par scripts/docs/build-systemes.mjs)'])
    writeFileSync(doc, avecPied(readFileSync(doc, 'utf8'), { empreinte: 'c'.repeat(40), fichiers: 1, dossiers: 0 }))
    assert.deepEqual(ciblesNonSignees(racine, par), [])
    // Un générateur joué SEUL réécrit sa cible : `ecrireDoc` lui rend son pied, la cible reste signée.
    ecrireDoc(doc, '# corps RÉGÉNÉRÉ\n')
    assert.deepEqual(ciblesNonSignees(racine, par), [])
    assert.match(readFileSync(doc, 'utf8'), /^# corps RÉGÉNÉRÉ\n<!-- sources-empreinte: c{40} \(1 fichiers, 0 dossiers\) -->\n$/)
  } finally {
    rmSync(racine, { recursive: true, force: true })
  }
})

test('le hook n\'arme QUE les générateurs dont un DOC est stagé — jamais une source', () => {
  const lues = {
    'scripts/docs/build-index-moteur.mjs': { cibles: ['docs/index-moteur.md'], fichiers: ['src/engine/combat.ts'], dossiers: [] },
    'scripts/docs/build-systemes.mjs': { cibles: ['docs/systemes.md'], fichiers: ['src/state/store.ts'], dossiers: [] },
  }
  assert.deepEqual(generateursArmes(lues, ['docs\\index-moteur.md']), ['scripts/docs/build-index-moteur.mjs'])
  assert.deepEqual(generateursArmes(lues, ['docs/index-moteur.md', 'docs/systemes.md']), ['scripts/docs/build-index-moteur.mjs', 'scripts/docs/build-systemes.mjs'])
  // Une SOURCE stagée seule n'arme rien : le doc qu'elle périme ne part pas dans ce commit.
  assert.deepEqual(generateursArmes(lues, ['src/engine/combat.ts', 'src/state/store.ts']), [])
  // Le dérivé des sets stagé SEUL non plus (il n'est la cible d'aucun générateur).
  assert.deepEqual(generateursArmes(lues, ['docs/.sources-lues.json']), [])
  assert.deepEqual(generateursArmes(lues, ['src/ui/Prose.tsx']), [])
})

test('--empreinte sans aucun doc à juger sort 0, en le disant', () => {
  const { racine, git } = depotFixture()
  try {
    signer(racine)
    git('add', '-A')
    const seul = execFileSync(process.execPath, [path.join(RACINE, 'scripts', 'docs', 'build-all.mjs'), '--empreinte', '--only', 'scripts/docs/build-inconnu.mjs'], { cwd: racine, encoding: 'utf8' })
    assert.match(seul, /aucun doc stagé/)
  } finally {
    rmSync(racine, { recursive: true, force: true })
  }
})
