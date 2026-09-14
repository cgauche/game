// CLIQUET de l'ouverture de chantier (node --test) : les décisions sont PURES, et le geste réel se
// joue sur un dépôt JETABLE sous `os.tmpdir()` — avec un VRAI `origin` nu, parce que « le chantier
// part d'origin/main » est justement ce qu'un test à `HEAD` ne verrait pas tomber.
// `npm ci` n'est JAMAIS joué : l'appelant injecte un `npm` qui enregistre l'appel.
// Lancé par `npm run test:ops`.
import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { instanceDeDepot } from '../guards/lib/depotGabarit.mjs'
import { ECRIT_LU } from '../gates/toutes.mjs'
import { EQUIPEMENTS, argumentsDe, brancheDe, cibleDe, creerChantier, equipementsDesPrerequis, nomValide, refusDeCreation, resumeDeChantier } from './chantier.mjs'

test('un nom de chantier est un numéro de ticket, avec un slug optionnel en minuscules', () => {
  for (const bon of ['1736', '42', '1732-1734-outillage', '1736-publication', '12-a', '12-a1-b2']) {
    assert.equal(nomValide(bon), true, `« ${bon} » est une forme valide`)
  }
  for (const mauvais of ['', 'publication', '1736-', '-1736', '1736-Publication', '1736 publication',
    '1736/publication', '1736--a', '../evade', undefined, 42]) {
    assert.equal(nomValide(mauvais), false, `« ${mauvais} » n’est PAS une forme valide`)
  }
})

test('argumentsDe : le nom est le premier argument NON drapeau, --sans-ci se lit où qu’il soit', () => {
  assert.deepEqual(argumentsDe(['1736']), { nom: '1736', sansCi: false })
  assert.deepEqual(argumentsDe(['1736', '--sans-ci']), { nom: '1736', sansCi: true })
  assert.deepEqual(argumentsDe(['--sans-ci', '1736']), { nom: '1736', sansCi: true })
  assert.equal(argumentsDe([]), null, 'sans nom, il n’y a rien à ouvrir')
  assert.equal(argumentsDe(['--sans-ci']), null)
})

test('refusDeCreation dit DISTINCTEMENT la cible et la branche : ce ne sont pas les mêmes sorties', () => {
  const base = { nom: '42', cible: '/dep/.wt-42' }
  assert.equal(refusDeCreation({ ...base, cibleExiste: false, brancheExiste: false }), null)

  const surCible = refusDeCreation({ ...base, cibleExiste: true, brancheExiste: false })
  assert.match(surCible, /\/dep\/\.wt-42 existe déjà/)
  assert.doesNotMatch(surCible, /chantier\/42/, 'la branche n’est pas en cause : ne pas la nommer')

  const surBranche = refusDeCreation({ ...base, cibleExiste: false, brancheExiste: true })
  assert.match(surBranche, /la branche chantier\/42 existe déjà/)
  assert.match(surBranche, /git worktree add \/dep\/\.wt-42 chantier\/42/, 'le refus porte le geste de reprise')

  const lesDeux = refusDeCreation({ ...base, cibleExiste: true, brancheExiste: true })
  assert.match(lesDeux, /déjà ouvert/)
  assert.match(lesDeux, /\.wt-42/)
  assert.match(lesDeux, /chantier\/42/)
})

test('resumeDeChantier imprime les quatre faits, un par ligne', () => {
  const vu = resumeDeChantier({ cible: '/dep/.wt-42', branche: 'chantier/42', base: 'abc1234', port: 5200, url: 'http://localhost:5200/' })
  assert.deepEqual(vu.split('\n'), [
    'worktree=/dep/.wt-42',
    'branche=chantier/42',
    'base=abc1234',
    'port=5200 (http://localhost:5200/)',
  ])
})

test('nom invalide : refus NOMMÉ, et aucun git n’est joué', () => {
  let joue = 0
  const vu = creerChantier({ racine: '/dep', nom: 'Publication', git: () => { joue += 1 }, fetch: () => { joue += 1 } })
  assert.equal(vu.ok, false)
  assert.match(vu.refus, /nom de chantier invalide/)
  assert.match(vu.refus, /numéro de ticket/)
  assert.equal(joue, 0, 'un nom refusé ne déclenche aucune commande')
})

/** Dépôt jetable + son `origin` NU, avec `origin/main` réellement posé. */
function depotAvecOrigin() {
  const nu = mkdtempSync(join(tmpdir(), 'origin-nu-'))
  execFileSync('git', ['init', '--bare', '-q', '-b', 'main', nu], { encoding: 'utf8' })
  const { racine } = instanceDeDepot({ fichiers: { 'a.txt': 'a' }, message: 'fondation' })
  const git = (...args) => execFileSync('git', args, { cwd: racine, encoding: 'utf8' }).trim()
  git('remote', 'add', 'origin', nu)
  git('push', '-q', 'origin', 'main')
  return { racine, nu, git, jeter: () => { for (const d of [racine, nu]) rmSync(d, { recursive: true, force: true }) } }
}

