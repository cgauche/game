// Contrat de la fixture de dépôt : une INSTANCE est un dépôt git RÉEL et indépendant, à l'octet
// près celui du gabarit — c'est ce qui autorise à ne fabriquer l'état de départ qu'une fois.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { isAbsolute, join, sep } from 'node:path'
import { gabaritDeDepot, instanceDeDepot } from './depotGabarit.mjs'
import { listerDossier } from './lister.mjs'

const git = (cwd) => (args) => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim()

const PARAMS = {
  fichiers: { 'src/a.ts': 'export const a = 1\n', 'lu/b.txt': 'b\n' },
  branche: 'principale',
  origin: 'https://github.com/cgauche/game.git',
  message: 'fondation',
  refs: { 'refs/remotes/origin/main': 'HEAD' },
}

const jeter = (racine) => rmSync(racine, { recursive: true, force: true })

test('deux instances du même contenu : même sha, racines distinctes, arbre identique', () => {
  const un = instanceDeDepot(PARAMS)
  const deux = instanceDeDepot(PARAMS)
  try {
    assert.notEqual(un.racine, deux.racine)
    assert.equal(un.sha, deux.sha)
    assert.equal(git(un.racine)(['rev-parse', 'HEAD']), un.sha)
    assert.equal(git(deux.racine)(['rev-parse', 'HEAD']), un.sha)
    assert.equal(readFileSync(join(deux.racine, 'src/a.ts'), 'utf8'), 'export const a = 1\n')
    assert.equal(git(un.racine)(['rev-parse', '--abbrev-ref', 'HEAD']), 'principale')
    assert.equal(git(un.racine)(['status', '--porcelain']), '', 'une instance neuve est un arbre PROPRE')
    assert.equal(git(un.racine)(['remote', 'get-url', 'origin']), PARAMS.origin)
  } finally {
    jeter(un.racine)
    jeter(deux.racine)
  }
})

test('muter une instance (commit) ne touche ni le gabarit ni l’autre instance', () => {
  const gabarit = gabaritDeDepot(PARAMS)
  const un = instanceDeDepot(PARAMS)
  const deux = instanceDeDepot(PARAMS)
  try {
    writeFileSync(join(un.racine, 'src/a.ts'), 'export const a = 2\n', 'utf8')
    const g = git(un.racine)
    g(['add', '-A'])
    g(['commit', '-q', '-m', 'mutation'])

    assert.notEqual(g(['rev-parse', 'HEAD']), un.sha, 'l’instance mutée doit avoir avancé')
    assert.equal(git(deux.racine)(['rev-parse', 'HEAD']), un.sha, 'l’autre instance a bougé')
    assert.equal(git(gabarit.racine)(['rev-parse', 'HEAD']), gabarit.sha, 'le gabarit a bougé')
    assert.equal(
      readFileSync(join(gabarit.racine, 'src/a.ts'), 'utf8'),
      'export const a = 1\n',
      'le contenu du gabarit a été réécrit par une instance',
    )
    assert.equal(git(deux.racine)(['status', '--porcelain']), '', 'l’autre instance a été salie')
  } finally {
    jeter(un.racine)
    jeter(deux.racine)
  }
})

test('les refs demandées sont posées dans l’instance', () => {
  const { racine, sha } = instanceDeDepot(PARAMS)
  try {
    assert.equal(git(racine)(['rev-parse', 'refs/remotes/origin/main']), sha)
  } finally {
    jeter(racine)
  }
})

