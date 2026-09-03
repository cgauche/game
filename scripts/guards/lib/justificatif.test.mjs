// Justificatif de gates par contenu (#1679 L2) — la fixture pose un VRAI dépôt jetable et de VRAIS
// commits : la clé est un `git hash-object`, un double injecté ne prouverait rien de ce que git rend.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  CI_SEULEMENT,
  JOBS_HORS_JUSTIFICATIF,
  cheminJustificatifs,
  cleTree,
  cleTreeComplete,
  commandeEffective,
  ecrireJustificatif,
  fichierDeGate,
  gateSurArbrePlein,
  gatesRequises,
  horsCle,
  lireJustificatif,
  motifDeRefus,
  nomDeGate,
  perimetreSale,
  suiteComplete,
} from './justificatif.mjs'

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..')

// Chemin de doc ASSEMBLÉ : un littéral `docs/<nom>.md` dans une fixture est lu par
// `scripts/docs/check-doc-refs.mjs` comme une référence vivante — qu'il déclare morte.
const DOC_A = ['docs', 'a.md'].join('/')

const git = (cwd) => (args) => execFileSync('git', args, { cwd, encoding: 'utf8' }).trim()

/** Dépôt jetable : `src/`, `docs/` et `.claude/` peuplés, un premier commit. */
function depot() {
  const racine = mkdtempSync(join(tmpdir(), 'justificatif-'))
  const g = git(racine)
  g(['init', '--initial-branch=main'])
  g(['config', 'user.email', 'mesure@example.invalid'])
  g(['config', 'user.name', 'mesure'])
  ecrire(racine, 'src/a.ts', 'export const a = 1\n')
  ecrire(racine, DOC_A, 'doc\n')
  ecrire(racine, '.claude/memory/a.md', 'fiche\n')
  g(['add', '-A'])
  g(['commit', '-m', 'fondation'])
  return racine
}

function ecrire(racine, rel, texte) {
  mkdirSync(join(racine, dirname(rel)), { recursive: true })
  writeFileSync(join(racine, rel), texte)
}

const jeter = (racine) => rmSync(racine, { recursive: true, force: true })

test('`horsCle` : UNE liste — la clé et la mesure de saleté écartent exactement les mêmes chemins', () => {
  assert.deepEqual(
    [DOC_A, '.claude/memory/a.md', 'src/a.ts', 'scripts/a.mjs', 'package.json'].map(horsCle),
    [true, true, false, false, false],
  )
  const racine = depot()
  try {
    ecrire(racine, DOC_A, 'doc modifié\n')
    ecrire(racine, '.claude/memory/a.md', 'fiche modifiée\n')
    assert.deepEqual(perimetreSale({ cwd: racine }), [])
    ecrire(racine, 'src/a.ts', 'export const a = 2\n')
    assert.deepEqual(perimetreSale({ cwd: racine }), [' M src/a.ts'])
  } finally {
    jeter(racine)
  }
})

test('la clé de contenu ignore `docs/` et `.claude/`, et suit `src/`', () => {
  const racine = depot()
  const g = git(racine)
  try {
    const depart = cleTree('HEAD', { cwd: racine })
    ecrire(racine, DOC_A, 'doc régénéré\n')
    ecrire(racine, '.claude/memory/b.md', 'fiche neuve\n')
    g(['add', '-A'])
    g(['commit', '-m', 'docs seuls'])
    assert.notEqual(g(['rev-parse', 'HEAD']), g(['rev-parse', 'HEAD~1']))
    assert.equal(cleTree('HEAD', { cwd: racine }), depart, 'un commit docs-only garde la clé du parent')
    ecrire(racine, 'src/a.ts', 'export const a = 3\n')
    g(['add', '-A'])
    g(['commit', '-m', 'code'])
    assert.notEqual(cleTree('HEAD', { cwd: racine }), depart)
  } finally {
    jeter(racine)
  }
})

