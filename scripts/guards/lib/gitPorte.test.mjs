// L'UNION À TROIS ISSUES, mesurée contre git RÉEL sur un dépôt jetable — jamais sur un double :
// c'est le CLASSEMENT des sorties de git qui doit être juste, et git seul dit ce qu'il écrit.
// Sonde d'origine (2026-09-05) : 13 cas, dont deux motifs que la première liste ne portait pas
// (`bad object`, `Invalid revision range`) et qui auraient classé « git en panne » deux absences.
import { test } from 'node:test'
import { Buffer } from 'node:buffer'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { STATUS_DLL_INIT_FAILED } from './spawnResilient.mjs'
import {
  GitIndisponible, INDEX, SUIVI, TRAVAIL, arbrePrincipal, ceQueFaitLeCommit, cheminsDe, classer, lecteurGit, eolsDe, etatsDe, nameStatusDe, numstatDe, commitsDe, enfantsDirects, estAncetre, estRepertoire, fetchOrigin,
  fichiersDuGrep, lireGit, lireEnLot, listerImage, natureDuChemin, raisonCourte, sortieOuNull,
} from './gitPorte.mjs'
import { envDeDepotForge, instanceDeDepot } from './depotGabarit.mjs'
import { sourceGit } from './cssImages.mjs'
import { parUnitesDeCode } from './lister.mjs'

const ZERO = '0'.repeat(40)

/** Dépôt jetable de DEUX commits : le second AJOUTE `neuf.txt` — la pre-image de ce fichier est le
 *  cas normal de la porte de stock, et c'est un ABSENT, pas une panne. */
function depot() {
  const { racine, sha: premier } = instanceDeDepot({ fichiers: { 'a.txt': 'a\n' }, message: 'un' })
  const g = (...a) => execFileSync('git', a, { cwd: racine, env: envDeDepotForge(), encoding: 'utf8' })
  writeFileSync(join(racine, 'neuf.txt'), 'n\n')
  g('add', '-A'); g('commit', '-q', '-m', 'deux')
  return { racine, premier, second: g('rev-parse', 'HEAD').trim(), g }
}

const jeter = (racine) => rmSync(racine, { recursive: true, force: true })

// Le SPAWN QUI N'A PAS DÉMARRÉ (#1729) : node écrit le même « spawnSync git ENOENT » quand le
// binaire manque et quand le `cwd` demandé n'existe pas. Le second est le cas RÉEL mesuré : une
// porte y renvoyait « rejouer depuis un arbre où git répond » alors que git répondait.
test('lireGit : un cwd INEXISTANT se nomme, il ne se confond pas avec un git absent', () => {
  const jamais = join(tmpdir(), `cwd-absent-${process.pid}`)
  const vu = lireGit(['rev-parse', 'HEAD'], { cwd: jamais })
  assert.equal(vu.disponible, false)
  assert.equal(vu.raison, `cwd inexistant : ${jamais}`)

  const sansGit = classer({ error: new Error('spawnSync git ENOENT') }, { cwd: tmpdir() })
  assert.match(sansGit.raison, /git introuvable/, 'cwd répertoire → la cause restante est le binaire')
})

test('lireGit : un cwd qui EXISTE sans être un répertoire se nomme pour ce qu’il est', () => {
  const { racine } = depot()
  try {
    const fichier = join(racine, 'a.txt')
    assert.equal(natureDuChemin(fichier), 'fichier')
    assert.equal(estRepertoire(fichier), false)
    assert.equal(estRepertoire(racine), true)
    // MÊME verdict sur les deux plateformes, où l'OS ne rend PAS le même code (ENOENT sur win32,
    // ENOTDIR sur POSIX — rouge de CI Linux mesuré sur le run 34815975288).
    const vu = lireGit(['rev-parse', 'HEAD'], { cwd: fichier })
    assert.equal(vu.disponible, false)
    assert.equal(vu.raison, `cwd qui n'est pas un répertoire : ${fichier}`)
  } finally { jeter(racine) }
})

// Le CODE de l'erreur de spawn ne décide de rien : c'est la NATURE du cwd qui parle. Les trois
// natures sont jouées contre le MÊME couple de codes, sonde injectée (`nature`) donc sans disque.
test('classer : le verdict d’un spawn échoué ne dépend PAS du code (ENOENT win32 / ENOTDIR POSIX)', () => {
  const echec = (code) => ({ error: Object.assign(new Error(`spawnSync git ${code}`), { code }), status: null })
  const sonde = (quoi) => () => quoi
  for (const code of ['ENOENT', 'ENOTDIR']) {
    assert.equal(
      classer(echec(code), { cwd: '/x/a.txt', nature: sonde('fichier') }).raison,
      "cwd qui n'est pas un répertoire : /x/a.txt",
      `code ${code} : un cwd-FICHIER se nomme pour ce qu'il est`,
    )
    assert.equal(classer(echec(code), { cwd: '/x/jamais', nature: sonde('absent') }).raison, 'cwd inexistant : /x/jamais')
    assert.match(
      classer(echec(code), { cwd: '/x', nature: sonde('repertoire') }).raison,
      /git introuvable/,
      `code ${code} : cwd répertoire → il ne reste que le binaire`,
    )
  }
  // Une erreur de spawn qui se nomme elle-même garde SON message : « git introuvable » serait faux.
  const acces = classer({ error: new Error('spawnSync git EACCES'), status: null }, { cwd: '/x', nature: sonde('repertoire') })
  assert.equal(acces.raison, 'spawnSync git EACCES')
})

