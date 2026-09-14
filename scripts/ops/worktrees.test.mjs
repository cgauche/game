// CLIQUET de l'inventaire des worktrees (node --test) : parseur et classement sont PURS, et la
// purge se joue sur un dépôt JETABLE sous `os.tmpdir()` porteur de VRAIS worktrees — la seule façon
// de prouver qu'un arbre SALE survit à `--purger`.
// Lancé par `npm run test:ops`.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { instanceDeDepot } from '../guards/lib/depotGabarit.mjs'
import {
  CLASSES, classerWorktree, comptesParClasse, inventaire, ligneDInventaire, parseWorktrees, purger,
} from './worktrees.mjs'

const PORCELAIN = [
  'worktree /dep',
  'HEAD 1111111111111111111111111111111111111111',
  'branch refs/heads/main',
  '',
  'worktree /dep/.wt-42',
  'HEAD 2222222222222222222222222222222222222222',
  'branch refs/heads/chantier/42',
  '',
  'worktree /dep/.wt-detache',
  'HEAD 3333333333333333333333333333333333333333',
  'detached',
  '',
  'worktree /dep/.wt-verrou',
  'HEAD 4444444444444444444444444444444444444444',
  'branch refs/heads/chantier/verrou',
  'locked recette en cours',
  '',
  'worktree /dep/.wt-perdu',
  'HEAD 5555555555555555555555555555555555555555',
  'branch refs/heads/chantier/perdu',
  'prunable gitdir file points to non-existent location',
  '',
].join('\n')

test('parseWorktrees lit les cinq formes de bloc, et le PREMIER est l’arbre principal', () => {
  const vus = parseWorktrees(PORCELAIN)
  assert.equal(vus.length, 5)
  assert.deepEqual(vus.map((w) => w.chemin), ['/dep', '/dep/.wt-42', '/dep/.wt-detache', '/dep/.wt-verrou', '/dep/.wt-perdu'])
  assert.deepEqual(vus.map((w) => w.principal), [true, false, false, false, false])
  assert.deepEqual(vus.map((w) => w.branche), ['main', 'chantier/42', null, 'chantier/verrou', 'chantier/perdu'])
  assert.equal(vus[2].head, '3333333333333333333333333333333333333333')
  assert.equal(vus[3].verrouille, true)
  assert.equal(vus[3].verrouillePour, 'recette en cours')
  assert.equal(vus[1].verrouille, false)
  assert.equal(vus[4].prunable, 'gitdir file points to non-existent location')
  assert.equal(vus[1].prunable, null)
})

test('parseWorktrees supporte les fins de ligne CRLF et un `locked` sans raison', () => {
  const vus = parseWorktrees('worktree /a\r\nHEAD abc\r\nbare\r\n\r\nworktree /b\r\nHEAD def\r\nlocked\r\n')
  assert.equal(vus.length, 2)
  assert.equal(vus[0].nu, true)
  assert.equal(vus[1].verrouille, true)
  assert.equal(vus[1].verrouillePour, null)
})

test('parseWorktrees d’une sortie VIDE ne rend rien (et ne jette pas)', () => {
  assert.deepEqual(parseWorktrees(''), [])
  assert.deepEqual(parseWorktrees(null), [])
})

test('classerWorktree : l’ordre du RISQUE est total, une combinaison ne rend qu’une classe', () => {
  const cas = [
    [{ principal: true, sale: true, absent: true, verrouille: true, fusionne: true }, 'principal'],
    [{ absent: true, sale: true, verrouille: true, fusionne: true }, 'absent'],
    [{ verrouille: true, sale: true, fusionne: true }, 'verrouillé'],
    [{ sale: true, fusionne: true }, 'sale'],
    [{ sale: true, fusionne: false }, 'sale'],
    [{ fusionne: false }, 'propre+hors-main'],
    [{ fusionne: null }, 'propre+hors-main'],
    [{}, 'propre+hors-main'],
    [{ fusionne: true }, 'propre+fusionné'],
  ]
  for (const [etat, attendu] of cas) {
    assert.equal(classerWorktree(etat), attendu, `${JSON.stringify(etat)} → ${attendu}`)
  }
  assert.deepEqual([...new Set(cas.map(([, c]) => c))].sort(), [...CLASSES].sort())
})

test('un verdict de fusion INCONNU ne rend JAMAIS purgeable', () => {
  assert.notEqual(classerWorktree({ fusionne: null }), 'propre+fusionné')
  assert.notEqual(classerWorktree({ fusionne: undefined }), 'propre+fusionné')
})

