// Logique PURE du lanceur à deux processus (`scripts/test/run.mjs`) : partition par docblock,
// répartition des workers, routage d'un filtre, argv de l'enfant, verdicts. Le lancement lui-même
// se mesure par `npm test`.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  argumentsEnfant,
  bornesWorkers,
  maxWorkersMono,
  cheminsGlobSuspects,
  codeAgrege,
  codeEnfant,
  cotesRequis,
  enteteCapture,
  environnementDe,
  envEnfant,
  filtrerFichiers,
  partitionner,
  porteBilan,
  repartitionWorkers,
  resumeLancement,
  separerArguments,
  SENTINELLES,
  compterSentinelles,
  bilanDiagnostic,
} from './partition.mjs'

// `filterFiles` de Vitest résout ses filtres relatifs contre le CWD (`relative(dir, f)`) : la
// racine du cas doit donc être celle d'où tourne le runner, comme en conditions réelles.
const RACINE = process.cwd()
const abs = (r) => `${RACINE}/${r}`

test('docblock : présent, absent, au-delà de 4 000 caractères, dans une chaîne', () => {
  assert.equal(environnementDe('/** @vitest-environment jsdom */\nexport {}'), 'jsdom')
  assert.equal(environnementDe('export {}'), 'node')
  // Vitest lit le fichier ENTIER (resolveConfig.rBxzbVsl.js:6559 — `code.match`, sans borne) :
  // un docblock au-delà de 4 000 caractères classe quand même le fichier en jsdom.
  assert.equal(environnementDe('x'.repeat(9000) + '\n// @vitest-environment jsdom\n'), 'jsdom')
  // Même regex, même angle mort : une occurrence DANS UNE CHAÎNE compte pour Vitest.
  assert.equal(environnementDe('const s = "@vitest-environment jsdom"'), 'jsdom')
  // Le préfixe `jest-` est reconnu, et l'environnement retenu est celui du docblock.
  assert.equal(environnementDe('// @jest-environment happy-dom'), 'happy-dom')
  // `test.environment` de vite.config.ts fait le défaut.
  assert.equal(environnementDe('export {}', 'jsdom'), 'jsdom')
})

test('partition : jsdom d’un côté, tout le reste (y compris happy-dom) de l’autre', () => {
  const codes = {
    'a.test.ts': 'export {}',
    'b.test.tsx': '/** @vitest-environment jsdom */',
    'c.test.ts': '// @vitest-environment happy-dom',
  }
  assert.deepEqual(partitionner(Object.keys(codes), (f) => codes[f]), {
    node: ['a.test.ts', 'c.test.ts'],
    jsdom: ['b.test.tsx'],
  })
})

test('workers : partage à partir de 7 cœurs (n − 1 ≥ 6), 2/3 node · 1/3 jsdom sur n − 1', () => {
  assert.deepEqual(repartitionWorkers(2), { split: false, node: 2, jsdom: 0 })
  assert.deepEqual(repartitionWorkers(3), { split: false, node: 3, jsdom: 0 })
  assert.deepEqual(repartitionWorkers(4), { split: false, node: 4, jsdom: 0 })
  assert.deepEqual(repartitionWorkers(6), { split: false, node: 6, jsdom: 0 })
  assert.deepEqual(repartitionWorkers(7), { split: true, node: 4, jsdom: 2 })
  assert.deepEqual(repartitionWorkers(16), { split: true, node: 10, jsdom: 5 })
})

const partition = {
  node: [abs('src/i18n/labels.test.ts'), abs('src/engine/combat.test.ts')],
  jsdom: [abs('src/ui/CombatConsole.test.tsx')],
}

test('filtrage des fichiers : sous-chaîne relative, dossier, chemin absolu, casse', () => {
  const tous = [...partition.node, ...partition.jsdom]
  assert.deepEqual(filtrerFichiers(tous, [], RACINE, 'win32'), tous)
  assert.deepEqual(filtrerFichiers(tous, ['src/engine'], RACINE, 'win32'), [abs('src/engine/combat.test.ts')])
  assert.deepEqual(filtrerFichiers(tous, ['src\\ui'], RACINE, 'win32'), [abs('src/ui/CombatConsole.test.tsx')])
  assert.deepEqual(filtrerFichiers(tous, [abs('src/ui')], RACINE, 'linux'), [abs('src/ui/CombatConsole.test.tsx')])
  assert.deepEqual(filtrerFichiers(tous, ['SRC/I18N'], RACINE, 'win32'), [abs('src/i18n/labels.test.ts')])
  assert.deepEqual(filtrerFichiers(tous, ['src/inexistant'], RACINE, 'win32'), [])
})