test('lireGit : status 0 rend un FAIT porteur de la sortie', () => {
  const { racine, second } = depot()
  try {
    const vu = lireGit(['rev-parse', 'HEAD'], { cwd: racine })
    assert.equal(vu.disponible, true)
    assert.equal(vu.absent, undefined)
    assert.equal(vu.valeur.stdout.trim(), second)
    assert.equal(sortieOuNull(vu).trim(), second)
  } finally { jeter(racine) }
})

test('lireGit : un PRÉDICAT qui rend 1 sans stderr est un FAIT porteur du code, jamais une panne', () => {
  const { racine, premier, second } = depot()
  try {
    const faux = lireGit(['merge-base', '--is-ancestor', second, premier], { cwd: racine })
    assert.equal(faux.disponible, true)
    assert.equal(faux.absent, undefined)
    assert.equal(faux.valeur.status, 1)
    // Un code ≠ 0 n'est pas une sortie exploitable pour les lecteurs d'image.
    assert.equal(sortieOuNull(faux), null)
    const quiet = lireGit(['rev-parse', '--verify', '--quiet', 'origin/main^{commit}'], { cwd: racine })
    assert.equal(quiet.disponible, true)
    assert.equal(quiet.valeur.status, 1)
  } finally { jeter(racine) }
})

test('lireGit : les cinq ABSENCES de la porte sont des ABSENTS (dépôt réel)', () => {
  const { racine, second } = depot()
  try {
    const absents = {
      'pre-image d’un fichier AJOUTÉ': ['show', `${second}^:neuf.txt`],
      'post-image d’un fichier absent': ['show', `${second}:jamais.txt`],
      'origin/main inconnu': ['rev-parse', 'origin/main'],
      'sha inconnu': ['show', '-s', '--format=%B', ZERO],
      'plage inconnue': ['diff', '-U0', `${ZERO}..${second}`],
    }
    for (const [nom, args] of Object.entries(absents)) {
      const vu = lireGit(args, { cwd: racine })
      assert.equal(vu.disponible, true, `${nom} : une absence n’est pas une panne`)
      assert.equal(vu.absent, true, nom)
      assert.equal(sortieOuNull(vu), null, `${nom} : le contrat des lecteurs d’image est \`null\``)
    }
  } finally { jeter(racine) }
})

test('lireGit : HORS dépôt, c’est INDISPONIBLE — et la raison le dit', () => {
  const hors = mkdtempSync(join(tmpdir(), 'git-hors-'))
  try {
    const vu = lireGit(['rev-parse', 'HEAD'], { cwd: hors })
    assert.equal(vu.disponible, false)
    assert.match(vu.raison, /not a git repository/i)
  } finally { jeter(hors) }
})

test('lireGit : un git ABSENT du système (ENOENT) est INDISPONIBLE, jamais un absent', () => {
  const vu = lireGit(['rev-parse', 'HEAD'], {
    spawn: () => ({ error: new Error('spawnSync git ENOENT'), status: null }),
  })
  assert.equal(vu.disponible, false)
  assert.match(vu.raison, /ENOENT/)
})

test('lireGit : un processus TUÉ par un signal est INDISPONIBLE', () => {
  const vu = lireGit(['log'], { spawn: () => ({ status: null, signal: 'SIGKILL', stdout: '', stderr: '' }) })
  assert.equal(vu.disponible, false)
  assert.match(vu.raison, /SIGKILL/)
})

test('lireGit : le processus qui n’a pas DÉMARRÉ est REJOUÉ (spawnResilient), pas classé indisponible', () => {
  let essais = 0
  const attentes = []
  const vu = lireGit(['rev-parse', 'HEAD'], {
    attendre: (ms) => attentes.push(ms),
    journal: { write: () => {} },
    spawn: () => {
      essais += 1
      return essais < 3
        ? { status: STATUS_DLL_INIT_FAILED, stdout: '', stderr: '' }
        : { status: 0, stdout: 'abc1234\n', stderr: '' }
    },
  })
  assert.equal(essais, 3)
  assert.deepEqual(attentes, [2000, 5000])
  assert.equal(vu.disponible, true)
  assert.equal(vu.valeur.stdout.trim(), 'abc1234')
})

test('estAncetre : vrai, faux, et un sha inconnu qui rend ABSENT', () => {
  const { racine, premier, second } = depot()
  try {
    assert.deepEqual(estAncetre(premier, second, { cwd: racine }), { disponible: true, valeur: true })
    assert.deepEqual(estAncetre(second, premier, { cwd: racine }), { disponible: true, valeur: false })
    assert.deepEqual(estAncetre(ZERO, 'HEAD', { cwd: racine }), { disponible: true, absent: true })
  } finally { jeter(racine) }
})

