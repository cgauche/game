// Contrat des LANES de `npm run gates` (#1679 L2 T1d) : les gates de `ci.yml` sont toutes placées,
// aucune lane n'écrit ce qu'une autre lit, `--serie` joue les mêmes, un enfant qui dépasse son
// plafond tombe AVEC SON ARBRE, le refus du verrou de suite se reconnaît à sa sortie — et la
// POLITIQUE D'ARRÊT comme le RÉSUMÉ se mesurent pour de bon, sur un dépôt jetable à trois gates
// factices (c'est ce que `principal({ racine, lanes, avant, ecritLu, journal })` rend possible).
//   node --test scripts/gates/toutes.test.mjs
import test from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  ATTENTE_VERROU,
  AVANT_LES_LANES,
  COEURS_SUITE_EN_LANES,
  ECRIT_LU,
  LANES,
  TIMEOUTS,
  conflitsEntreLanes,
  coutEstime,
  descendantsDe,
  estRefusDuVerrou,
  fichierDeSortie,
  lanesAJouer,
  limiteDe,
  photoArbre,
  principal,
  queue,
  spawnBorne,
  refusDeCouverture,
  tuerArbre,
} from './toutes.mjs'
import { cleTree, cleTreeComplete, ecrireJustificatif, gatesRequises } from '../guards/lib/justificatif.mjs'
import { refusVerrou } from '../test/verrou.mjs'
import { coeurs, repartitionWorkers } from '../test/partition.mjs'

const NOMS = gatesRequises().map((g) => g.nom)
const gate = (nom) => ({ nom, commande: `npm run ${nom}` })

test('toute gate de ci.yml a une place — une lane, ou la phase série des écrivains', () => {
  assert.deepEqual(refusDeCouverture(NOMS), [], 'LANES / AVANT_LES_LANES / ECRIT_LU ne couvrent pas ci.yml')
  const placees = [...LANES.flatMap((l) => l.gates), ...AVANT_LES_LANES]
  assert.equal(placees.length, NOMS.length, `${NOMS.length} gates dans ci.yml, ${placees.length} placées`)
  assert.equal(new Set(placees).size, placees.length, 'une gate placée deux fois')
})

test('la couverture est un DÉTECTEUR : une gate déplacée hors de toute place est nommée', () => {
  const ampute = LANES.map((l) => (l.nom === 'types' ? { ...l, gates: l.gates.filter((g) => g !== 'lint') } : l))
  const refus = refusDeCouverture(NOMS, ampute)
  assert.equal(refus.length, 1, refus.join(' · '))
  assert.match(refus[0], /^lint : gate de ci\.yml sans place/)

  const inconnue = [...LANES, { nom: 'neuve', gates: ['gate-qui-nexiste-pas'] }]
  assert.match(refusDeCouverture(NOMS, inconnue).join('\n'), /gate-qui-nexiste-pas : nommée par la lane neuve/)
  assert.match(
    refusDeCouverture(['vigie'], [{ nom: 'seule', gates: ['vigie'] }], {}, []).join('\n'),
    /vigie : aucune entrée ÉCRIT\/LU/,
  )
  // Une gate à la fois en lane ET en phase série serait jouée deux fois.
  assert.match(
    refusDeCouverture(['x'], [{ nom: 'l', gates: ['x'] }], { x: { ecrit: [], lit: [] } }, ['x']).join('\n'),
    /x : placée deux fois/,
  )
})

test('aucune lane n’écrit ce qu’une AUTRE lit — les écrivains ont quitté les lanes', () => {
  assert.deepEqual(conflitsEntreLanes(), [])
  for (const lane of LANES)
    for (const g of lane.gates)
      assert.deepEqual(ECRIT_LU[g].ecrit, [], `${g} écrit à chaque run : sa place est AVANT_LES_LANES`)
})

test('le détecteur de course VOIT : un écrivain remis en lane rouvre le conflit', () => {
  // MORSURE : `raw:coverage` ÉCRIT docs/raw/coverage.md (ECRIT_LU le dit) et la suite LIT docs/.
  // Remis dans la lane docs, le conflit doit être nommé — sinon la table ne protège plus rien.
  const lanes = LANES.map((l) => (l.nom === 'docs' ? { ...l, gates: [...l.gates, 'raw:coverage'] } : l))
  const ecritLu = { ...ECRIT_LU, 'raw:coverage': { ...ECRIT_LU['raw:coverage'], ecrit: ['docs/raw/coverage.md'] } }
  assert.match(
    conflitsEntreLanes(lanes, ecritLu).join('\n'),
    /lane docs : raw:coverage ÉCRIT docs\/raw\/coverage\.md · lane suite : test LIT docs\//,
  )
})