test('routage : un filtre-fichier ne lance que le processus qui porte ce fichier', () => {
  assert.deepEqual(cotesRequis(['src/ui/CombatConsole.test.tsx'], partition, RACINE, 'win32'), ['jsdom'])
  assert.deepEqual(cotesRequis(['src/i18n'], partition, RACINE, 'win32'), ['node'])
  assert.deepEqual(
    cotesRequis(['src/ui/CombatConsole.test.tsx', 'src/i18n'], partition, RACINE, 'win32'),
    ['node', 'jsdom'],
  )
  assert.deepEqual(cotesRequis([], partition, RACINE, 'win32'), ['node', 'jsdom'])
  // Filtre qui ne touche rien : un seul côté est rendu, et `run.mjs` retombe alors sur le
  // lancement mono-processus (cotes.length < 2), qui rend le verdict de Vitest sur ce filtre.
  assert.deepEqual(cotesRequis(['src/inexistant'], partition, RACINE, 'win32'), ['node'])
  // Chemin absolu (préfixe) et casse, comme `filterFiles`.
  assert.deepEqual(cotesRequis([abs('src/ui')], partition, RACINE, 'linux'), ['jsdom'])
  assert.deepEqual(cotesRequis(['SRC/I18N'], partition, RACINE, 'win32'), ['node'])
})

test('chemins à métacaractère de glob : repérés, sinon liste vide', () => {
  assert.deepEqual(cheminsGlobSuspects(['src/a.test.ts', 'src/(b)/c.test.ts']), ['src/(b)/c.test.ts'])
  assert.deepEqual(cheminsGlobSuspects(['src/a[1].test.ts', 'src/b*.ts', 'src/c{d}.ts', 'src/e?.ts']), [
    'src/a[1].test.ts',
    'src/b*.ts',
    'src/c{d}.ts',
    'src/e?.ts',
  ])
  assert.deepEqual(cheminsGlobSuspects(['src/a.test.ts']), [])
})

test('arguments : un positionnel ne route que s’il est un chemin existant ; drapeaux mono', () => {
  const estChemin = (t) => ['src/i18n', 'src/ui/CombatConsole.test.tsx'].includes(t)
  // `2` et `Sort` sont des valeurs de drapeau, pas des filtres.
  assert.deepEqual(separerArguments(['src/i18n', '--retry', '2', '-t', 'Sort'], estChemin), {
    filtres: ['src/i18n'],
    mono: false,
  })
  // Un positionnel qui n'est pas un chemin ne route rien (il part quand même dans l'argv enfant).
  assert.deepEqual(separerArguments(['src/i18n', 'motif-inconnu'], estChemin), {
    filtres: ['src/i18n'],
    mono: false,
  })
  assert.deepEqual(separerArguments(['--coverage']), { filtres: [], mono: true })
  assert.deepEqual(separerArguments(['--config=x.ts']), { filtres: [], mono: true })
  // Sortie machine : le préfixage `[node] `/`[jsdom] ` la rendrait illisible.
  assert.deepEqual(separerArguments(['--reporter', 'json']), { filtres: [], mono: true })
  assert.deepEqual(separerArguments(['--reporter=json', '--outputFile', 'r.json']), {
    filtres: [],
    mono: true,
  })
  assert.deepEqual(separerArguments(['--mergeReports']), { filtres: [], mono: true })
  assert.deepEqual(separerArguments(['--merge-reports']), { filtres: [], mono: true })
  assert.deepEqual(separerArguments(['-r', 'autre/racine'], () => true), {
    filtres: [],
    mono: true,
  })
})

test('argv de l’enfant : les arguments de l’appelant ressortent TELS QUELS, en queue', () => {
  const tete = ['/v.mjs', 'run', '--config', '/atelier/vitest.node.config.ts', '--maxWorkers', '10', '--minWorkers', '1', '--passWithNoTests']
  for (const argv of [
    ['src/i18n', '--retry', '2'],
    ['src/i18n', '--maxWorkers', '4'],
    ['src/i18n/i18n.test.ts', 'src/ui/CombatConsole.test.tsx', '--bail', '1'],
    ['-t', 'Sort de feu', '--no-file-parallelism'],
    [],
  ]) {
    const ligne = argumentsEnfant('/v.mjs', '/atelier/vitest.node.config.ts', 10, argv)
    assert.deepEqual(ligne.slice(0, tete.length), tete)
    assert.deepEqual(ligne.slice(tete.length), argv)
  }
})

