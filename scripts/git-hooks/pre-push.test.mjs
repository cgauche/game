// Porte au PUSH (#1679 L2) — fixture : un VRAI dépôt jetable, son propre `ci.yml` minimal, un
// `origin` dont l'URL est celle du dépôt du projet (aucun push n'est joué : le hook est appelé
// directement, comme git l'appelle, refs sur stdin).
// La CI de `main` est fournie par `WFRP_GH_STUB=<fichier json>` (même forme que `gh run list --json
// conclusion,databaseId,headSha`) ; un chemin illisible vaut « gh absent / hors-ligne ».
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { cheminJustificatifs, ecrireJustificatif } from '../guards/lib/justificatif.mjs'
import { jugerPush, refsAPousser, urlOrigineAcceptee } from './pre-push.mjs'

const ICI = dirname(fileURLToPath(import.meta.url))

const ZERO = '0'.repeat(40)

// Chemin de doc ASSEMBLÉ : un littéral `docs/<nom>.md` dans une fixture est lu par
// `scripts/docs/check-doc-refs.mjs` comme une référence vivante — qu'il déclare morte.
const DOC_A = ['docs', 'a.md'].join('/')

const git = (cwd) => (args) => execFileSync('git', args, { cwd, encoding: 'utf8' }).trim()

function ecrire(racine, rel, texte) {
  mkdirSync(join(racine, dirname(rel)), { recursive: true })
  writeFileSync(join(racine, rel), texte)
}

/** Dépôt jetable : deux gates au `ci.yml` (`npm test`, `npm run typecheck`), un origin conforme. */
function depot() {
  const racine = mkdtempSync(join(tmpdir(), 'pre-push-'))
  const g = git(racine)
  g(['init', '--initial-branch=main'])
  g(['config', 'user.email', 'mesure@example.invalid'])
  g(['config', 'user.name', 'mesure'])
  g(['remote', 'add', 'origin', 'https://github.com/cgauche/game.git'])
  ecrire(
    racine,
    '.github/workflows/ci.yml',
    ['jobs:', '  build:', '    steps:', '      - run: npm ci', '      - run: npm test', '      - run: npm run typecheck', ''].join('\n'),
  )
  ecrire(racine, 'src/a.ts', 'export const a = 1\n')
  ecrire(racine, DOC_A, 'doc\n')
  g(['add', '-A'])
  g(['commit', '-m', 'fondation'])
  return racine
}

const jeter = (racine) => rmSync(racine, { recursive: true, force: true })

/** Réponse `gh` posée sur disque, rendue en variable d'environnement de mesure. */
function stubCi(racine, courses) {
  const fichier = join(racine, 'gh.json')
  writeFileSync(fichier, JSON.stringify(courses))
  return { WFRP_GH_STUB: fichier }
}

const ciVerte = (racine) => stubCi(racine, [{ conclusion: 'success', databaseId: 1, headSha: 'abc1234' }])
const ciRouge = (racine) => stubCi(racine, [{ conclusion: 'failure', databaseId: 33691303703, headSha: 'def5678' }])

/** Toutes les gates du `ci.yml` de la fixture, vertes sur le contenu de HEAD. */
function gatesVertes(racine) {
  const sha = git(racine)(['rev-parse', 'HEAD'])
  for (const gate of ['test', 'typecheck']) ecrireJustificatif({ cwd: racine, gate, sha })
  return sha
}

const pousse = (racine, { sha, base = ZERO } = {}) =>
  `refs/heads/main ${sha ?? git(racine)(['rev-parse', 'HEAD'])} refs/heads/main ${base}\n`

test('aucun justificatif : refus nommant TOUTES les gates de ci.yml et la commande qui les produit', () => {
  const racine = depot()
  try {
    const { refus } = jugerPush({ cwd: racine, stdin: pousse(racine), env: ciVerte(racine) })
    assert.match(refus.join('\n'), /2\/2 gate\(s\) sans justificatif/)
    assert.match(refus.join('\n'), /gate « test » jamais jouée sur ce contenu — la produire : npm test/)
    assert.match(refus.join('\n'), /gate « typecheck » jamais jouée sur ce contenu — la produire : npm run typecheck/)
    assert.match(refus.join('\n'), /npm run gates/)
  } finally {
    jeter(racine)
  }
})