test('chaque gate porte une RAISON, et chaque écriture fermée porte SA porte', () => {
  for (const nom of NOMS) {
    const e = ECRIT_LU[nom]
    assert.ok(e.raison?.length > 20, `${nom} : raison absente ou creuse`)
    for (const [chemin, porte] of Object.entries(e.ecritFerme ?? {}))
      assert.ok(porte?.length > 40, `${nom} : « ${chemin} » est fermé sans dire par quoi`)
  }
})

test('--serie joue EXACTEMENT les mêmes gates que les lanes, dans l’ordre de ci.yml', () => {
  const aJouer = NOMS.map(gate)
  assert.deepEqual(lanesAJouer(aJouer, { serie: true })[0].gates, NOMS)
  const sous = ['test', 'lint', 'docs:check'].map(gate)
  assert.deepEqual(lanesAJouer(sous, { serie: true })[0].gates, ['test', 'lint', 'docs:check'])
  assert.deepEqual(new Set(lanesAJouer(sous).flatMap((l) => l.gates)), new Set(['test', 'lint', 'docs:check']))
  assert.deepEqual(lanesAJouer(sous).map((l) => l.nom), ['suite', 'types', 'docs'], 'une lane vide ne se lance pas')
})

test('un plafond par gate, jamais un défaut muet', () => {
  assert.equal(limiteDe('gate-inconnue'), TIMEOUTS.defaut * 1000)
  assert.equal(limiteDe('test'), TIMEOUTS.test * 1000)
  assert.ok(TIMEOUTS.test > TIMEOUTS.defaut)
  assert.ok(TIMEOUTS['docs:check'] >= 629, 'docs:check vaut 209,4 s quand il rejoue tout — ×3 = 629 s au moins')
})

test('un enfant qui dépasse son plafond est EXPIRÉ, et son ARBRE tombe avec lui', async () => {
  const base = mkdtempSync(join(tmpdir(), 'gates-timeout-'))
  try {
    // Le PETIT-FILS écrit un témoin toutes les 200 ms : s'il survit au plafond, le fichier grossit
    // encore APRÈS. Il est spawné `detached` — sans quoi Windows le met dans le job du parent et un
    // simple `enfant.kill()` l'emporterait aussi, ce qui rendrait cette mesure aveugle (vérifié :
    // sans `detached`, remplacer `tuerArbre` par `enfant.kill()` laisse le test VERT).
    const temoin = join(base, 'temoin.txt')
    writeFileSync(
      join(base, 'petit-fils.mjs'),
      `import { appendFileSync } from 'node:fs'\n` +
        `setInterval(() => appendFileSync(${JSON.stringify(temoin)}, 'x'), 200)\n`,
    )
    writeFileSync(
      join(base, 'parent.mjs'),
      `import { spawn } from 'node:child_process'\n` +
        `spawn(process.execPath, [${JSON.stringify(join(base, 'petit-fils.mjs'))}], ` +
        `{ stdio: 'ignore', detached: true }).unref()\n` +
        `setInterval(() => {}, 1000)\n`,
    )
    const r = await spawnBorne({ argv: [join(base, 'parent.mjs')], fichier: join(base, 'sortie.txt'), limiteMs: 1500, cwd: base })
    assert.equal(r.expiree, true, 'le plafond n’a pas mordu')
    assert.notEqual(r.code, 0, 'un enfant tué ne réussit pas')
    const apresMort = readFileSync(temoin, 'utf8').length
    await new Promise((patienter) => setTimeout(patienter, 1200))
    assert.equal(
      readFileSync(temoin, 'utf8').length,
      apresMort,
      'le PETIT-FILS écrit encore : l’arbre n’a pas été tué, il garderait le verrou de suite et des cœurs',
    )
  } finally {
    rmSync(base, { recursive: true, force: true })
  }
})

// Sortie `ps -A -o pid=,ppid=` telle que Linux la rend : colonnes alignées à droite, largeur variable.
// L'arbre posé : 100 → 200 → {300, 301}, 300 → 400 ; 999 est un étranger, 1 est le père de tous.
const PS_FIXTURE = [
  '    1     0',
  '  100     1',
  '  200   100',
  '  300   200',
  '  301   200',
  '  400   300',
  '  999     1',
  'entete illisible',
  '',
].join('\n')