test('bornes de charge : injectées par PAIRE, et jamais par-dessus celles de l’appelant', () => {
  assert.deepEqual(bornesWorkers([], 16), ['--minWorkers=1', '--maxWorkers=4'])
  assert.deepEqual(bornesWorkers(['src/engine', '--retry', '2'], 16), [
    '--minWorkers=1',
    '--maxWorkers=4',
  ])
  // Un `--minWorkers` en double fait sortir cac (« Expected a single value ») : aucune injection.
  assert.deepEqual(bornesWorkers(['--minWorkers=2'], 16), [])
  assert.deepEqual(bornesWorkers(['--minWorkers', '2'], 16), [])
  assert.deepEqual(bornesWorkers(['--maxWorkers=8'], 16), [])
  assert.deepEqual(bornesWorkers(['--min-workers=2'], 16), [])
  assert.deepEqual(bornesWorkers(['--max-workers', '8'], 16), [])
  // Un POSITIONNEL qui contient le mot n’est pas un drapeau.
  assert.deepEqual(bornesWorkers(['src/minWorkers.test.ts'], 16), [
    '--minWorkers=1',
    '--maxWorkers=4',
  ])
})

test('plafond mono : min(4, cœurs − 1), plancher 1 — la CI 4 vCPU sert 3 workers', () => {
  assert.equal(maxWorkersMono(4), 3)
  assert.deepEqual(bornesWorkers([], 4), ['--minWorkers=1', '--maxWorkers=3'])
  assert.equal(maxWorkersMono(5), 4)
  assert.equal(maxWorkersMono(16), 4)
  assert.equal(maxWorkersMono(2), 1)
  assert.equal(maxWorkersMono(1), 1)
})

test('environnement des enfants : NO_COLOR posé, FORCE_COLOR SUPPRIMÉ (pas mis à zéro)', () => {
  const env = envEnfant({ PATH: '/bin', FORCE_COLOR: '3' })
  assert.equal(env.NO_COLOR, '1')
  assert.equal('FORCE_COLOR' in env, false)
  assert.equal(env.PATH, '/bin')
  // Casse Windows : la variable existe parfois en minuscules dans l’objet copié.
  assert.equal('force_color' in envEnfant({ force_color: '1' }), false)
})

test('bilan du reporter : repéré sur « Test Files » / « Tests », pas sur une phrase quelconque', () => {
  assert.ok(porteBilan('  Test Files  3 passed (3)'))
  assert.ok(porteBilan(' Tests  12 passed (12)'))
  assert.ok(!porteBilan('No test files found, exiting with code 1'))
  assert.ok(!porteBilan(''))
  assert.ok(!porteBilan(' ✓ src/engine/dice.test.ts (7 tests)'))
})

