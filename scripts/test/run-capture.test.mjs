// Capture du lanceur `scripts/test/run.mjs` sur un FAUX dépôt (tmpdir + faux
// `node_modules/vitest/vitest.mjs`) : en-tête + `status:` dans le fichier, résumé qui nomme la
// cause brute quand le run échoue SANS bilan, bornes de charge jamais doublées, couleur éteinte.
// Le faux binaire évite de payer un vrai run de suite par cas.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, copyFileSync, writeFileSync, readFileSync, readdirSync, utimesSync, rmSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const ICI = dirname(fileURLToPath(import.meta.url))

/** Faux dépôt : le lanceur et sa logique pure copiés, plus un Vitest de substitution. */
function fauxDepot(sourceDuFauxVitest) {
  const base = mkdtempSync(join(tmpdir(), 'vitest-run-'))
  mkdirSync(join(base, 'scripts', 'test'), { recursive: true })
  for (const nom of ['run.mjs', 'partition.mjs']) {
    copyFileSync(join(ICI, nom), join(base, 'scripts', 'test', nom))
  }
  mkdirSync(join(base, 'node_modules', 'vitest'), { recursive: true })
  writeFileSync(join(base, 'node_modules', 'vitest', 'vitest.mjs'), sourceDuFauxVitest, 'utf8')
  return base
}

const TRACE = (suite) =>
  "import fs from 'node:fs'\n" +
  "fs.writeFileSync(process.env.TRACE_ARGV, JSON.stringify(process.argv.slice(2)), 'utf8')\n" +
  "process.stdout.write('couleur FORCE_COLOR=' + (process.env.FORCE_COLOR ?? '(absent)') + " +
  "' NO_COLOR=' + (process.env.NO_COLOR ?? '(absent)') + '\\n')\n" +
  suite

const VITEST_VERT = TRACE(
  "process.stdout.write(' Test Files  1 passed (1)\\n')\n" +
    "process.stdout.write(' Tests  3 passed (3)\\n')\n" +
    'process.exit(0)\n',
)

const VITEST_SANS_BILAN = TRACE(
  "process.stderr.write('No test files found, exiting with code 1\\n')\n" + 'process.exit(1)\n',
)

/** `--coverage` force le lancement mono-processus (drapeau global à un seul processus). */
function lance(base, args = []) {
  const trace = join(base, 'argv.json')
  const run = spawnSync(process.execPath, [join(base, 'scripts', 'test', 'run.mjs'), '--coverage', ...args], {
    cwd: base,
    encoding: 'utf8',
    env: { ...process.env, FORCE_COLOR: '3', TRACE_ARGV: trace },
  })
  const cache = join(base, 'node_modules', '.cache')
  const fichiers = readdirSync(cache).filter((n) => /^vitest-run-\d+\.txt$/.test(n))
  assert.equal(fichiers.length, 1, `captures trouvées : ${fichiers.join(', ')}`)
  return {
    run,
    argv: JSON.parse(readFileSync(trace, 'utf8')),
    chemin: join(cache, fichiers[0]),
    capture: readFileSync(join(cache, fichiers[0]), 'utf8'),
  }
}