test('la descendance se lit dans `ps`, LES FEUILLES D’ABORD', () => {
  const ordre = descendantsDe(100, PS_FIXTURE)
  assert.deepEqual(new Set(ordre), new Set([200, 300, 301, 400]), '999 n’est pas de la famille')
  // Chaque parent vient APRÈS ses enfants : tuer une feuille déjà orpheline est sans effet.
  assert.ok(ordre.indexOf(400) < ordre.indexOf(300), '400 est fils de 300')
  assert.ok(ordre.indexOf(300) < ordre.indexOf(200), '300 est fils de 200')
  assert.ok(ordre.indexOf(301) < ordre.indexOf(200), '301 est fils de 200')
  assert.deepEqual(descendantsDe(400, PS_FIXTURE), [], 'une feuille n’a pas de descendance')
  assert.deepEqual(descendantsDe(100, ''), [], 'sans `ps`, on retombe sur le groupe seul')
})

test('INVARIANT de la descendance : chaque enfant vient AVANT son parent, quelle que soit sa profondeur', () => {
  // « Les feuilles d'abord » est plus FAIBLE que ce qui compte : une feuille peu profonde (500, fille
  // directe de 100) n'a aucune raison de précéder un petit-fils (400). Ce qui doit tenir, c'est que
  // personne ne soit tué avant sa descendance — sinon un orphelin se ré-attache et survit.
  const ps = ['  200   100', '  300   200', '  400   300', '  500   100', '  900   999'].join('\n')
  const ordre = descendantsDe(100, ps)
  assert.deepEqual(new Set(ordre), new Set([200, 300, 400, 500]))
  for (const [enfant, parent] of [[200, 100], [300, 200], [400, 300], [500, 100]]) {
    const iParent = ordre.indexOf(parent)
    assert.ok(
      ordre.indexOf(enfant) < iParent || iParent === -1,
      `${enfant} (fils de ${parent}) est tué APRÈS son parent : ordre ${ordre.join(',')}`,
    )
  }
  assert.ok(!ordre.includes(900), 'un pid HORS de l’arbre ne doit jamais être visé')
})

test('la descendance ne boucle pas sur un `ps` qui se contredit', () => {
  // Vu en vrai : un processus dont le ppid est lui-même, et un cycle 10 → 11 → 10.
  assert.deepEqual(descendantsDe(7, '    7     7\n'), [])
  assert.deepEqual(new Set(descendantsDe(10, '   11    10\n   10    11\n')), new Set([11]))
})

test('sur POSIX, on tue la DESCENDANCE, puis le fils, puis son groupe', () => {
  // MORSURE de la CI ubuntu (run 33866600011) : `process.kill(-pid)` seul ne frappe que le groupe du
  // fils, et un petit-fils `detached` a le SIEN — il survivait. L’ordre est vérifiable ici, sous
  // Windows ; que les signaux portent, seule la CI POSIX peut le prouver.
  const tues = []
  tuerArbre(100, { plateforme: 'linux', lister: () => PS_FIXTURE, tuer: (p) => tues.push(p) })
  assert.equal(tues.at(-1), -100, 'le GROUPE se tire en dernier : il rattrape ce qui naît après `ps`')
  assert.equal(tues.at(-2), 100, 'le fils tombe après sa descendance')
  assert.ok(tues.includes(400) && tues.includes(301), 'les petits-fils doivent tomber')
  assert.ok(tues.indexOf(400) < tues.indexOf(300), 'les feuilles d’abord')
  assert.deepEqual(tues.slice(0, -2).sort((a, b) => a - b), [200, 300, 301, 400])
})

test('sur win32, `taskkill /T` suffit : aucune énumération', () => {
  let liste = 0
  tuerArbre(0, { plateforme: 'win32', lister: () => { liste += 1; return PS_FIXTURE } })
  // PID hors de la plage Windows : `taskkill` le refuse, aucun processus réel n'est visé.
  tuerArbre(4294967295, { plateforme: 'win32', lister: () => { liste += 1; return PS_FIXTURE }, tuer: () => {} })
  assert.equal(liste, 0, '`ps` n’existe pas sous Windows, et la filiation y est déjà suivie par taskkill')
})