test('capture : un en-tête est écrit d’emblée (commande, date, pid, cwd)', () => {
  const entete = enteteCapture({
    commande: 'node scripts/test/run.mjs src/engine',
    pid: 4242,
    cwd: '/depot',
    date: new Date('2026-08-30T10:11:12.000Z'),
  })
  assert.match(entete, /^# commande : node scripts\/test\/run\.mjs src\/engine$/m)
  assert.match(entete, /^# date : 2026-08-30T10:11:12\.000Z$/m)
  assert.match(entete, /^# pid : 4242$/m)
  assert.match(entete, /^# cwd : \/depot$/m)
  assert.ok(entete.endsWith('\n'))
})

test('résumé : un échec SANS bilan rend la cause brute et l’exit ; le chemin clôt toujours', () => {
  const sansBilan = resumeLancement({
    statut: 1,
    bilan: false,
    queue: ['No test files found, exiting with code 1'],
    capture: '/depot/node_modules/.cache/vitest-run-7.txt',
  })
  assert.match(sansBilan, /ÉCHEC \(code 1\) sans bilan Vitest/)
  assert.match(sansBilan, /No test files found/)
  assert.equal(
    sansBilan.trimEnd().split('\n').pop(),
    'capture : /depot/node_modules/.cache/vitest-run-7.txt',
  )
  // Un échec AVEC bilan est déjà raconté par le reporter : pas de redite.
  const avecBilan = resumeLancement({ statut: 1, bilan: true, queue: ['x'], capture: '/c.txt' })
  assert.equal(avecBilan, 'capture : /c.txt\n')
  assert.equal(
    resumeLancement({ statut: 0, bilan: true, queue: [], capture: '/c.txt' }),
    'capture : /c.txt\n',
  )
})

test('verdicts : signal et code absent valent échec, les deux côtés doivent réussir', () => {
  assert.equal(codeEnfant(0, null), 0)
  assert.equal(codeEnfant(1, null), 1)
  assert.equal(codeEnfant(null, 'SIGTERM'), 1)
  assert.equal(codeEnfant(0, 'SIGTERM'), 1)
  assert.equal(codeEnfant(null, null), 1)
  assert.equal(codeAgrege([0, 0]), 0)
  assert.equal(codeAgrege([0, 1]), 1)
  assert.equal(codeAgrege([1, 0]), 1)
  assert.equal(codeAgrege([0]), 0)
})

// Une ligne CANONIQUE par sentinelle, copiée du message de son émetteur (références aux sources
// dans `SENTINELLES`), préfixée comme la console la rend. Une sentinelle qui cesse de mordre —
// message d'amont réécrit, regex retouchée — rend un compte à zéro indiscernable d'un run sain :
// c'est ce silence-là que la table interdit.
const ECHANTILLONS = {
  'act hors act':
    'Warning: An update to CombatConsole inside a test was not wrapped in act(...).',
  'act chevauchants':
    'Warning: You seem to have overlapping act() calls, this is not supported. Be sure to await previous act() calls before making a new one. ',
  'unmount pendant rendu':
    'Warning: Attempted to synchronously unmount a root while React was already rendering. React cannot finish unmounting the root until the current render has completed, which may lead to a race condition.',
  'React coincé': 'Warning: Should not already be working.',
  'test expiré': ' FAIL  src/ui/x.test.tsx > cas > Error: Test timed out in 5000ms.',
  'worker perdu': 'Error: Worker exited unexpectedly',
}

test('sentinelles : chacune MORD sa ligne canonique, et elle seule', () => {
  assert.deepEqual(
    SENTINELLES.map(([libelle]) => libelle),
    Object.keys(ECHANTILLONS),
    'une sentinelle sans ligne canonique ne peut pas être prouvée mordante',
  )
  for (const [libelle, motif] of SENTINELLES) {
    assert.ok(motif.test(ECHANTILLONS[libelle]), `sentinelle muette sur sa ligne : ${libelle}`)
    for (const [autre, ligne] of Object.entries(ECHANTILLONS)) {
      if (autre === libelle) continue
      assert.ok(!motif.test(ligne), `sentinelle « ${libelle} » déborde sur « ${autre} »`)
    }
  }
  // La seconde graphie de « worker perdu », et une ligne banale qui ne doit rien déclencher.
  const [, motifWorker] = SENTINELLES.find(([l]) => l === 'worker perdu')
  assert.ok(motifWorker.test('FATAL ERROR: Reached heap limit — JS heap out of memory'))
  for (const [, motif] of SENTINELLES) assert.ok(!motif.test(' Test Files  1 passed (1)'))
})

test('comptage : cumul par libellé sur un mélange, zéros sur une sortie saine', () => {
  const melange = [
    ECHANTILLONS['act hors act'],
    ECHANTILLONS['act hors act'],
    '[jsdom] ' + ECHANTILLONS['React coincé'],
    ECHANTILLONS['test expiré'],
    ' Tests  3 passed (3)',
  ]
  assert.deepEqual(compterSentinelles(melange), {
    'act hors act': 2,
    'act chevauchants': 0,
    'unmount pendant rendu': 0,
    'React coincé': 1,
    'test expiré': 1,
    'worker perdu': 0,
  })
  assert.deepEqual(
    compterSentinelles([]),
    Object.fromEntries(SENTINELLES.map(([l]) => [l, 0])),
    'le compte vide doit porter les six libellés à zéro',
  )
})

test('bloc [diag] : trois lignes, mode et bornes RENDUS (jamais déduits des cœurs)', () => {
  const compte = compterSentinelles([ECHANTILLONS['test expiré']])
  const mesure = { cpus: 16, memGo: 31.9, memMaxGo: 12.75, rssMaxMo: 84.4, secondes: 97.83 }
  const mono = bilanDiagnostic(compte, { ...mesure, partage: false, maxWorkers: '4' })
  const lignes = mono.trimEnd().split('\n')
  assert.equal(lignes.length, 3)
  assert.equal(lignes[0], '[diag] machine : 16 cœurs · 31.9 Go · mono (seuil 7) · maxWorkers=4')
  assert.equal(
    lignes[1],
    '[diag] mémoire système max : 12.8 Go / 31.9 Go (40 %) · rss lanceur max 84 Mo · fenêtre 97.8 s',
  )
  assert.equal(
    lignes[2],
    '[diag] sentinelles : act hors act 0 · act chevauchants 0 · unmount pendant rendu 0 · React coincé 0 · test expiré 1 · worker perdu 0',
  )
  // À cœurs IDENTIQUES, le mode dépend du run (`--coverage` impose le mono à 16 cœurs).
  const partage = bilanDiagnostic(compte, { ...mesure, partage: true, maxWorkers: 'node 10+jsdom 5' })
  assert.match(partage, /^\[diag\] machine : 16 cœurs · 31\.9 Go · partagé \(seuil 7\) · maxWorkers=node 10\+jsdom 5$/m)
  assert.ok(mono.endsWith('\n'), 'le bloc doit clore sa dernière ligne')
})