test('ligneDInventaire : quatre colonnes tabulées, et LA raison de toucher ou non', () => {
  const fusionne = ligneDInventaire({ classe: 'propre+fusionné', chemin: '/dep/.wt-42', branche: 'chantier/42', fusionne: true })
  assert.deepEqual(fusionne.split('\t'), ['propre+fusionné', '/dep/.wt-42', 'chantier/42', 'fusionné dans origin/main — purgeable'])

  const detache = ligneDInventaire({ classe: 'sale', chemin: '/dep/.wt-d', branche: null, head: '3333333333333333333333333333333333333333' })
  assert.deepEqual(detache.split('\t').slice(2), ['détaché@3333333', 'modifications non commitées — rien ne se retire sous elles'])

  const verrou = ligneDInventaire({ classe: 'verrouillé', chemin: '/v', branche: 'b', verrouillePour: 'recette' })
  assert.match(verrou.split('\t')[3], /verrouillé : recette/)

  const perdu = ligneDInventaire({ classe: 'absent', chemin: '/p', branche: 'b', prunable: 'gitdir absent' })
  assert.match(perdu.split('\t')[3], /gitdir absent/)

  const sansVerdict = ligneDInventaire({ classe: 'propre+hors-main', chemin: '/h', branche: 'b', fusionne: null })
  assert.match(sansVerdict.split('\t')[3], /verdict de fusion indisponible/)

  const horsMain = ligneDInventaire({ classe: 'propre+hors-main', chemin: '/h', branche: 'b', fusionne: false })
  assert.match(horsMain.split('\t')[3], /commits que origin\/main/)
})

test('comptesParClasse compte dans l’ordre des CLASSES, sans les classes vides', () => {
  const comptes = comptesParClasse([
    { classe: 'propre+fusionné' }, { classe: 'principal' }, { classe: 'propre+fusionné' }, { classe: 'sale' },
  ])
  assert.deepEqual(Object.entries(comptes), [['principal', 1], ['sale', 1], ['propre+fusionné', 2]])
})

test('purger : un worktree ABSENT seul suffit à jouer `git worktree prune` (git injecté)', () => {
  const vus = []
  const git = (args) => {
    vus.push(args.join(' '))
    return { disponible: true, absent: false, valeur: { status: 0, stderr: '' } }
  }
  // Aucun `propre+fusionné` : sans le déclencheur `absent`, la taille ne se jouait pas et
  // l'inventaire répétait le worktree disparu à chaque passage.
  const gestes = purger({ racine: '/dep', worktrees: [{ classe: 'absent', chemin: '/dep/.wt-perdu', branche: 'chantier/perdu' }], git })
  assert.deepEqual(vus, ['worktree prune'])
  assert.deepEqual(gestes.map((g) => g.geste), ['git worktree prune'])
  assert.equal(gestes[0].ok, true)
})

test('purger : sans absent NI fusionné, aucun geste — la taille ne se joue pas sur rien', () => {
  const vus = []
  const git = (args) => {
    vus.push(args.join(' '))
    return { disponible: true, absent: false, valeur: { status: 0, stderr: '' } }
  }
  const gestes = purger({ racine: '/dep', worktrees: [{ classe: 'sale', chemin: '/dep/.wt-sale' }, { classe: 'principal', chemin: '/dep' }], git })
  assert.deepEqual(vus, [])
  assert.deepEqual(gestes, [])
})

/** Dépôt jetable + son `origin` NU, avec `origin/main` réellement posé. */
function depotAvecOrigin() {
  const nu = mkdtempSync(join(tmpdir(), 'origin-nu-'))
  execFileSync('git', ['init', '--bare', '-q', '-b', 'main', nu], { encoding: 'utf8' })
  const { racine } = instanceDeDepot({ fichiers: { 'a.txt': 'a' }, message: 'fondation' })
  const git = (...args) => execFileSync('git', args, { cwd: racine, encoding: 'utf8' }).trim()
  git('remote', 'add', 'origin', nu)
  git('push', '-q', 'origin', 'main')
  return { racine, git, jeter: () => { for (const d of [racine, nu]) rmSync(d, { recursive: true, force: true }) } }
}

/** Le worktree inventorié dont le chemin finit par `nom` (git rend des chemins en `/`). */
const parNom = (worktrees, nom) => worktrees.find((w) => w.chemin.replace(/\\/g, '/').endsWith(`/${nom}`))