test('un enfant qui finit sous son plafond rend son code et sa sortie', async () => {
  const base = mkdtempSync(join(tmpdir(), 'gates-ok-'))
  try {
    writeFileSync(join(base, 'court.mjs'), "console.log('bonjour')\nprocess.exit(3)\n")
    const r = await spawnBorne({ argv: [join(base, 'court.mjs')], fichier: join(base, 'sortie.txt'), limiteMs: 30_000, cwd: base })
    assert.equal(r.expiree, false)
    assert.equal(r.code, 3)
    assert.match(r.sortie, /bonjour/)
  } finally {
    rmSync(base, { recursive: true, force: true })
  }
})

test('le refus du VERROU DE SUITE se reconnaît sur le message RÉEL, pas sur le code seul', () => {
  const verrouFictif = join(tmpdir(), 'wfrp-suite.lock')
  const message = refusVerrou({
    chemin: verrouFictif,
    tenant: { pid: 4242, commande: 'node scripts/test/run.mjs', cwd: join(tmpdir(), 'autre-arbre') },
  })
  assert.equal(estRefusDuVerrou(2, `${message}\n`), true, 'le message de scripts/test/verrou.mjs n’est pas reconnu')
  assert.equal(estRefusDuVerrou(2, '[gate] usage : node scripts/gates/justifie.mjs <gate> …\n'), false)
  assert.equal(estRefusDuVerrou(1, `${message}\n`), false, 'seul l’exit 2 du lanceur dit « rien joué »')
  assert.equal(
    estRefusDuVerrou(2, `[verrou] verrou disputé (${verrouFictif}) : un autre lanceur le reprend en boucle — relancer.\n`),
    true,
  )
  assert.ok(ATTENTE_VERROU.borneMs > ATTENTE_VERROU.pasMs, 'une borne au-dessous du pas n’attendrait jamais')
})

test('la SUITE est bornée pendant les lanes, par la couture qui existe déjà', () => {
  assert.ok(COEURS_SUITE_EN_LANES > 0 && COEURS_SUITE_EN_LANES < 16)
  assert.equal(coeurs({ WFRP_TEST_COEURS: String(COEURS_SUITE_EN_LANES) }, () => 16), COEURS_SUITE_EN_LANES)
  const borne = repartitionWorkers(COEURS_SUITE_EN_LANES)
  const plein = repartitionWorkers(16)
  assert.ok(borne.node + borne.jsdom < plein.node + plein.jsdom, 'la borne ne borne rien')
})

test('une sortie de gate porte un nom de fichier LÉGAL sous NTFS', () => {
  assert.equal(fichierDeSortie('docs:check', 123), 'docs%3Acheck-123.txt')
  for (const nom of NOMS) assert.ok(!fichierDeSortie(nom, 1).includes(':'), `${nom} : « : » est un flux ADS sous NTFS`)
})

test('la queue d’un rouge rend les DERNIÈRES lignes utiles', () => {
  assert.deepEqual(queue('a\n\nb\n\n\nc\n', 2), ['b', 'c'])
  assert.deepEqual(queue('seule\n', 40), ['seule'])
})

test('une photo de l’arbre IMPOSSIBLE ne LÈVE pas : elle se rend', () => {
  const base = mkdtempSync(join(tmpdir(), 'sans-git-'))
  try {
    const photo = photoArbre(base)
    assert.equal(photo.texte, null)
    assert.ok(photo.erreur, 'une photo impossible doit porter sa cause')
  } finally {
    rmSync(base, { recursive: true, force: true })
  }
})

test('le coût estimé d’une gate sautée vient du dernier run, ou se dit inconnu', () => {
  assert.equal(coutEstime({ test: 275.1 }, 'test'), '~275.1 s au dernier run')
  assert.equal(coutEstime({}, 'test'), 'coût inconnu')
})

/**
 * Dépôt jetable : un `ci.yml` de gates FACTICES, un `package.json` qui les porte, un commit.
 * `principal` y est joué pour de vrai — c'est la seule façon de mesurer la politique d'arrêt et le
 * résumé sans payer les vraies gates.
 */