test('une seule gate manquante : refus qui la NOMME, elle et pas les autres', () => {
  const racine = depot()
  try {
    ecrireJustificatif({ cwd: racine, gate: 'test', sha: git(racine)(['rev-parse', 'HEAD']) })
    const { refus } = jugerPush({ cwd: racine, stdin: pousse(racine), env: ciVerte(racine) })
    assert.match(refus.join('\n'), /1\/2 gate\(s\)/)
    assert.match(refus.join('\n'), /gate « typecheck » jamais jouée/)
    assert.ok(!refus.join('\n').includes('« test »'))
  } finally {
    jeter(racine)
  }
})

test('gate ROUGE : refus qui dit le statut', () => {
  const racine = depot()
  try {
    const sha = git(racine)(['rev-parse', 'HEAD'])
    ecrireJustificatif({ cwd: racine, gate: 'test', sha, statut: 'rouge' })
    ecrireJustificatif({ cwd: racine, gate: 'typecheck', sha })
    const { refus } = jugerPush({ cwd: racine, stdin: pousse(racine), env: ciVerte(racine) })
    assert.match(refus.join('\n'), /gate « test » au statut rouge/)
  } finally {
    jeter(racine)
  }
})

test('gate jouée sur un arbre SALE : refus qui nomme les chemins non committés', () => {
  const racine = depot()
  try {
    ecrire(racine, 'src/b.ts', 'export const b = 1\n')
    gatesVertes(racine)
    const { refus } = jugerPush({ cwd: racine, stdin: pousse(racine), env: ciVerte(racine) })
    assert.match(refus.join('\n'), /jouée sur un arbre SALE \(\?\? src\/b\.ts\)/)
  } finally {
    jeter(racine)
  }
})

test('le contenu a bougé APRÈS la gate : la clé diverge, refus', () => {
  const racine = depot()
  const g = git(racine)
  try {
    gatesVertes(racine)
    ecrire(racine, 'src/a.ts', 'export const a = 2\n')
    g(['add', '-A'])
    g(['commit', '-m', 'code après la gate'])
    const { refus } = jugerPush({ cwd: racine, stdin: pousse(racine), env: ciVerte(racine) })
    assert.match(refus.join('\n'), /2\/2 gate\(s\) sans justificatif/)
  } finally {
    jeter(racine)
  }
})

test('commit `docs/` seul après la gate : clé égale, sha différent → PASSE avec la mention', () => {
  const racine = depot()
  const g = git(racine)
  try {
    const shaGate = gatesVertes(racine)
    ecrire(racine, DOC_A, 'doc régénéré\n')
    g(['add', '-A'])
    g(['commit', '-m', 'docs seuls'])
    const { refus, notes } = jugerPush({ cwd: racine, stdin: pousse(racine), env: ciVerte(racine) })
    assert.deepEqual(refus, [])
    assert.match(notes.join('\n'), new RegExp(`justificatif de ${shaGate.slice(0, 7)} réutilisé`))
    assert.match(notes.join('\n'), /contenu identique — pour chaque gate, sur le périmètre qui la gouverne/)
  } finally {
    jeter(racine)
  }
})

test('push NON fast-forward : refus nommant la ref et les deux shas', () => {
  const racine = depot()
  const g = git(racine)
  try {
    const premier = g(['rev-parse', 'HEAD'])
    ecrire(racine, 'src/a.ts', 'export const a = 2\n')
    g(['add', '-A'])
    g(['commit', '-m', 'second'])
    const second = g(['rev-parse', 'HEAD'])
    const { refus } = jugerPush({ cwd: racine, stdin: `refs/heads/main ${premier} refs/heads/main ${second}\n`, env: ciVerte(racine) })
    assert.match(refus.join('\n'), new RegExp(`push non fast-forward vers refs/heads/main : ${second.slice(0, 7)}`))
  } finally {
    jeter(racine)
  }
})

test('CI de main ROUGE : refus nommant le run et son sha', () => {
  const racine = depot()
  try {
    gatesVertes(racine)
    const { refus } = jugerPush({ cwd: racine, stdin: pousse(racine), env: ciRouge(racine) })
    assert.match(refus.join('\n'), /CI de main en ÉCHEC — run 33691303703 sur def5678/)
    assert.match(refus.join('\n'), /WFRP_PUSH_SUR_ROUGE=1/)
  } finally {
    jeter(racine)
  }
})