test('capture : en-tête d’emblée, sortie tee-ée, `status:` en queue, chemin dans le résumé', () => {
  const base = fauxDepot(VITEST_VERT)
  try {
    const { run, capture, chemin } = lance(base)
    assert.equal(run.status, 0, `run en échec : ${run.stdout}${run.stderr}`)
    assert.ok(capture.length > 0, 'capture vide')
    assert.match(capture, /^# commande : .*run\.mjs .*--coverage/m)
    assert.match(capture, /^# date : \d{4}-\d{2}-\d{2}T[\d:.]+Z$/m)
    assert.match(capture, /^# pid : \d+$/m)
    assert.match(capture, /^# cwd : .+$/m)
    assert.match(capture, /Test Files {2}1 passed \(1\)/)
    assert.equal(capture.trimEnd().split('\n').pop(), 'status: 0')
    // Le chemin de la capture clôt le résumé imprimé.
    assert.equal(run.stdout.trimEnd().split('\n').pop(), `capture : ${chemin}`)
    // Couleur : FORCE_COLOR SUPPRIMÉ (pas mis à `0`), NO_COLOR posé.
    assert.match(run.stdout, /couleur FORCE_COLOR=\(absent\) NO_COLOR=1/)
  } finally {
    rmSync(base, { recursive: true, force: true })
  }
})

test('bornes de charge : paire injectée par défaut, JAMAIS doublée si l’appelant borne', () => {
  // Un dépôt par lancement : la capture est nommée par PID, deux runs y déposeraient deux fichiers.
  const sansBorne = fauxDepot(VITEST_VERT)
  const avecBorne = fauxDepot(VITEST_VERT)
  try {
    assert.deepEqual(lance(sansBorne).argv.slice(0, 3), ['run', '--minWorkers=1', '--maxWorkers=4'])

    const borne = lance(avecBorne, ['--minWorkers=2'])
    assert.equal(borne.run.status, 0, `run en échec : ${borne.run.stdout}${borne.run.stderr}`)
    const mins = borne.argv.filter((a) => /^--min-?[wW]orkers(=|$)/.test(a))
    assert.equal(mins.length, 1, `--minWorkers en double : ${borne.argv.join(' ')}`)
    assert.ok(!borne.argv.includes('--maxWorkers=4'), `borne injectée par-dessus : ${borne.argv.join(' ')}`)
  } finally {
    for (const base of [sansBorne, avecBorne]) rmSync(base, { recursive: true, force: true })
  }
})

// ── Chemin PARTAGÉ (deux processus Vitest) ────────────────────────────────────────────────────
// Les trois cas ci-dessus forcent `--coverage`, donc le lancement MONO : le chemin réellement servi
// par `npm test` (le partage node/jsdom) n'était couvert par aucun d'eux. `WFRP_TEST_COEURS` force
// le seuil de partage, sinon le verdict dépendrait du nombre de cœurs du runner.
const VITEST_SPLIT =
  "import fs from 'node:fs'\n" +
  'const argv = process.argv.slice(2)\n' +
  "if (argv[0] === 'list') {\n" +
  "  const json = argv.find((a) => a.startsWith('--json=')).slice('--json='.length)\n" +
  "  fs.writeFileSync(json, JSON.stringify(JSON.parse(process.env.TRACE_FICHIERS).map((file) => ({ file }))), 'utf8')\n" +
  '  process.exit(0)\n' +
  '}\n' +
  "const cote = /vitest\\.([a-z]+)\\.config/.exec(argv[argv.indexOf('--config') + 1])[1]\n" +
  "process.stdout.write(' Test Files  1 passed (1)\\n')\n" +
  "process.stdout.write('marque-stdout ' + cote + '\\n')\n" +
  "process.stderr.write('marque-stderr ' + cote + '\\n')\n" +
  'process.exit(0)\n'

test('partage node/jsdom : DEUX processus, sorties préfixées par côté, les deux dans la capture', () => {
  const base = fauxDepot(VITEST_SPLIT)
  try {
    // Un fichier par côté : c'est le docblock qui décide, comme Vitest lui-même.
    const cote = { node: join(base, 'moteur.test.ts'), jsdom: join(base, 'ecran.test.tsx') }
    writeFileSync(cote.node, "import { test } from 'vitest'\ntest('n', () => {})\n", 'utf8')
    writeFileSync(cote.jsdom, '// @vitest-environment jsdom\ntest x\n', 'utf8')
    const trace = join(base, 'argv.json')
    const run = spawnSync(process.execPath, [join(base, 'scripts', 'test', 'run.mjs')], {
      cwd: base,
      encoding: 'utf8',
      env: {
        ...process.env,
        TRACE_ARGV: trace,
        WFRP_TEST_COEURS: '16',
        TRACE_FICHIERS: JSON.stringify([cote.node, cote.jsdom].map((p) => p.split('\\').join('/'))),
      },
    })
    assert.equal(run.status, 0, `run partagé en échec : ${run.stdout}${run.stderr}`)
    const cache = join(base, 'node_modules', '.cache')
    const fichiers = readdirSync(cache).filter((n) => /^vitest-run-\d+\.txt$/.test(n))
    assert.equal(fichiers.length, 1, `captures trouvées : ${fichiers.join(', ')}`)
    const capture = readFileSync(join(cache, fichiers[0]), 'utf8')
    // Les DEUX côtés ont tourné, et chaque flux (stdout ET stderr) porte le préfixe de son côté.
    for (const c of ['node', 'jsdom']) {
      assert.ok(capture.includes(`[${c}] marque-stdout ${c}`), `stdout du côté ${c} absent : ${capture}`)
      assert.ok(capture.includes(`[${c}] marque-stderr ${c}`), `stderr du côté ${c} absent : ${capture}`)
    }
    assert.match(capture, /node: exit 0 · jsdom: exit 0 · real [\d.]+s/)
    assert.equal(capture.trimEnd().split('\n').pop(), 'status: 0')
  } finally {
    rmSync(base, { recursive: true, force: true })
  }
})

test('bornage du cache : les captures de plus de 7 jours partent, les fraîches restent', () => {
  const base = fauxDepot(VITEST_VERT)
  try {
    const cache = join(base, 'node_modules', '.cache')
    mkdirSync(cache, { recursive: true })
    const vieille = join(cache, 'vitest-run-999999.txt')
    const recente = join(cache, 'vitest-run-999998.txt')
    for (const f of [vieille, recente]) writeFileSync(f, 'ancienne capture\n', 'utf8')
    const il_y_a_8_jours = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000)
    utimesSync(vieille, il_y_a_8_jours, il_y_a_8_jours)

    const run = spawnSync(process.execPath, [join(base, 'scripts', 'test', 'run.mjs'), '--coverage'], {
      cwd: base,
      encoding: 'utf8',
      env: { ...process.env, TRACE_ARGV: join(base, 'argv.json') },
    })
    assert.equal(run.status, 0, `run en échec : ${run.stdout}${run.stderr}`)
    const restants = readdirSync(cache).filter((n) => /^vitest-run-\d+\.txt$/.test(n))
    assert.ok(!restants.includes('vitest-run-999999.txt'), `capture périmée conservée : ${restants.join(', ')}`)
    assert.ok(restants.includes('vitest-run-999998.txt'), `capture fraîche emportée : ${restants.join(', ')}`)
  } finally {
    rmSync(base, { recursive: true, force: true })
  }
})

test('échec SANS bilan : la cause brute et l’exit sont imprimés, jamais un résumé vide', () => {
  const base = fauxDepot(VITEST_SANS_BILAN)
  try {
    const { run, capture, chemin } = lance(base)
    assert.equal(run.status, 1)
    assert.match(run.stdout, /ÉCHEC \(code 1\) sans bilan Vitest/)
    assert.match(run.stdout, /No test files found/)
    assert.equal(run.stdout.trimEnd().split('\n').pop(), `capture : ${chemin}`)
    assert.equal(capture.trimEnd().split('\n').pop(), 'status: 1')
  } finally {
    rmSync(base, { recursive: true, force: true })
  }
})