function depotDeGates(gatesFactices) {
  const racine = mkdtempSync(join(tmpdir(), 'gates-e2e-'))
  const git = (...args) => execFileSync('git', args, { cwd: racine, encoding: 'utf8' })
  mkdirSync(join(racine, '.github', 'workflows'), { recursive: true })
  writeFileSync(
    join(racine, '.github', 'workflows', 'ci.yml'),
    ['name: CI', 'jobs:', '  build:', '    steps:', ...gatesFactices.map((g) => `      - run: npm run ${g.nom}`), ''].join('\n'),
  )
  const scripts = { gen: 'node gen.mjs' }
  writeFileSync(join(racine, 'gen.mjs'), '\n')
  for (const g of gatesFactices) {
    // `:` sépare un flux de données alternatif sous NTFS : `docs:check.mjs` y est un nom illégal.
    const fichier = `${g.nom.replace(/:/g, '-')}.mjs`
    scripts[g.nom] = `node ${fichier}`
    writeFileSync(join(racine, fichier), g.corps)
  }
  writeFileSync(join(racine, 'package.json'), `${JSON.stringify({ name: 'jetable', version: '0.0.0', scripts }, null, 2)}\n`)
  git('init', '-q')
  git('config', 'user.email', 'test@local')
  git('config', 'user.name', 'test')
  git('add', '-A')
  git('commit', '-qm', 'jetable')
  return { racine, git }
}

const LENTE = "setTimeout(() => { console.log('fini'); process.exit(0) }, 2500)\n"

test('un ROUGE rapide n’empêche pas les lanes en cours de FINIR, et le résumé les nomme toutes', async () => {
  const { racine } = depotDeGates([
    { nom: 'lente', corps: LENTE },
    { nom: 'rouge', corps: "console.error('ce rouge est le sujet')\nprocess.exit(4)\n" },
    { nom: 'apres', corps: LENTE },
    { nom: 'lente2', corps: LENTE },
  ])
  try {
    const lignes = []
    const code = await principal({
      racine,
      argv: ['node', 'toutes.mjs'],
      journal: (t) => lignes.push(t),
      // `rouge` et `apres` dans la MÊME lane : la première tombe, la seconde est SAUTÉE ; les deux
      // autres lanes tournaient déjà et doivent aller au bout.
      lanes: [
        { nom: 'a', gates: ['lente'] },
        { nom: 'b', gates: ['rouge', 'apres'] },
        { nom: 'c', gates: ['lente2'] },
      ],
      avant: [],
      ecritLu: Object.fromEntries(['lente', 'rouge', 'apres', 'lente2'].map((n) => [n, { ecrit: [], lit: [] }])),
    })
    const sortie = lignes.join('')
    assert.equal(code, 1, 'un rouge doit rendre 1')
    assert.match(sortie, /——— résumé ———/)
    // Le code de sortie de CHAQUE gate est imprimé : `build` a rendu ROUGE sans une ligne exploitable.
    assert.match(sortie, /\[gates\] rouge — ROUGE \(exit 4\) — /)
    assert.match(sortie, /\[gates\] lente — vert \(exit 0\) — /, 'la lane a a été coupée par un rouge d’ailleurs')
    assert.match(sortie, /\[gates\] lente2 — vert \(exit 0\) — /, 'la lane c a été coupée par un rouge d’ailleurs')
    assert.match(sortie, /\[gates\] apres — sautée — 0\.0 s — rouge ROUGE \(exit 4\) — coût inconnu/)
    assert.match(sortie, /ce rouge est le sujet/, 'la queue du rouge doit être imprimée')
    assert.match(sortie, /0 spawn rejoué/)
  } finally {
    rmSync(racine, { recursive: true, force: true })
  }
})