test('commitsDe : les N derniers commits, du plus récent au plus ancien ; ref inconnue = ABSENT', () => {
  const { racine, premier, second } = depot()
  try {
    assert.deepEqual(commitsDe('HEAD', 10, { cwd: racine }), { disponible: true, valeur: [second, premier] })
    assert.deepEqual(commitsDe('HEAD', 1, { cwd: racine }), { disponible: true, valeur: [second] })
    assert.deepEqual(commitsDe(ZERO, 5, { cwd: racine }), { disponible: true, absent: true })
  } finally { jeter(racine) }
})

test('fetchOrigin : une origine LOCALE réelle met `origin/main` à jour ; sans origine, INDISPONIBLE', () => {
  const amont = depot()
  const aval = mkdtempSync(join(tmpdir(), 'git-aval-'))
  try {
    execFileSync('git', ['clone', '-q', '--no-local', amont.racine, aval], { env: envDeDepotForge(), encoding: 'utf8' })
    // La ref distante est SUPPRIMÉE localement : seul un fetch réel peut la remettre.
    execFileSync('git', ['update-ref', '-d', 'refs/remotes/origin/main'], { cwd: aval, env: envDeDepotForge() })
    assert.equal(lireGit(['rev-parse', 'origin/main'], { cwd: aval }).absent, true)
    const vu = fetchOrigin({ cwd: aval })
    assert.equal(vu.disponible, true, vu.raison)
    assert.equal(sortieOuNull(lireGit(['rev-parse', 'origin/main'], { cwd: aval })).trim(), amont.second)

    const sansOrigine = lireGit(['fetch', '--quiet', 'origin', 'main'], { cwd: amont.racine })
    assert.equal(sansOrigine.disponible, false)
  } finally {
    jeter(amont.racine)
    jeter(aval)
  }
})

// L'ARBRE PRINCIPAL : la résolution que trois outils re-posaient à la main. Les formes de réponse
// sont jouées avec un `git` INJECTÉ (aucun sous-module à fabriquer sur le disque pour cela), puis le
// fait qui compte est mesuré contre git RÉEL : depuis un WORKTREE, la réponse est l'arbre principal.
test('arbrePrincipal : le PARENT du .git commun, séparateurs POSIX, casse CONSERVÉE', () => {
  const gitQuiRend = (stdout) => (args) => {
    assert.deepEqual(args, ['rev-parse', '--path-format=absolute', '--git-common-dir'])
    return { disponible: true, valeur: { status: 0, stdout, stderr: '' } }
  }
  assert.deepEqual(arbrePrincipal('/x/Game/.wt-42', gitQuiRend('/x/Game/.git\n')),
    { disponible: true, valeur: '/x/Game' })
  // La casse rendue sert de `cwd` et de préfixe de cible : l'abaisser casserait un chemin
  // case-sensible (les fixtures `mkdtemp` de ce dépôt en portent, et `test:ops` tourne sur ubuntu).
  assert.deepEqual(arbrePrincipal('/tmp/depot-Ab9Z/.wt-42', gitQuiRend('/tmp/depot-Ab9Z/.git')),
    { disponible: true, valeur: '/tmp/depot-Ab9Z' })
  assert.deepEqual(arbrePrincipal('\\x\\Game', gitQuiRend('\\x\\Game\\.git\n')),
    { disponible: true, valeur: '/x/Game' })
})