test('création RÉELLE : worktree .wt-42 sur chantier/42 issue d’ORIGIN/main, puis refus du second appel', () => {
  const { racine, git, jeter } = depotAvecOrigin()
  try {
    // HEAD local DIVERGE d'origin/main (un commit non poussé) : un chantier parti de HEAD
    // emporterait ce commit, et le test ne le verrait pas si les deux shas étaient égaux.
    writeFileSync(join(racine, 'a.txt'), 'local non poussé')
    git('add', '-A'); git('commit', '-q', '-m', 'travail local non poussé')
    const teteLocale = git('rev-parse', 'HEAD')
    assert.notEqual(teteLocale, git('rev-parse', 'origin/main'))

    let npmVu = null
    const vu = creerChantier({ racine, nom: '42', sansCi: true, npm: (...a) => { npmVu = a; return { status: 0 } } })

    assert.equal(vu.ok, true, vu.refus)
    assert.equal(npmVu, null, '--sans-ci : npm n’est jamais appelé')
    const cible = cibleDe(racine, '42')
    assert.equal(existsSync(cible), true, 'le worktree est posé sur le disque')
    assert.equal(vu.branche, 'chantier/42')
    assert.equal(execFileSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], { cwd: cible, encoding: 'utf8' }).trim(), 'chantier/42')
    assert.equal(execFileSync('git', ['rev-parse', 'HEAD'], { cwd: cible, encoding: 'utf8' }).trim(),
      git('rev-parse', 'origin/main'), 'le chantier part d’origin/main')
    assert.notEqual(execFileSync('git', ['rev-parse', 'HEAD'], { cwd: cible, encoding: 'utf8' }).trim(), teteLocale,
      'et surtout PAS de HEAD local')
    assert.match(vu.resume, new RegExp(`branche=${brancheDe('42')}`))
    assert.match(vu.resume, /^port=\d+ \(http:\/\/localhost:\d+\/\)$/m)

    const second = creerChantier({ racine, nom: '42', sansCi: true })
    assert.equal(second.ok, false)
    assert.match(second.refus, /déjà ouvert/, 'cible ET branche : le refus les nomme toutes les deux')
    assert.match(second.refus, /\.wt-42/)
  } finally { jeter() }
})

test('npm ci ROUGE : le worktree RESTE, et le refus dit quoi relancer où', () => {
  const { racine, jeter } = depotAvecOrigin()
  try {
    const appels = []
    const vu = creerChantier({ racine, nom: '43', npm: (cmd, args, opts) => { appels.push({ cmd, args, cwd: opts.cwd }); return { status: 1 } } })
    assert.equal(vu.ok, false)
    assert.equal(appels.length, 1)
    assert.deepEqual(appels[0].args, ['ci', '--no-audit', '--no-fund'])
    assert.equal(appels[0].cwd, cibleDe(racine, '43'), 'npm ci se joue DANS le worktree neuf')
    assert.match(appels[0].cmd, /^npm(\.cmd)?$/)
    assert.equal(existsSync(cibleDe(racine, '43')), true, 'un npm ci rouge ne défait pas le worktree')
    assert.match(vu.refus, /worktree posé, npm ci rouge/)
    assert.doesNotMatch(vu.refus, /server/, 'la racine est en cause : ne pas nommer le sous-projet')
    assert.match(vu.refus, /\.wt-43/)
  } finally { jeter() }
})