test('`core.hooksPath` pointe hors de tout hook, DANS l’instance : aucun hook de la machine hôte ne tire', () => {
  const { racine } = instanceDeDepot(PARAMS)
  try {
    const hooks = git(racine)(['config', '--default', '', '--get', 'core.hooksPath'])
    assert.notEqual(hooks, '', 'aucun `core.hooksPath` : les hooks du dépôt hôte pourraient tirer')
    assert.equal(isAbsolute(hooks), false, `\`core.hooksPath\` = ${hooks} : un chemin ABSOLU sort de l’instance`)
    const resolu = git(racine)(['rev-parse', '--path-format=absolute', '--git-path', 'hooks'])
    assert.equal(
      resolu.replace(/\//g, sep).startsWith(racine + sep), true,
      `le dossier de hooks ${resolu} est résolu HORS de l’instance ${racine}`,
    )
    assert.equal(existsSync(join(racine, hooks)), false, `le dossier de hooks ${hooks} existe dans l’instance`)
    assert.equal(existsSync(join(racine, '.git', 'hooks', 'pre-commit')), false)
  } finally {
    jeter(racine)
  }
})

test('`commit: false` : un dépôt initialisé, fichiers sur le disque, HORS index et sans HEAD', () => {
  const { racine, sha } = instanceDeDepot({ ...PARAMS, refs: {}, commit: false })
  try {
    assert.equal(sha, null)
    assert.equal(readFileSync(join(racine, 'src/a.ts'), 'utf8'), 'export const a = 1\n')
    assert.deepEqual(
      git(racine)(['status', '--porcelain']).split('\n').sort(),
      ['?? lu/', '?? src/'],
      'les fichiers devraient être NON SUIVIS',
    )
    assert.throws(() => git(racine)(['rev-parse', '--verify', 'HEAD']), /Command failed/, 'un dépôt sans commit ne doit résoudre AUCUN HEAD')
  } finally {
    jeter(racine)
  }
})

test('MÉMO : deux appels de mêmes paramètres ne construisent qu’UN gabarit', () => {
  const un = gabaritDeDepot(PARAMS)
  const deux = gabaritDeDepot({ ...PARAMS })
  assert.equal(deux.racine, un.racine, 'un second gabarit a été construit pour le même contenu')
  assert.equal(deux.sha, un.sha)

  const autre = gabaritDeDepot({ ...PARAMS, fichiers: { 'src/a.ts': 'export const a = 9\n' } })
  assert.notEqual(autre.racine, un.racine, 'un contenu différent doit avoir SON gabarit')
  assert.notEqual(autre.sha, un.sha)
})

// ── Sonde A : une construction qui échoue ne laisse RIEN sous os.tmpdir() ─────────────────────────
/**
 * Une construction jouée dans un process ENFANT dont `os.tmpdir()` est un dossier À LUI (`TEMP`/
 * `TMP`/`TMPDIR`) : ce qui reste dans ce dossier a été laissé par CETTE construction, et par aucune
 * autre. Le `os.tmpdir()` de la machine est un magasin PARTAGÉ — les fichiers de `test:hooks`
 * tournent en parallèle et y fabriquent leurs propres gabarits.
 * @returns {{ sortie: string, restes: string[] }} sortie de l'enfant, enfants du dossier isolé.
 */
function constructionIsolee(params) {
  const isole = mkdtempSync(join(tmpdir(), 'isole-'))
  try {
    const module = new URL('./depotGabarit.mjs', import.meta.url).href
    const source = `import { gabaritDeDepot } from ${JSON.stringify(module)}\n`
      + `try { gabaritDeDepot(${JSON.stringify(params)}); console.log('AUCUNE ERREUR') }\n`
      + 'catch (e) { console.log(\'ERREUR \' + e.message.split(\'\\n\')[0]) }\n'
    const r = spawnSync(process.execPath, ['--input-type=module', '-e', source], {
      encoding: 'utf8', env: { ...process.env, TEMP: isole, TMP: isole, TMPDIR: isole },
    })
    assert.equal(r.status, 0, `l’enfant a quitté en ${r.status} : ${r.stderr}`)
    return { sortie: r.stdout.trim(), restes: listerDossier(isole) }
  } finally {
    rmSync(isole, { recursive: true, force: true })
  }
}

test('A : `refs` sans `commit` est REFUSÉ en nommant, et aucun gabarit n’est fabriqué', () => {
  const { sortie, restes } = constructionIsolee({
    fichiers: { 'a.txt': 'sonde A\n' }, refs: { 'refs/heads/x': 'HEAD' }, commit: false,
  })
  assert.match(sortie, /^ERREUR .*`refs`.*`commit: true`$/)
  assert.deepEqual(restes, [], 'un gabarit a été fabriqué pour une demande REFUSÉE')
})

test('A : une construction qui ÉCHOUE en vol efface son dossier avant de relancer l’erreur', () => {
  // `refs` visant une cible que le dépôt ne résout pas : l'échec tombe APRÈS `git init`, donc après
  // que le dossier existe — c'est le seul cas qui éprouve le nettoyage.
  const { sortie, restes } = constructionIsolee({
    fichiers: { 'a.txt': 'sonde A2\n' }, refs: { 'refs/heads/x': 'jamais-vu' },
  })
  assert.match(sortie, /^ERREUR /)
  assert.deepEqual(restes, [], 'le dossier du gabarit en échec est resté sous os.tmpdir()')
})

// ── Sonde B : l'instance porte l'HISTOIRE, pas une empreinte d'arbre ──────────────────────────────
test('B : l’instance est un dépôt HISTORIQUE complet (objets, refs, graphe) et sain', () => {
  const { racine, sha } = instanceDeDepot(PARAMS)
  try {
    const g = git(racine)
    assert.equal(g(['cat-file', '-t', sha]), 'commit', 'le sha de fondation n’est pas un objet commit de l’instance')
    assert.equal(g(['show', `${sha}:src/a.ts`]), 'export const a = 1', 'le contenu ne se relit pas DEPUIS l’objet')
    assert.equal(g(['rev-list', '--count', 'HEAD']), '1')
    assert.equal(g(['merge-base', 'HEAD', 'refs/remotes/origin/main']), sha, 'les deux refs ne partagent pas l’histoire')
    assert.equal(g(['log', '-1', '--format=%s']), PARAMS.message)

    const fsck = spawnSync('git', ['fsck', '--no-progress'], { cwd: racine, encoding: 'utf8' })
    assert.equal(fsck.status, 0, `git fsck a refusé l’instance : ${fsck.stderr}`)
    assert.doesNotMatch(fsck.stderr + fsck.stdout, /missing|broken|corrupt/i)

    // Une histoire VIVANTE : l'instance sait committer par-dessus sa fondation, qui reste son parent.
    writeFileSync(join(racine, 'src/a.ts'), 'export const a = 3\n', 'utf8')
    g(['add', '-A'])
    g(['commit', '-q', '-m', 'suite'])
    assert.equal(g(['rev-list', '--count', 'HEAD']), '2')
    assert.equal(g(['rev-parse', 'HEAD~1']), sha)
  } finally {
    jeter(racine)
  }
})