test('un fichier PAR GATE sous la clé, sans fichier en cours d’écriture, capture portée', () => {
  const racine = depot()
  try {
    const sha = git(racine)(['rev-parse', 'HEAD'])
    ecrireJustificatif({ cwd: racine, gate: 'test', sha, capture: 'node_modules/.cache/vitest-run-1.txt' })
    const { fichier, cleTree: cle } = ecrireJustificatif({ cwd: racine, gate: 'typecheck', sha })
    assert.deepEqual(readdirSync(join(cheminJustificatifs({ cwd: racine }), cle)).sort(), [
      'test.json',
      'typecheck.json',
    ])
    const vuTest = lireJustificatif({ cwd: racine, cleTree: cle, gate: 'test' })
    const vuTsc = lireJustificatif({ cwd: racine, cleTree: cle, gate: 'typecheck' })
    assert.equal(vuTest.capture, 'node_modules/.cache/vitest-run-1.txt')
    assert.equal(vuTsc.capture, undefined)
    assert.equal(vuTest.sale, false)
    assert.equal(vuTsc.cleComplete, cleTreeComplete(sha, { cwd: racine }))
    assert.deepEqual(JSON.parse(readFileSync(fichier, 'utf8')), vuTsc)
    assert.equal(lireJustificatif({ cwd: racine, cleTree: cle, gate: 'lint' }), null)
  } finally {
    jeter(racine)
  }
})

test('une gate jouée sur un arbre SALE au périmètre le PORTE, et le refus la nomme', () => {
  const racine = depot()
  try {
    ecrire(racine, 'src/b.ts', 'export const b = 1\n')
    const sha = git(racine)(['rev-parse', 'HEAD'])
    const { cleTree: cle } = ecrireJustificatif({ cwd: racine, gate: 'test', sha })
    const vu = lireJustificatif({ cwd: racine, cleTree: cle, gate: 'test' })
    assert.equal(vu.sale, true)
    assert.deepEqual(vu.salis, ['?? src/b.ts'])
    assert.match(motifDeRefus(vu, { nom: 'test', commande: 'npm test' }), /arbre SALE.*\?\? src\/b\.ts/)
  } finally {
    jeter(racine)
  }
})

test('refus nommés : gate absente, gate rouge', () => {
  assert.match(motifDeRefus(null, { nom: 'lint', commande: 'npm run lint' }), /jamais jouée.*npm run lint/)
  assert.match(
    motifDeRefus({ statut: 'rouge', sale: false }, { nom: 'lint', commande: 'npm run lint' }),
    /au statut rouge/,
  )
  assert.equal(motifDeRefus({ statut: 'vert', sale: false }, { nom: 'lint', commande: 'x' }), null)
})

test('la clé COMPLÈTE gouverne les gates qui lisent docs/ ou .claude/, et elles seules', () => {
  const vue = { statut: 'vert', sale: false, cleComplete: 'AAA' }
  const cles = { cleTree: 'PPP', cleComplete: 'BBB' }
  assert.equal(motifDeRefus(vue, { nom: 'lint', commande: 'npm run lint' }, cles), null)
  assert.match(
    motifDeRefus(vue, { nom: 'docs:check', commande: 'npm run docs:check' }, cles),
    /jouée sur un AUTRE arbre : elle lit docs\//,
  )
  for (const nom of ['docs:check', 'docs:empreinte', 'test:docs', 'test:raw', 'test:hooks', 'agents:check'])
    assert.ok(gateSurArbrePlein(nom), `${nom} lit docs/ ou .claude/ : sa clé doit être l'arbre PLEIN`)
  for (const nom of ['test', 'typecheck', 'lint', 'build', 'deps:unused'])
    assert.equal(gateSurArbrePlein(nom), false, `${nom} ne lit ni docs/ ni .claude/`)
})

test('un run RESTREINT ne justifie rien — seule la suite complète le fait', () => {
  assert.equal(suiteComplete([], []), true)
  assert.equal(suiteComplete([], ['--maxWorkers=1']), true)
  assert.equal(suiteComplete([], ['--bail=1']), true, '--bail arrête au premier rouge : un run VERT a tout joué')
  assert.equal(suiteComplete(['src/a.test.ts'], ['src/a.test.ts']), false)
  for (const restreint of [
    ['--changed'],
    ['--changed=HEAD~1'],
    ['-t', 'dual wield'],
    ['--testNamePattern', 'X'],
    ['--shard=1/4'],
    ['--project', 'jsdom'],
    ['--dir', 'src/engine'],
    ['--related', 'src/a.ts'],
  ])
    assert.equal(suiteComplete([], restreint), false, `${restreint.join(' ')} restreint ce qui est joué`)
})