test('arbrePrincipal : deux refus NOMMÉS, jamais un repli sur le cwd', () => {
  const gitQuiRend = (stdout) => () => ({ disponible: true, valeur: { status: 0, stdout, stderr: '' } })

  // Git MUET : la seule forme que le premier refus garde, et elle s'injecte (git ne la produit pas).
  for (const vide of ['', '   ']) {
    const vu = arbrePrincipal('/x/nu.git', gitQuiRend(vide))
    assert.equal(vu.disponible, false, `« ${JSON.stringify(vide)} » : rien ne se déduit d'une réponse vide`)
    assert.match(vu.raison, /rend une réponse vide/)
    assert.equal(vu.valeur, undefined, 'aucune valeur : surtout pas le cwd')
  }

  // Le DÉPÔT NU est mesuré contre git RÉEL : sous `--path-format=absolute` il rend son chemin ABSOLU
  // (`…/depot.git`), jamais `.` — c'est le second refus qui le NOMME.
  const base = mkdtempSync(join(tmpdir(), 'nu-'))
  const nu = join(base, 'depot.git')
  try {
    execFileSync('git', ['init', '-q', '--bare', nu], { env: envDeDepotForge(), encoding: 'utf8' })
    const vuNu = arbrePrincipal(nu)
    assert.equal(vuNu.disponible, false, "un dépôt nu n'a pas d'arbre principal")
    assert.match(vuNu.raison, /hors d'un arbre/)
    assert.match(vuNu.raison, /dépôt nu/, 'le refus NOMME le dépôt nu')
    assert.equal(vuNu.valeur, undefined, 'aucune valeur : surtout pas le cwd')
  } finally { jeter(base) }

  const sousModule = arbrePrincipal('/x/Game/sub', gitQuiRend('/x/Game/.git/modules/sub\n'))
  assert.equal(sousModule.disponible, false)
  assert.match(sousModule.raison, /hors d'un arbre/)
  assert.match(sousModule.raison, /sous-module ou --separate-git-dir/)
  assert.match(sousModule.raison, /modules\/sub/, 'le refus porte ce que git a rendu')

  const enPanne = arbrePrincipal('/x', () => ({ disponible: false, raison: 'cwd inexistant : /x' }))
  assert.equal(enPanne.disponible, false)
  assert.match(enPanne.raison, /cwd inexistant : \/x/)

  const horsDepot = arbrePrincipal('/x', () => ({ disponible: true, absent: true }))
  assert.equal(horsDepot.disponible, false)
  assert.match(horsDepot.raison, /git n'y connaît pas de dépôt/)

  const code = arbrePrincipal('/x', () => ({ disponible: true, valeur: { status: 128, stdout: '', stderr: '' } }))
  assert.equal(code.disponible, false)
  assert.match(code.raison, /rend 128/)
})

test('arbrePrincipal : depuis un WORKTREE RÉEL, la réponse est l’arbre PRINCIPAL (git réel)', () => {
  const { racine, g } = depot()
  const lie = join(racine, '.wt-sonde')
  try {
    g('worktree', 'add', '-q', '-b', 'sonde', lie)
    const depuisLie = arbrePrincipal(lie)
    const depuisPrincipal = arbrePrincipal(racine)
    assert.equal(depuisLie.disponible, true, depuisLie.raison)
    assert.equal(depuisLie.valeur, depuisPrincipal.valeur, 'le worktree et le principal répondent le MÊME arbre')
    assert.equal(depuisLie.valeur.toLowerCase(), racine.replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase())
    assert.equal(natureDuChemin(depuisLie.valeur), 'repertoire', 'la valeur est utilisable comme cwd')
  } finally { jeter(racine) }
})

test('classer : la RAISON est la première ligne significative, bornée à 200 caractères', () => {
  const vu = classer({ status: 128, stdout: '', stderr: `\n\nfatal: ${'x'.repeat(400)}\nune seconde ligne` })
  assert.equal(vu.disponible, false)
  assert.equal(vu.raison.length, 200)
  assert.ok(!vu.raison.includes('une seconde ligne'))
  assert.equal(raisonCourte('   \n  premier mot  \nsuite'), 'premier mot')
})

test('listerImage : l’unique listeur d’image — ref, INDEX, SUIVI et TRAVAIL rendent chacun LEURS fichiers ; enfantsDirects en projette les noms', () => {
  const { racine } = instanceDeDepot({ fichiers: { 'd/a.txt': 'a\n', 'd/s/b.txt': 'b\n', 'x.txt': 'x\n' }, message: 'socle' })
  const git = (args) => sortieOuNull(lireGit(args, { cwd: racine }))
  try {
    execFileSync('git', ['rm', '-q', '--cached', 'd/a.txt'], { cwd: racine, env: envDeDepotForge(), stdio: ['ignore', 'pipe', 'ignore'] })
    writeFileSync(join(racine, 'd/neuf.txt'), 'n\n')
    assert.deepEqual(listerImage(git, 'HEAD', 'd'), ['d/a.txt', 'd/s/b.txt'])
    assert.deepEqual(listerImage(git, INDEX, 'd'), ['d/s/b.txt'], 'retiré de l’index : hors de ce que le commit emporte')
    assert.deepEqual(listerImage(git, SUIVI, 'd'), ['d/s/b.txt'], 'les chemins suivis : ni le retiré ni le non-suivi')
    assert.deepEqual(listerImage(git, TRAVAIL, 'd').sort(), ['d/a.txt', 'd/neuf.txt', 'd/s/b.txt'], 'l’arbre de travail : non suivis compris')
    assert.deepEqual(enfantsDirects(listerImage(git, 'HEAD', 'd'), 'd'), ['a.txt', 's'])
    assert.deepEqual(listerImage(() => null, 'HEAD', 'd'), [], 'git muet : []')
  } finally {
    rmSync(racine, { recursive: true, force: true })
  }
})

test('listerImage : un suivi SUPPRIMÉ du disque sort de SUIVI et de TRAVAIL (`git commit -a` le supprime), pas de l’INDEX', () => {
  const { racine } = instanceDeDepot({ fichiers: { 'd/a.txt': 'a\n', 'd/Console.tsx': 'c\n' }, message: 'socle' })
  const git = (args) => sortieOuNull(lireGit(args, { cwd: racine }))
  try {
    rmSync(join(racine, 'd/Console.tsx'))
    assert.deepEqual(listerImage(git, INDEX, 'd'), ['d/Console.tsx', 'd/a.txt'], 'l’index le porte encore')
    assert.deepEqual(listerImage(git, SUIVI, 'd'), ['d/a.txt'])
    assert.deepEqual(listerImage(git, TRAVAIL, 'd'), ['d/a.txt'])
  } finally {
    rmSync(racine, { recursive: true, force: true })
  }
})

test('lireEnLot : un seul `cat-file --batch` rend le texte de chaque chemin, multi-octet compris, `null` pour un absent — ref et INDEX', () => {
  const textes = { 'src/a.ts': 'const é = "→"\n\nexport {}\n', 'src/b.ts': 'const z = 2' }
  const { racine, sha } = instanceDeDepot({ fichiers: textes, message: 'un' })
  try {
    const appels = []
    const git = (args, opts) => { appels.push(args[0]); return sortieOuNull(lireGit(args, { cwd: racine, ...opts })) }
    for (const arbre of [sha, INDEX]) {
      assert.deepEqual([...lireEnLot(git, arbre, ['src/a.ts', 'src/absent.ts', 'src/b.ts'])],
        [['src/a.ts', textes['src/a.ts']], ['src/absent.ts', null], ['src/b.ts', textes['src/b.ts']]], arbre)
    }
    assert.deepEqual(appels, ['cat-file', 'cat-file'], 'une lecture par lot, pas une par chemin')
    assert.deepEqual([...lireEnLot(git, sha, [])], [], 'lot vide : aucun processus')
    assert.equal(appels.length, 2)
  } finally {
    jeter(racine)
  }
})

test('lireEnLot : une sortie de `cat-file` dont le bloc ne finit pas à sa taille LÈVE en nommant le chemin', () => {
  const git = () => 'abc blob 3\nabcX'
  assert.throws(() => lireEnLot(git, 'HEAD', ['src/a.ts']), /illisible à HEAD:src\/a\.ts : « abc blob 3 »/)
  assert.deepEqual([...lireEnLot(() => 'abc blob 3\nabc\n', 'HEAD', ['src/a.ts'])], [['src/a.ts', 'abc']], 'témoin : le bloc bien formé')
})

test('cheminsDe, numstatDe, nameStatusDe, eolsDe : un chemin non-ASCII ou à espace est rendu EN CLAIR — ls-files, ls-tree, diff, numstat, name-status, grep -l, --eol', () => {
  const E = 'src/ui/Écran.tsx'
  const B = 'src/mon module.ts'
  const { racine, sha } = instanceDeDepot({ fichiers: { [E]: 'const e = 1\n', [B]: 'const b = 1\n', 'src/a.ts': 'const a = 1\n' }, message: 'socle' })
  const git = (args) => sortieOuNull(lireGit(args, { cwd: racine }))
  const g = (...a) => execFileSync('git', a, { cwd: racine, env: envDeDepotForge(), encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
  try {
    assert.match(g('ls-files'), /^"src\/ui\/\\303\\211cran\.tsx"$/m, 'témoin : hors de l’hôte, la forme ligne CITE le chemin')
    assert.match(git(['ls-files']), /^src\/ui\/Écran\.tsx$/m, 'par l’hôte, même la forme ligne (un patch n’a pas de -z) l’écrit en clair')
    assert.deepEqual(cheminsDe(git, ['ls-files', '--', 'src']).sort(), [B, 'src/a.ts', E].sort())
    assert.deepEqual(listerImage(git, sha, 'src').sort(), [B, 'src/a.ts', E].sort())
    writeFileSync(join(racine, E), 'const e = 2\n')
    g('mv', B, 'src/renommé.ts')
    assert.deepEqual(cheminsDe(git, ['diff', 'HEAD', '--name-only', '--no-renames']).sort(), [B, 'src/renommé.ts', E].sort())
    assert.deepEqual(numstatDe(git, ['diff', 'HEAD', '--numstat']),
      [{ plus: 0, moins: 0, chemins: [B, 'src/renommé.ts'] }, { plus: 1, moins: 1, chemins: [E] }], 'un renommage : ses deux bouts')
    assert.deepEqual(nameStatusDe(git, ['diff', 'HEAD', '-M', '--name-status']),
      [{ statut: 'R100', chemins: [B, 'src/renommé.ts'] }, { statut: 'M', chemins: [E] }])
    assert.deepEqual(eolsDe(git, ['ls-files', '--eol', '--cached', '--', E, 'src/renommé.ts']),
      [{ index: 'lf', travail: 'lf', attr: '', chemin: 'src/renommé.ts' }, { index: 'lf', travail: 'lf', attr: '', chemin: E }], 'la TABULATION coupe, pas l’espace')
    assert.deepEqual(fichiersDuGrep(git, [sha], 'const e', ['src']), [E], 'le préfixe `<ref>:` est retiré')
    assert.deepEqual(fichiersDuGrep(git, ['--cached'], 'const', ['src']).sort(), ['src/a.ts', 'src/renommé.ts', E].sort())
    assert.deepEqual(fichiersDuGrep(git, [], 'rien de tel', ['src']), [], 'aucun match : sortie 1, liste vide')
    assert.deepEqual(cheminsDe(() => null, ['ls-files']), [], 'git muet : []')
  } finally {
    jeter(racine)
  }
})

test('etatsDe : `status --porcelain` en `{ etat, chemins }`, renommage (nouveau puis ancien), non-suivi et chemin non-ASCII EN CLAIR', () => {
  const E = 'src/ui/Écran.tsx'
  const B = 'src/mon module.ts'
  const { racine } = instanceDeDepot({ fichiers: { [E]: 'const e = 1\n', [B]: 'const b = 1\n' }, message: 'socle' })
  const git = (args) => sortieOuNull(lireGit(args, { cwd: racine }))
  const g = (...a) => execFileSync('git', a, { cwd: racine, env: envDeDepotForge(), encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
  try {
    writeFileSync(join(racine, E), 'const e = 2\n')
    g('mv', B, 'src/renommé.ts')
    writeFileSync(join(racine, 'src/neuf é.ts'), 'n\n')
    assert.deepEqual(etatsDe(git, ['status', '--porcelain']), [
      { etat: 'R ', chemins: ['src/renommé.ts', B] },
      { etat: ' M', chemins: [E] },
      { etat: '??', chemins: ['src/neuf é.ts'] },
    ])
    assert.deepEqual(etatsDe(() => null, ['status', '--porcelain']), [], 'git muet : []')
  } finally {
    jeter(racine)
  }
})

test('sourceGit : `citants` ne rend que les MODULES de code de `src/`, `lireTout` leur texte par lot — ref, INDEX, suivi et travail', () => {
  const texte = "import {\n  C,\n} from\n  './Cible'\n"
  const { racine, sha } = instanceDeDepot({
    fichiers: { 'src/a.ts': texte, 'src/n.md': "from './Cible'\n", 'src/d.json': '"./Cible"\n', 'src/z.ts': 'const z = 1\n' },
    message: 'un',
  })
  try {
    for (const arbre of [sha, INDEX, SUIVI, TRAVAIL]) {
      const source = sourceGit({ cwd: racine, arbre })
      const citants = source.citants('/Cible')
      assert.deepEqual(citants, ['src/a.ts'], arbre)
      assert.deepEqual([...source.lireTout(citants)], [['src/a.ts', texte]], arbre)
    }
  } finally {
    jeter(racine)
  }
})

// ── CE QUE FAIT LE COMMIT (`ceQueFaitLeCommit`, contre sa base) : des fusions FORGÉES ──────

/** Dépôt jetable de trois fusions sur `main` : une PROPRE (la branche `cote` ajoute `h.txt`), une qui
 *  RÉSOUT un conflit sur `f.txt`, une « maléfique » qui ajoute à `g.txt` une ligne qu'aucun parent ne
 *  porte. `shas` nomme chaque fusion et le commit de branche qui a écrit `h.txt`. */
function depotDeFusions() {
  const { racine } = instanceDeDepot({ fichiers: { 'f.txt': 'a\nb\nc\n', 'g.txt': 'x\n' }, message: 'socle' })
  const g = (...a) => execFileSync('git', a, { cwd: racine, env: envDeDepotForge(), encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
  const ecrire = (rel, texte) => writeFileSync(join(racine, rel), texte)
  const tete = () => g('rev-parse', 'HEAD').trim()
  g('checkout', '-q', '-b', 'cote')
  ecrire('h.txt', 'h1\nh2\n'); g('add', 'h.txt'); g('commit', '-q', '-m', 'cote : h')
  const auteurDeH = tete()
  g('checkout', '-q', 'main')
  ecrire('x.txt', 'x\n'); g('add', 'x.txt'); g('commit', '-q', '-m', 'main : x')
  g('merge', '-q', '--no-ff', '-m', 'fusion propre', 'cote')
  const propre = tete()
  g('checkout', '-q', 'cote')
  ecrire('f.txt', 'a\nB-cote\nc\n'); g('commit', '-q', '-am', 'cote : f')
  g('checkout', '-q', 'main')
  ecrire('f.txt', 'a\nB-main\nc\n'); g('commit', '-q', '-am', 'main : f')
  try { g('merge', '-q', 'cote') } catch { /* conflit attendu, résolu ci-dessous */ }
  ecrire('f.txt', 'a\nB-resolu\nc\n'); g('commit', '-q', '-am', 'fusion résolue')
  const resolue = tete()
  g('checkout', '-q', 'cote')
  ecrire('g.txt', 'x\ny\n'); g('commit', '-q', '-am', 'cote : g')
  g('checkout', '-q', 'main')
  g('merge', '-q', '--no-commit', 'cote')
  ecrire('g.txt', 'x\ny\nMAL\n'); g('add', 'g.txt'); g('commit', '-q', '-m', 'fusion maléfique')
  return { racine, auteurDeH, propre, resolue, malefique: tete() }
}

test('ceQueFaitLeCommit : une fusion PROPRE n’apporte rien — ni le fichier ni les lignes de la branche fusionnée', () => {
  const { racine, auteurDeH, propre } = depotDeFusions()
  try {
    const git = lecteurGit(racine, { env: envDeDepotForge() })
    assert.deepEqual(ceQueFaitLeCommit(git, propre).chemins(), [])
    assert.equal(ceQueFaitLeCommit(git, propre).diff(['h.txt']), '')
    assert.deepEqual(ceQueFaitLeCommit(git, auteurDeH).chemins(), ['h.txt'], 'le commit d’ORIGINE, lui, porte h.txt')
  } finally {
    jeter(racine)
  }
})

test('ceQueFaitLeCommit : une fusion qui RÉSOUT un conflit apporte sa résolution, lue contre la fusion automatique', () => {
  const { racine, resolue } = depotDeFusions()
  try {
    const fait = ceQueFaitLeCommit(lecteurGit(racine, { env: envDeDepotForge() }), resolue)
    assert.deepEqual(fait.chemins(), ['f.txt'])
    assert.match(fait.diff(['f.txt']), /^\+B-resolu$/m)
    const deBase = fait.texteDeBase('f.txt')
    assert.match(deBase, /^<<<<<<< /m, 'la base est la fusion AUTOMATIQUE, marqueurs de conflit compris')
    assert.match(deBase, /^B-main$/m)
    assert.match(deBase, /^B-cote$/m)
    assert.equal(fait.texteDeBase('g.txt'), 'x\n', 'un fichier que le commit ne touche pas a dans la base son texte du commit')
  } finally {
    jeter(racine)
  }
})

test('ceQueFaitLeCommit : une fusion « maléfique » apporte la ligne qu’aucun parent ne porte, et seulement elle', () => {
  const { racine, malefique } = depotDeFusions()
  try {
    const fait = ceQueFaitLeCommit(lecteurGit(racine, { env: envDeDepotForge() }), malefique)
    assert.deepEqual(fait.chemins(), ['g.txt'])
    assert.deepEqual(fait.diff().split('\n').filter((l) => /^[+-][^+-]/.test(l)), ['+MAL'])
    assert.equal(fait.texteDeBase('g.txt'), 'x\ny\n')
  } finally {
    jeter(racine)
  }
})

test('ceQueFaitLeCommit : une fusion SANS ANCÊTRE COMMUN se lit comme `git show --remerge-diff` — chemins et patch', () => {
  const { racine, g } = depot()
  try {
    const blob = execFileSync('git', ['hash-object', '-w', '--stdin'], { cwd: racine, env: envDeDepotForge(), encoding: 'utf8', input: 'o\n' }).trim()
    const arbre = execFileSync('git', ['mktree'], { cwd: racine, env: envDeDepotForge(), encoding: 'utf8', input: `100644 blob ${blob}\to.txt\n` }).trim()
    const racineEtrangere = execFileSync('git', ['commit-tree', arbre, '-m', 'autre histoire'], { cwd: racine, env: envDeDepotForge(), encoding: 'utf8', input: '' }).trim()
    g('merge', '-q', '--no-commit', '--allow-unrelated-histories', racineEtrangere)
    writeFileSync(join(racine, 'mal.txt'), 'MAL\n'); g('add', 'mal.txt'); g('commit', '-q', '-m', 'fusion sans ancêtre')
    const fusion = g('rev-parse', 'HEAD').trim()
    const remerge = (...forme) => g('show', '--remerge-diff', '--format=', ...forme, fusion)
    const fait = ceQueFaitLeCommit(lecteurGit(racine, { env: envDeDepotForge() }), fusion)
    assert.deepEqual(fait.chemins(), remerge('--name-only').split('\n').filter(Boolean))
    assert.deepEqual(fait.chemins(), ['mal.txt'], 'o.txt vient de la fusion automatique, mal.txt de la fusion seule')
    const lignes = (patch) => patch.split('\n').filter((l) => /^[+-][^+-]/.test(l))
    assert.deepEqual(lignes(fait.diff()), lignes(remerge('-U0')))
  } finally {
    jeter(racine)
  }
})

test('ceQueFaitLeCommit : un commit à un parent se lit contre lui — chemins, texte de base, naissance et renommage', () => {
  const { racine, premier, second, g } = depot()
  try {
    g('mv', 'a.txt', 'b.txt'); g('commit', '-q', '-m', 'trois')
    const git = lecteurGit(racine, { env: envDeDepotForge() })
    assert.deepEqual(ceQueFaitLeCommit(git, second).chemins(), ['neuf.txt'])
    assert.equal(ceQueFaitLeCommit(git, second).texteDeBase('neuf.txt'), null, 'un fichier qui NAÎT est absent de la base')
    const trois = ceQueFaitLeCommit(git, g('rev-parse', 'HEAD').trim())
    assert.deepEqual(trois.chemins().sort(), ['a.txt', 'b.txt'], '`--no-renames` : les deux bouts')
    assert.deepEqual([...trois.renommages()], [['a.txt', 'b.txt']])
    assert.equal(trois.texteDeBase('a.txt'), 'a\n')
    assert.deepEqual(ceQueFaitLeCommit(git, premier).chemins(), ['a.txt'], 'une racine se lit contre l’arbre vide')
  } finally {
    jeter(racine)
  }
})

test('ceQueFaitLeCommit : sous git 2.39, un commit ordinaire se lit, une FUSION lève une raison NOMMÉE', () => {
  const lecteur = (version, parents) => (args) => (args[0] === 'version' ? version : args[0] === 'rev-list' ? `abc ${parents}\n` : args[0] === 'diff' ? 'a.txt\0' : null)
  assert.deepEqual(ceQueFaitLeCommit(lecteur('git version 2.39.0\n', 'p1'), 'abc').chemins(), ['a.txt'])
  assert.throws(() => ceQueFaitLeCommit(lecteur('git version 2.39.0\n', 'p1 p2'), 'abc'), (e) => e instanceof GitIndisponible && /git 2\.39 ne sait pas git merge-tree --write-tree --stdin \(git 2\.40 ou plus\)/.test(e.raison))
  assert.throws(() => ceQueFaitLeCommit(lecteur(null, 'p1 p2'), 'abc'), (e) => e instanceof GitIndisponible && /version de git illisible/.test(e.raison))
  assert.deepEqual(ceQueFaitLeCommit(lecteur('git version 2.45.1.windows.1\n', 'p1 p2'), 'abc').chemins(), [], 'windows lu ; merge-tree muet : base nulle')
  assert.deepEqual(ceQueFaitLeCommit(() => null, 'abc').chemins(), [], 'sha inconnu : rien, sans lire la version')
  assert.throws(() => ceQueFaitLeCommit(lecteur('git version 2.43.0', 'p1 p2 p3'), 'abc'), (e) => e instanceof GitIndisponible && /à 3 parents/.test(e.raison))
})

// ── Les lecteurs nommés sur leurs formes rares (#1806, juge des commits 8 et 9, Q7) ─────────────

test('numstatDe : un chemin à TABULATION entier, un binaire en `null` (git réel)', () => {
  const T = 'src/f\tg.test.ts'
  const { racine } = instanceDeDepot({ fichiers: { 'a.txt': 'a\n' }, message: 'socle' })
  try {
    const g = (...a) => execFileSync('git', a, { cwd: racine, env: envDeDepotForge(), encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
    mkdirSync(join(racine, 'src'), { recursive: true })
    writeFileSync(join(racine, T), 'un\ndeux\n')
    writeFileSync(join(racine, 'image.bin'), Buffer.from([0, 1, 2, 0, 255]))
    g('add', '-A')
    const git = lecteurGit(racine, { env: envDeDepotForge() })
    const vu = numstatDe(git, ['diff', '--cached', '--numstat']).sort((x, y) => parUnitesDeCode(x.chemins[0], y.chemins[0]))
    assert.deepEqual(vu, [
      { plus: null, moins: null, chemins: ['image.bin'] },
      { plus: 2, moins: 0, chemins: [T] },
    ])
    g('commit', '-q', '-m', 'deux')
    g('mv', T, 'src/h\ti.test.ts')
    assert.deepEqual(numstatDe(git, ['diff', '--cached', '-M', '--numstat']), [{ plus: 0, moins: 0, chemins: [T, 'src/h\ti.test.ts'] }])
  } finally {
    jeter(racine)
  }
})

test('nameStatusDe : une COPIE (`C`) porte ses deux chemins, comme un renommage', () => {
  const git = () => 'C075\0a.txt\0b.txt\0R100\0c.txt\0d.txt\0M\0e.txt\0'
  assert.deepEqual(nameStatusDe(git, ['diff', '-C', '--name-status']), [
    { statut: 'C075', chemins: ['a.txt', 'b.txt'] },
    { statut: 'R100', chemins: ['c.txt', 'd.txt'] },
    { statut: 'M', chemins: ['e.txt'] },
  ])
})

test('etatsDe : un renommage de l’ARBRE (` R`, colonne Y) porte ses deux chemins (git réel, `add -N`)', () => {
  const { racine } = instanceDeDepot({ fichiers: { 'a.txt': 'contenu assez long pour un renommage\n' }, message: 'socle' })
  try {
    const g = (...a) => execFileSync('git', a, { cwd: racine, env: envDeDepotForge(), encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
    renameSync(join(racine, 'a.txt'), join(racine, 'b.txt'))
    g('add', '-N', 'b.txt')
    const vu = etatsDe(lecteurGit(racine, { env: envDeDepotForge() }), ['status', '--porcelain'])
    assert.deepEqual(vu, [{ etat: ' R', chemins: ['b.txt', 'a.txt'] }])
  } finally {
    jeter(racine)
  }
})

test('eolsDe : un attribut à ESPACES (`attr/text eol=lf`) est lu entier, un enregistrement hors forme LÈVE en se nommant', () => {
  const { racine } = instanceDeDepot({ fichiers: { '.gitattributes': '*.txt text eol=lf\n', 'a.txt': 'a\n' }, message: 'socle' })
  try {
    const vu = eolsDe(lecteurGit(racine, { env: envDeDepotForge() }), ['ls-files', '--eol', '--', 'a.txt'])
    assert.deepEqual(vu, [{ index: 'lf', travail: 'lf', attr: 'text eol=lf', chemin: 'a.txt' }])
  } finally {
    jeter(racine)
  }
  assert.throws(() => eolsDe(() => 'pas une colonne\0', ['ls-files', '--eol']), /git ls-files --eol illisible : « pas une colonne »/)
})