// La table `EQUIPEMENTS` est DÉRIVÉE des `prerequis` d'`ECRIT_LU` : ce qu'une gate exige est posé
// par l'ouverture sans second geste.
describe('equipementsDesPrerequis', () => {
  // Fixture LOCALE au describe : deux gates portant le MÊME pose, plus un sous-projet de plus.
  const ECRIT_LU_FIXTURE = {
    'a:gate': { prerequis: [{ chemin: 'server/node_modules', pose: 'npm --prefix server ci' }] },
    'b:gate': { prerequis: [{ chemin: 'server/node_modules', pose: 'npm --prefix server ci' }] },
    'c:gate': { prerequis: [{ chemin: 'outil/node_modules', pose: 'npm --prefix outil ci' }] },
    'd:gate': { ecrit: [], lit: ['src/'] },
  }

  test('sur la table RÉELLE : la racine, puis le seul prérequis déclaré (server/)', () => {
    assert.deepEqual(EQUIPEMENTS, [
      { args: ['ci', '--no-audit', '--no-fund'], ou: '', relance: 'npm ci' },
      { args: ['--prefix', 'server', 'ci', '--no-audit', '--no-fund'], ou: ' dans server/', relance: 'npm --prefix server ci' },
    ])
  })

  test('un pose PARTAGÉ ne se pose qu’une fois ; un sous-projet de plus arrive en DERNIER', () => {
    const vu = [{ args: ['ci', '--no-audit', '--no-fund'], ou: '', relance: 'npm ci' }, ...equipementsDesPrerequis(ECRIT_LU_FIXTURE)]
    assert.equal(vu.length, 3)
    assert.deepEqual(vu.map((e) => e.relance), ['npm ci', 'npm --prefix server ci', 'npm --prefix outil ci'])
    assert.deepEqual(vu[2], { args: ['--prefix', 'outil', 'ci', '--no-audit', '--no-fund'], ou: ' dans outil/', relance: 'npm --prefix outil ci' })
  })

  test('un pose qui n’est pas du npm est REFUSÉ en nommant la gate et le pose', () => {
    assert.throws(
      () => equipementsDesPrerequis({ 'z:gate': { prerequis: [{ chemin: 'z/node_modules', pose: 'pnpm i' }] } }),
      (e) => /prérequis non posable/.test(e.message) && /z:gate/.test(e.message) && /pnpm i/.test(e.message),
    )
  })

  test('la table réelle ne déclare que des poses npm (aucun refus au chargement)', () => {
    assert.doesNotThrow(() => equipementsDesPrerequis(ECRIT_LU))
  })
})

// Le sous-projet `server/` a ses PROPRES dépendances, et `server:typecheck` les déclare en prérequis
// (`prerequis` d'`ECRIT_LU`, scripts/gates/toutes.mjs) : un chantier équipé de la seule racine rend
// cette gate ROUGE après la série entière (mesuré le 2026-09-14, 3ᵉ train réel). L'ordre est le
// sujet : `npm --prefix server ci` ne peut pas précéder le `npm ci` de la racine.
test('équipement : npm ci à la RACINE puis dans server/, dans cet ordre, tous deux DANS le worktree', () => {
  const { racine, jeter } = depotAvecOrigin()
  try {
    const appels = []
    const vu = creerChantier({ racine, nom: '47', npm: (cmd, args, opts) => { appels.push({ cmd, args, cwd: opts.cwd }); return { status: 0 } } })
    assert.equal(vu.ok, true, vu.refus)
    assert.equal(vu.npmJoue, true)
    assert.deepEqual(appels.map((a) => a.args), [
      ['ci', '--no-audit', '--no-fund'],
      ['--prefix', 'server', 'ci', '--no-audit', '--no-fund'],
    ])
    assert.deepEqual([...new Set(appels.map((a) => a.cwd))], [cibleDe(racine, '47')],
      'les deux se jouent DANS le worktree neuf (le sous-projet par --prefix, jamais par un cwd)')
  } finally { jeter() }
})

test('npm ci rouge dans server/ : la racine reste faite, et le refus NOMME le sous-projet', () => {
  const { racine, jeter } = depotAvecOrigin()
  try {
    const appels = []
    const vu = creerChantier({
      racine,
      nom: '48',
      npm: (cmd, args, opts) => { appels.push(args); return { status: args.includes('--prefix') ? 1 : 0, cwd: opts.cwd } },
    })
    assert.equal(vu.ok, false)
    assert.equal(appels.length, 2, 'la racine a été équipée avant que server/ ne tombe')
    assert.match(vu.refus, /npm ci rouge dans server\//)
    assert.match(vu.refus, /npm --prefix server ci/, 'le refus porte la commande qui rejoue CE ci')
    assert.match(vu.refus, /\.wt-48/)
    assert.equal(existsSync(cibleDe(racine, '48')), true, 'un npm ci rouge ne défait pas le worktree')
  } finally { jeter() }
})

test('lancé depuis un WORKTREE : refus, jamais un worktree imbriqué', () => {
  const { racine, jeter } = depotAvecOrigin()
  try {
    assert.equal(creerChantier({ racine, nom: '44', sansCi: true }).ok, true)
    const dansLeWorktree = creerChantier({ racine: cibleDe(racine, '44'), nom: '45', sansCi: true })
    assert.equal(dansLeWorktree.ok, false)
    assert.match(dansLeWorktree.refus, /arbre principal/)
    assert.equal(existsSync(join(cibleDe(racine, '44'), '.wt-45')), false, 'rien n’a été posé sous le worktree')
  } finally { jeter() }
})

test('origin injoignable : refus qui NOMME la raison, et aucun worktree posé', () => {
  const { racine, jeter } = depotAvecOrigin()
  try {
    const vu = creerChantier({ racine, nom: '46', sansCi: true, fetch: () => ({ disponible: false, raison: 'réseau coupé' }) })
    assert.equal(vu.ok, false)
    assert.match(vu.refus, /réseau coupé/)
    assert.equal(existsSync(cibleDe(racine, '46')), false)
  } finally { jeter() }
})