test('les gates exigées sont les steps RÉELS de ci.yml, le job `migrations` EXCLU avec sa raison', () => {
  const gates = gatesRequises({ cwd: REPO })
  const noms = gates.map((g) => g.nom)
  for (const attendu of ['test', 'typecheck', 'lint', 'docs:check', 'deps:unused'])
    assert.ok(noms.includes(attendu), `ci.yml joue ${attendu} : il doit être exigé au push (lues : ${noms.join(', ')})`)
  assert.equal(new Set(noms).size, noms.length, 'aucun doublon de gate')
  assert.ok(
    !noms.includes('migrations:replay'),
    'le rejeu des migrations réécrit src/data EN PLACE : il ne se joue pas sur un arbre de travail',
  )
  assert.deepEqual(gates.filter((g) => g.job === 'migrations'), [])
  assert.match(JOBS_HORS_JUSTIFICATIF.migrations, /EN PLACE.*#1613/)
})

test('un step d’une forme NON classée fait LEVER (fail-closed), et le message dit quoi faire', () => {
  const racine = mkdtempSync(join(tmpdir(), 'ci-yml-'))
  try {
    const fichier = join(racine, 'ci.yml')
    writeFileSync(
      fichier,
      ['name: CI', 'jobs:', '  build:', '    steps:', '      - run: npm test', '      - run: ./outil-maison.sh', ''].join('\n'),
    )
    assert.throws(() => gatesRequises({ fichier }), /step non classé : \.\/outil-maison\.sh.*CI_SEULEMENT/s)
    writeFileSync(fichier, ['name: CI', 'jobs:', '  build:', '    steps:', '      - run: npm ci', '      - run: npm run lint', ''].join('\n'))
    assert.deepEqual(gatesRequises({ fichier }).map((g) => g.nom), ['lint'])
    assert.ok('npm ci' in CI_SEULEMENT)
  } finally {
    jeter(racine)
  }
})

test('un step de ci.yml renommé change la liste des gates — la source est le fichier', () => {
  const racine = mkdtempSync(join(tmpdir(), 'ci-yml-'))
  try {
    const fichier = join(racine, 'ci.yml')
    writeFileSync(fichier, ['jobs:', '  build:', '    steps:', '      - run: npm run vigie', ''].join('\n'))
    assert.deepEqual(gatesRequises({ fichier }), [{ nom: 'vigie', commande: 'npm run vigie', job: 'build' }])
  } finally {
    jeter(racine)
  }
})

test('un step porteur d’un `if:` reste classé par sa ligne `run:`', () => {
  const racine = mkdtempSync(join(tmpdir(), 'ci-yml-'))
  try {
    const fichier = join(racine, 'ci.yml')
    writeFileSync(
      fichier,
      [
        'jobs:',
        '  build:',
        '    steps:',
        '      - id: install',
        '        run: npm ci',
        "      - if: ${{ !cancelled() && steps.install.outcome == 'success' }}",
        '        run: npm run lint',
        '      - name: Une gate nommée',
        "        if: ${{ !cancelled() && steps.install.outcome == 'success' }}",
        '        run: npm test',
        '',
      ].join('\n'),
    )
    assert.deepEqual(gatesRequises({ fichier }).map((g) => g.nom), ['lint', 'test'])
  } finally {
    jeter(racine)
  }
})

test('`nomDeGate` : `npm test` → test, `npm run x` → x, tout le reste → null', () => {
  assert.equal(nomDeGate('npm test'), 'test')
  assert.equal(nomDeGate('npm run docs:check'), 'docs:check')
  assert.equal(nomDeGate('npm ci'), null)
  assert.equal(nomDeGate('npm run gen && git diff --exit-code'), null)
  assert.equal(nomDeGate('npm --prefix server ci'), null)
})

test('`commandeEffective` rend la commande jouée sous l’enveloppe de justificatif', () => {
  const scripts = {
    typecheck: 'node scripts/gates/justifie.mjs typecheck -- npm run typecheck:brut',
    'typecheck:brut': 'node scripts/lancer-local.mjs typescript -- tsc --noEmit --incremental false',
    lint: 'node scripts/lancer-local.mjs eslint -- eslint .',
  }
  assert.equal(commandeEffective(scripts, 'typecheck'), scripts['typecheck:brut'])
  assert.equal(commandeEffective(scripts, 'lint'), scripts.lint)
  assert.equal(commandeEffective({ a: 'node scripts/gates/justifie.mjs a -- npm run a' }, 'a'), 'node scripts/gates/justifie.mjs a -- npm run a')
})

test('l’enveloppe de gate n’écrit RIEN au rouge, et propage le code de sortie', () => {
  const racine = mkdtempSync(join(tmpdir(), 'gate-rouge-'))
  try {
    const echoue = join(racine, 'echoue.mjs')
    writeFileSync(echoue, 'process.exit(3)\n')
    const vu = spawnSync(
      process.execPath,
      [join(REPO, 'scripts', 'gates', 'justifie.mjs'), 'gate-de-mesure-rouge', '--', 'node', echoue],
      { cwd: REPO, encoding: 'utf8', timeout: 60_000 },
    )
    assert.equal(vu.status, 3, 'le code de sortie de la commande est celui de l’enveloppe')
    const vuJustificatif = lireJustificatif({ cwd: REPO, cleTree: cleTree('HEAD', { cwd: REPO }) })
    assert.equal(vuJustificatif?.gates?.['gate-de-mesure-rouge'], undefined, 'une gate ROUGE ne laisse aucun justificatif')
  } finally {
    jeter(racine)
  }
})

test('ci.yml : chaque gate du job build porte la condition qui l’empêche d’être SKIPPÉE', () => {
  const texte = readFileSync(join(REPO, '.github', 'workflows', 'ci.yml'), 'utf8')
  const build = texte.slice(texte.indexOf('\n  build:'), texte.indexOf('\n  migrations:'))
  const gates = build.split('\n').filter((l) => /^\s*-?\s*run:/.test(l)).length - 1 // l'installation exclue
  const conditions = build.split('\n').filter((l) => l.includes("!cancelled() && steps.install.outcome == 'success'")).length
  assert.equal(
    conditions,
    gates,
    `${gates} gate(s) après l'installation, ${conditions} condition(s) : un step sans elle est SKIPPÉ dès qu'une gate précédente rougit, et son verdict est perdu (runs 33717131460, 33719038837)`,
  )
})

test('un step qui porte `working-directory` ou `env` LÈVE au lieu de créditer la gate racine', () => {
  const racine = mkdtempSync(join(tmpdir(), 'ci-yml-'))
  try {
    const fichier = join(racine, 'ci.yml')
    const cas = {
      'working-directory': ['      - working-directory: server', '        run: npm run lint'],
      env: ['      - env:', '          NODE_OPTIONS: --max-old-space-size=8192', '        run: npm run lint'],
    }
    for (const [cle, lignes] of Object.entries(cas)) {
      writeFileSync(fichier, ['jobs:', '  build:', '    steps:', ...lignes, ''].join('\n'))
      assert.throws(
        () => gatesRequises({ fichier }),
        new RegExp(`step non classé : npm run lint — il porte ${cle}`),
        `un step ${cle} joue AUTRE CHOSE que « npm run lint » : le créditer justifierait un push à tort`,
      )
    }
    writeFileSync(
      fichier,
      ['jobs:', '  build:', '    steps:', '      - name: Une gate nommée', '        id: x', '        run: npm run lint', ''].join('\n'),
    )
    assert.deepEqual(gatesRequises({ fichier }).map((g) => g.nom), ['lint'], '`name`/`id`/`if` sont inertes')
  } finally {
    jeter(racine)
  }
})

test('le nom de fichier d’une gate est légal sous Windows (le `:` y sépare un flux alternatif)', () => {
  assert.equal(fichierDeGate('docs:check'), 'docs%3Acheck.json')
  assert.equal(fichierDeGate('lint'), 'lint.json')
  const racine = depot()
  try {
    const sha = git(racine)(['rev-parse', 'HEAD'])
    const { fichier, cleTree: cle } = ecrireJustificatif({ cwd: racine, gate: 'raw:check-code-refs', sha })
    assert.ok(!fichier.includes(':check'), `nom de fichier illégal sous NTFS : ${fichier}`)
    assert.equal(lireJustificatif({ cwd: racine, cleTree: cle, gate: 'raw:check-code-refs' }).gate, 'raw:check-code-refs')
  } finally {
    jeter(racine)
  }
})