test('dérogation motivée sur CI rouge : passe, et la ligne part au JOURNAL', () => {
  const racine = depot()
  try {
    const sha = gatesVertes(racine)
    const env = {
      ...ciRouge(racine),
      WFRP_PUSH_SUR_ROUGE: '1',
      WFRP_DEROGATION: 'correctif de la CI rouge elle-même',
    }
    const { refus, notes } = jugerPush({ cwd: racine, stdin: pousse(racine), env })
    assert.deepEqual(refus, [])
    assert.match(notes.join('\n'), /DÉROGATION journalisée : correctif de la CI rouge elle-même/)
    const journal = readFileSync(join(cheminJustificatifs({ cwd: racine }), 'derogations.log'), 'utf8')
    assert.match(journal, new RegExp(`\\t${sha}\\tcorrectif de la CI rouge elle-même\\n$`))
  } finally {
    jeter(racine)
  }
})

test('dérogation SANS raison suffisante : refusée comme si elle n’existait pas', () => {
  const racine = depot()
  try {
    gatesVertes(racine)
    const env = { ...ciRouge(racine), WFRP_PUSH_SUR_ROUGE: '1', WFRP_DEROGATION: 'trop court' }
    const { refus } = jugerPush({ cwd: racine, stdin: pousse(racine), env })
    assert.match(refus.join('\n'), /CI de main en ÉCHEC/)
    assert.ok(!existsSync(join(cheminJustificatifs({ cwd: racine }), 'derogations.log')))
  } finally {
    jeter(racine)
  }
})

test('`gh` indisponible : la CI n’est pas consultée — c’est DIT, et le push passe', () => {
  const racine = depot()
  try {
    gatesVertes(racine)
    const { refus, notes } = jugerPush({
      cwd: racine,
      stdin: pousse(racine),
      env: { WFRP_GH_STUB: join(racine, 'gh-absent.json') },
    })
    assert.deepEqual(refus, [])
    assert.match(notes.join('\n'), /CI de main non consultée : /)
  } finally {
    jeter(racine)
  }
})

test('origin étranger : refus nommant l’URL vue', () => {
  const racine = depot()
  try {
    gatesVertes(racine)
    git(racine)(['remote', 'set-url', 'origin', 'https://github.com/quelquun/autre.git'])
    const { refus } = jugerPush({ cwd: racine, stdin: pousse(racine), env: ciVerte(racine) })
    assert.match(refus.join('\n'), /origin = « https:\/\/github\.com\/quelquun\/autre\.git » : ce hook ne connaît que github\.com\/cgauche\/game/)
  } finally {
    jeter(racine)
  }
})

test('un ci.yml au step non classé fait refuser le push (fail-closed), pas passer', () => {
  const racine = depot()
  try {
    gatesVertes(racine)
    ecrire(racine, '.github/workflows/ci.yml', ['jobs:', '  build:', '    steps:', '      - run: ./outil-maison.sh', ''].join('\n'))
    const { refus } = jugerPush({ cwd: racine, stdin: pousse(racine), env: ciVerte(racine) })
    assert.match(refus.join('\n'), /step non classé/)
  } finally {
    jeter(racine)
  }
})

test('le hook JOUÉ comme git le joue : refs sur stdin, exit 1, filigrane d’arbre au refus', () => {
  const racine = depot()
  try {
    const vu = spawnSync(process.execPath, [join(ICI, 'pre-push.mjs')], {
      cwd: racine,
      input: pousse(racine),
      encoding: 'utf8',
      env: { ...process.env, ...ciVerte(racine) },
    })
    assert.equal(vu.status, 1)
    assert.match(vu.stderr, /pre-push REFUSÉ/)
    assert.match(vu.stderr, /\[pre-push\] arbre [0-9a-f]{7} « fondation »/)
  } finally {
    jeter(racine)
  }
})

test('le hook JOUÉ toutes gates vertes : exit 0, et il dit combien de refs il a jugées', () => {
  const racine = depot()
  try {
    gatesVertes(racine)
    const vu = spawnSync(process.execPath, [join(ICI, 'pre-push.mjs')], {
      cwd: racine,
      input: pousse(racine),
      encoding: 'utf8',
      env: { ...process.env, ...ciVerte(racine) },
    })
    assert.equal(vu.status, 0)
    assert.match(vu.stderr, /1 ref\(s\) jugée\(s\) — porte franchie/)
  } finally {
    jeter(racine)
  }
})