test('le RÉSUMÉ s’imprime même si la photo de fin devient impossible', async () => {
  // Le 2026-09-04, `git status` a rendu STATUS_DLL_INIT_FAILED APRÈS sept minutes de gates : l'appel
  // levait, et vingt-deux verdicts payés n'ont jamais été imprimés. Ici la gate emporte le `.git`.
  const { racine } = depotDeGates([
    { nom: 'saborde', corps: `import { renameSync } from 'node:fs'\nrenameSync(${JSON.stringify(join('.git'))}, '.git-parti')\n` },
  ])
  try {
    const lignes = []
    const code = await principal({
      racine,
      argv: ['node', 'toutes.mjs'],
      journal: (t) => lignes.push(t),
      lanes: [{ nom: 'a', gates: ['saborde'] }],
      avant: [],
      ecritLu: { saborde: { ecrit: [], lit: [] } },
    })
    const sortie = lignes.join('')
    assert.match(sortie, /——— résumé ———/, 'le résumé doit être imprimé AVANT la photo de fin')
    assert.match(sortie, /\[gates\] saborde — vert \(exit 0\)/)
    assert.match(sortie, /photo de l'arbre IMPOSSIBLE/)
    assert.equal(code, 0, 'une photo impossible se DIT, elle ne fabrique pas un rouge')
  } finally {
    rmSync(racine, { recursive: true, force: true })
  }
})

test('une gate de la phase SÉRIE qui réécrit l’arbre est REFUSÉE, en nommant le fichier', async () => {
  const { racine } = depotDeGates([
    { nom: 'ecrivain', corps: `import { writeFileSync } from 'node:fs'\nwriteFileSync('rapport.md', 'périmé\\n')\n` },
    { nom: 'lecteur', corps: LENTE },
  ])
  try {
    writeFileSync(join(racine, 'rapport.md'), 'à jour\n')
    execFileSync('git', ['add', '-A'], { cwd: racine })
    execFileSync('git', ['commit', '-qm', 'rapport'], { cwd: racine })
    const lignes = []
    const code = await principal({
      racine,
      argv: ['node', 'toutes.mjs'],
      journal: (t) => lignes.push(t),
      lanes: [{ nom: 'a', gates: ['lecteur'] }],
      avant: ['ecrivain'],
      ecritLu: { ecrivain: { ecrit: ['rapport.md'], lit: [] }, lecteur: { ecrit: [], lit: ['rapport.md'] } },
    })
    const sortie = lignes.join('')
    assert.equal(code, 1)
    assert.match(sortie, /« ecrivain » a RÉÉCRIT l'arbre/)
    assert.match(sortie, /rapport\.md/, 'le refus doit NOMMER le fichier réécrit')
    assert.match(sortie, /——— résumé ———/)
    // Le lecteur n'a jamais démarré : l'écrivain a tranché AVANT les lanes, pas sept minutes plus tard.
    assert.match(sortie, /\[gates\] lecteur — sautée/)
  } finally {
    rmSync(racine, { recursive: true, force: true })
  }
})

test('un doc committé PÉRIME les gates à clé pleine — le lanceur les redonne à jouer, pas les autres', async () => {
  // Défaut mesuré sur fdf62479e : `npm run gates` disait « rien à jouer » pour 22 gates, et le
  // pre-push en refusait 11 (« gate « docs:check » jouée sur un AUTRE arbre »). Le lanceur ne
  // connaissait que la clé PARTIELLE, qu'un commit de `docs/` ne change pas.
  const { racine, git } = depotDeGates([
    { nom: 'docs:check', corps: '\n' },
    { nom: 'lint', corps: '\n' },
  ])
  try {
    for (const nom of ['docs:check', 'lint']) ecrireJustificatif({ cwd: racine, gate: nom, sha: 'HEAD' })
    // Un commit qui ne touche QUE `docs/` : la clé partielle ne bouge pas, la clé complète oui.
    mkdirSync(join(racine, 'docs'), { recursive: true })
    writeFileSync(join(racine, 'docs', 'note.md'), 'régénéré\n')
    git('add', '-A')
    git('commit', '-qm', 'docs seuls')
    assert.equal(cleTree('HEAD~1', { cwd: racine }), cleTree('HEAD', { cwd: racine }), 'la clé partielle doit être la même')
    assert.notEqual(
      cleTreeComplete('HEAD~1', { cwd: racine }),
      cleTreeComplete('HEAD', { cwd: racine }),
      'la clé complète doit avoir bougé',
    )

    const lignes = []
    const code = await principal({
      racine,
      argv: ['node', 'toutes.mjs', '--liste'],
      journal: (t) => lignes.push(t),
      lanes: [{ nom: 'a', gates: ['docs:check', 'lint'] }],
      avant: [],
      ecritLu: { 'docs:check': { ecrit: [], lit: [] }, lint: { ecrit: [], lit: [] } },
    })
    const sortie = lignes.join('')
    assert.equal(code, 0)
    assert.match(
      sortie,
      /\[gates\] docs:check — gate « docs:check » jouée sur un AUTRE arbre : elle lit docs\/[^\n]*— la rejouer : npm run docs:check/,
      'une gate de RAISON_CLE_COMPLETE doit être redonnée à jouer, en se nommant',
    )
    assert.match(sortie, /\[gates\] lint — déjà justifiée sur ce contenu/, 'une gate hors table reste justifiée')
  } finally {
    rmSync(racine, { recursive: true, force: true })
  }
})