test('inventaire RÉEL puis --purger : le fusionné PROPRE part, le SALE reste et se dit', () => {
  const { racine, git, jeter } = depotAvecOrigin()
  try {
    git('worktree', 'add', '-q', '-b', 'chantier/propre', join(racine, '.wt-propre'), 'origin/main')
    git('worktree', 'add', '-q', '-b', 'chantier/sale', join(racine, '.wt-sale'), 'origin/main')
    writeFileSync(join(racine, '.wt-sale', 'a.txt'), 'modifié, non commité')

    const vu = inventaire({ racine })
    assert.equal(vu.ok, true, vu.refus)
    assert.equal(vu.fusionLue, true)
    assert.equal(vu.worktrees[0].classe, 'principal', 'le premier bloc est l’arbre principal')
    assert.equal(parNom(vu.worktrees, '.wt-propre').classe, 'propre+fusionné')
    assert.equal(parNom(vu.worktrees, '.wt-sale').classe, 'sale', 'même fusionné, un arbre SALE n’est pas purgeable')
    assert.match(ligneDInventaire(parNom(vu.worktrees, '.wt-sale')), /modifications non commitées/)

    const gestes = purger({ racine, worktrees: vu.worktrees })
    assert.deepEqual(gestes.filter((g) => !g.ok), [], JSON.stringify(gestes))
    assert.deepEqual(gestes.map((g) => g.geste.split(' ').slice(0, 3).join(' ')),
      ['git worktree remove', 'git branch -d', 'git worktree prune'])
    assert.equal(existsSync(join(racine, '.wt-propre')), false, 'le fusionné propre est retiré')
    assert.equal(existsSync(join(racine, '.wt-sale')), true, 'le sale est intact')
    assert.equal(existsSync(join(racine, '.wt-sale', 'a.txt')), true)
    assert.equal(git('branch', '--list', 'chantier/propre'), '', 'sa branche fusionnée est retirée aussi')
    assert.match(git('branch', '--list', 'chantier/sale'), /chantier\/sale/, 'celle du sale est gardée')

    const apres = inventaire({ racine })
    assert.equal(apres.worktrees.length, 2, 'principal + le sale')
    assert.equal(parNom(apres.worktrees, '.wt-propre'), undefined)
  } finally { jeter() }
})

test('un worktree dont le RÉPERTOIRE a disparu se classe absent, et la purge le TAILLE (prune seul)', () => {
  const { racine, git, jeter } = depotAvecOrigin()
  try {
    git('worktree', 'add', '-q', '-b', 'chantier/perdu', join(racine, '.wt-perdu'), 'origin/main')
    rmSync(join(racine, '.wt-perdu'), { recursive: true, force: true })

    const vu = inventaire({ racine })
    const perdu = parNom(vu.worktrees, '.wt-perdu')
    assert.equal(perdu.classe, 'absent')
    assert.match(ligneDInventaire(perdu), /git worktree prune/)
    const gestes = purger({ racine, worktrees: vu.worktrees })
    assert.deepEqual(gestes.map((g) => g.geste), ['git worktree prune'], 'la taille se joue, et ELLE SEULE')
    assert.deepEqual(gestes.filter((g) => !g.ok), [], JSON.stringify(gestes))
    // Ni retrait ni suppression de branche : seule l'INSCRIPTION du worktree disparu est taillée.
    assert.equal(parNom(inventaire({ racine }).worktrees, '.wt-perdu'), undefined)
    assert.match(git('branch', '--list', 'chantier/perdu'), /chantier\/perdu/, 'sa branche survit à la taille')
  } finally { jeter() }
})

test('origin non lu : l’inventaire s’imprime SANS verdict de fusion, et rien n’est purgeable', () => {
  const { racine, git, jeter } = depotAvecOrigin()
  try {
    git('worktree', 'add', '-q', '-b', 'chantier/propre', join(racine, '.wt-propre'), 'origin/main')
    const vu = inventaire({ racine, fetch: () => ({ disponible: false, raison: 'réseau coupé' }) })
    assert.equal(vu.fusionLue, false)
    const propre = parNom(vu.worktrees, '.wt-propre')
    assert.equal(propre.fusionne, null)
    assert.equal(propre.classe, 'propre+hors-main', 'sans origin/main lu, on ne purge pas sur rien')
    assert.deepEqual(purger({ racine, worktrees: vu.worktrees }), [])
    assert.equal(existsSync(join(racine, '.wt-propre')), true)
  } finally { jeter() }
})

test('git worktree list illisible : refus NOMMÉ, jamais un inventaire vide', () => {
  const vu = inventaire({
    racine: '/dep',
    fetch: () => ({ disponible: true, valeur: { status: 0, stdout: '', stderr: '' } }),
    git: () => ({ disponible: false, raison: 'git introuvable (binaire absent du PATH)' }),
  })
  assert.equal(vu.ok, false)
  assert.match(vu.refus, /git introuvable/)
})