test('une SUPPRESSION de branche n’est pas une tête à juger', () => {
  assert.deepEqual(refsAPousser(`refs/heads/x ${ZERO} refs/heads/x abc\n`), [])
  assert.equal(refsAPousser('refs/heads/main abc refs/heads/main def\n').length, 1)
})

test('l’URL d’origine acceptée : https et ssh du dépôt du projet, rien d’autre', () => {
  assert.equal(urlOrigineAcceptee('https://github.com/cgauche/game.git'), true)
  assert.equal(urlOrigineAcceptee('git@github.com:cgauche/game'), true)
  assert.equal(urlOrigineAcceptee('https://github.com/cgauche/game-fork.git'), false)
  assert.equal(urlOrigineAcceptee(''), false)
})

// s13 promu — TROU DE CLÉ : une gate dont les ENTRÉES vivent sous `docs/` ne se réutilise PAS après
// un commit qui change ces entrées (classe de l'incident 17926d5de) ; une gate qui ne les lit pas,
// si. Le `ci.yml` de ce dépôt-là joue les deux familles.
test('une gate qui lit docs/ n’est PAS réutilisée après un commit docs/ ; les autres le sont', () => {
  const racine = mkdtempSync(join(tmpdir(), 'trou-cle-'))
  const g = git(racine)
  try {
    g(['init', '--initial-branch=main'])
    g(['config', 'user.email', 'mesure@example.invalid'])
    g(['config', 'user.name', 'mesure'])
    g(['remote', 'add', 'origin', 'https://github.com/cgauche/game.git'])
    ecrire(
      racine,
      '.github/workflows/ci.yml',
      ['jobs:', '  build:', '    steps:', '      - run: npm run docs:check', '      - run: npm run lint', ''].join('\n'),
    )
    ecrire(racine, 'src/a.ts', 'export const a = 1\n')
    ecrire(racine, ['docs', 'raw', 'combat.md'].join('/'), 'Atlas v1\n')
    g(['add', '-A'])
    g(['commit', '-m', 'fondation'])
    const shaA = g(['rev-parse', 'HEAD'])
    for (const gate of ['docs:check', 'lint']) ecrireJustificatif({ cwd: racine, gate, sha: shaA })

    ecrire(racine, ['docs', 'raw', 'combat.md'].join('/'), 'Atlas CASSÉ — référence morte vers src/inexistant.ts\n')
    g(['add', '-A'])
    g(['commit', '-m', 'Atlas cassé'])
    const shaB = g(['rev-parse', 'HEAD'])

    const { refus } = jugerPush({
      cwd: racine,
      stdin: `refs/heads/main ${shaB} refs/heads/main ${shaA}\n`,
      env: ciVerte(racine),
    })
    assert.match(
      refus.join('\n'),
      /gate « docs:check » jouée sur un AUTRE arbre : elle lit docs\//,
      'le contenu que docs:check LIT a changé : son vert d’avant ne dit plus rien',
    )
    assert.ok(!refus.join('\n').includes('« lint »'), 'lint ne lit pas docs/ : son justificatif reste valable')
  } finally {
    jeter(racine)
  }
})

// s4 cas 1 promu — une ref distante INEXISTANTE ne peut être écrasée : le contrôle fast-forward ne
// s'y applique pas (le repli sur `origin/main` refusait toute branche de travail partie d'un point
// ancien, ce qu'aucune règle n'interdit).
test('branche NEUVE non descendante d’origin/main : PASSE, et la note le dit', () => {
  const racine = depot()
  const g = git(racine)
  try {
    const shaA = g(['rev-parse', 'HEAD'])
    ecrire(racine, 'src/b.ts', 'export const b = 1\n')
    g(['add', '-A'])
    g(['commit', '-m', 'avance de main'])
    g(['update-ref', 'refs/remotes/origin/main', g(['rev-parse', 'HEAD'])])
    for (const gate of ['test', 'typecheck']) ecrireJustificatif({ cwd: racine, gate, sha: shaA })
    const { refus, notes } = jugerPush({
      cwd: racine,
      stdin: `refs/heads/wt-agent ${shaA} refs/heads/wt-agent ${ZERO}\n`,
      env: ciVerte(racine),
    })
    assert.deepEqual(refus, [])
    assert.match(notes.join('\n'), /refs\/heads\/wt-agent n’existe pas encore côté distant/)
  } finally {
    jeter(racine)
  }
})
