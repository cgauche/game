// Logique PURE du lanceur à deux processus (`scripts/test/run.mjs`) : partition par docblock,
// répartition des workers, routage d'un filtre, argv de l'enfant, verdicts. Le lancement lui-même
// se mesure par `npm test`.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  argumentsEnfant,
  cheminsGlobSuspects,
  codeAgrege,
  codeEnfant,
  cotesRequis,
  environnementDe,
  filtrerFichiers,
  partitionner,
  repartitionWorkers,
  separerArguments,
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
