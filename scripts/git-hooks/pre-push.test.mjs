// Porte au PUSH (#1679 L2) — fixture : un VRAI dépôt jetable, son propre `ci.yml` minimal, un
// `origin` dont l'URL est celle du dépôt du projet et une ref `refs/remotes/origin/main` (aucun push
// n'est joué : le hook est appelé directement, comme git l'appelle, refs sur stdin).
// Les courses de `main` sont fournies par `WFRP_GH_STUB=<fichier json>` (`coursesCi.mjs`), qui
// dispense aussi du `git fetch` : la fixture porte elle-même l'état d'`origin`. La FRAÎCHEUR se juge
// par identité — une course doit porter la tête d'`origin/main` —, donc les stubs la nomment.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  cheminJustificatifs,
  clesDeContenu,
  ecrireJustificatif,
  fichierDeJustificatif,
  segmentDeGate,
} from '../guards/lib/justificatif.mjs'
import { exportsDuProcessus } from '../migrations/replay-head.mjs'
import { armeLeRejeu, jugerPush, refsAPousser, urlOrigineAcceptee, verdictCi } from './pre-push.mjs'
import { reinitialiserStub } from '../guards/lib/coursesCi.mjs'

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
  // `origin/main` : la RÉFÉRENCE de fraîcheur de la porte. Sans elle, la CI est « non consultable »
  // — ce qui est le verdict juste, mais pas celui que ces cas-là mesurent.
  g(['update-ref', 'refs/remotes/origin/main', g(['rev-parse', 'HEAD'])])
  return racine
}

const jeter = (racine) => rmSync(racine, { recursive: true, force: true })

/** Tête d'`origin/main` de la fixture — le sha que les courses doivent porter pour être concluantes. */
const teteMain = (racine) => git(racine)(['rev-parse', 'origin/main'])

/** Réponse posée sur disque, rendue en variable d'environnement de mesure. Un tableau = la même
 *  liste à chaque appel ; `{ appels: [...] }` = une liste PAR APPEL. */
function stubCi(racine, contenu) {
  reinitialiserStub()
  const fichier = join(racine, 'gh.json')
  writeFileSync(fichier, JSON.stringify(contenu))
  return { WFRP_GH_STUB: fichier }
}

const course = (racine, plus = {}) => ({
  conclusion: 'success',
  status: 'completed',
  databaseId: 1,
  headSha: teteMain(racine),
  createdAt: '2026-09-05T10:00:00Z',
  ...plus,
})

const ciVerte = (racine) => stubCi(racine, [course(racine)])
const ciRouge = (racine) => stubCi(racine, [course(racine, { conclusion: 'failure', databaseId: 33691303703 })])

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

test('magasin à l’ANCIENNE graphie : le hook le migre à l’ouverture, puis juge VERT', () => {
  const racine = depot()
  try {
    const sha = git(racine)(['rev-parse', 'HEAD'])
    const cles = clesDeContenu(sha, { cwd: racine })
    // Ancienne graphie : UN fichier par gate, clé et propreté dans le CONTENU — invisible au lecteur.
    const dossier = join(cheminJustificatifs({ cwd: racine }), cles.cleTree)
    mkdirSync(dossier, { recursive: true })
    for (const gate of ['test', 'typecheck'])
      writeFileSync(
        join(dossier, `${segmentDeGate(gate)}.json`),
        `${JSON.stringify({ gate, cleTree: cles.cleTree, cleComplete: cles.cleComplete, sha, statut: 'vert', date: '2026-09-01T00:00:00.000Z', sale: false, salis: [] })}\n`,
      )

    const { refus, notes } = jugerPush({ cwd: racine, stdin: pousse(racine), env: ciVerte(racine) })
    assert.deepEqual(refus, [], 'les preuves sont là : le hook doit les VOIR après migration')
    assert.match(notes.join('\n'), /2 justificatif\(s\) passé\(s\) à la graphie courante/)
    assert.deepEqual(
      readdirSync(dossier).sort(),
      ['test', 'typecheck'].map((gate) => fichierDeJustificatif({ gate, cle: cles.cleTree, sale: false })).sort(),
    )
  } finally {
    jeter(racine)
  }
})

test('justificatif ILLISIBLE : le push est refusé comme s’il manquait, en nommant la gate', () => {
  // Un justificatif n'existe qu'au VERT (l'enveloppe n'écrit rien au rouge) : ce qui reste à juger
  // ici, c'est un fichier présent mais illisible — il ne prouve rien, donc il ne crédite rien.
  const racine = depot()
  try {
    const sha = git(racine)(['rev-parse', 'HEAD'])
    const { fichier } = ecrireJustificatif({ cwd: racine, gate: 'test', sha })
    ecrireJustificatif({ cwd: racine, gate: 'typecheck', sha })
    writeFileSync(fichier, '{ tronqué\n')
    const { refus } = jugerPush({ cwd: racine, stdin: pousse(racine), env: ciVerte(racine) })
    assert.match(refus.join('\n'), /1\/2 gate\(s\)/)
    assert.match(refus.join('\n'), /gate « test » jamais jouée sur ce contenu/)
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

// Sonde du juge de diff (2026-09-05) promue : `failure` n'est pas la seule conclusion d'ÉCHEC que
// GitHub rend. Mesuré sur la porte AVANT correction : `timed_out` et `startup_failure` donnaient
// refus=0 — le push passait sur une CI qui n'est pas verte, contre le régime du 2026-09-01.
for (const conclusion of ['failure', 'timed_out', 'startup_failure']) {
  test(`CI de main ROUGE (${conclusion}) : refus, et la conclusion est NOMMÉE`, () => {
    const racine = depot()
    try {
      gatesVertes(racine)
      const env = stubCi(racine, [course(racine, { conclusion, databaseId: 900 })])
      const { refus } = jugerPush({ cwd: racine, stdin: pousse(racine), env })
      assert.match(refus.join('\n'), new RegExp(`CI de main en ÉCHEC \\(${conclusion}\\) — course 900`))
      assert.match(refus.join('\n'), /WFRP_PUSH_SUR_ROUGE=1/)
    } finally {
      jeter(racine)
    }
  })
}

test('CI de main ANNULÉE : NOTE nommée — ni vert ni rouge, et le verdict revient à l’ancêtre vert', () => {
  const racine = depot()
  const g = git(racine)
  try {
    const ancetre = g(['rev-parse', 'HEAD'])
    ecrire(racine, 'src/a.ts', 'export const a = 2\n')
    g(['add', '-A'])
    g(['commit', '-m', 'tete'])
    const tete = g(['rev-parse', 'HEAD'])
    g(['update-ref', 'refs/remotes/origin/main', tete])
    gatesVertes(racine)
    const annulee = { conclusion: 'cancelled', status: 'completed', databaseId: 900, headSha: tete, createdAt: '2026-09-05T12:00:00Z' }
    const vert = { conclusion: 'success', status: 'completed', databaseId: 800, headSha: ancetre, createdAt: '2026-09-05T09:00:00Z' }

    const avecAncetre = jugerPush({ cwd: racine, stdin: pousse(racine), env: stubCi(racine, [annulee, vert]) })
    assert.deepEqual(avecAncetre.refus, [], 'une annulation n’est pas un ÉCHEC : rien à imputer à ce contenu')
    assert.match(
      avecAncetre.notes.join('\n'),
      /ANNULÉE \(course 900 sur [0-9a-f]{7}\) : ce contenu n'a été jugé ni vert ni rouge/,
    )

    const sansAncetre = jugerPush({ cwd: racine, stdin: pousse(racine), env: stubCi(racine, [annulee]) })
    assert.match(sansAncetre.refus.join('\n'), /aucun commit de cette histoire n’est porté par une course VERTE/)
    assert.ok(!sansAncetre.refus.join('\n').includes('en ÉCHEC'), 'une annulation ne se travestit pas en échec')
  } finally {
    jeter(racine)
  }
})

test('CI de main ROUGE : refus nommant la course et son sha', () => {
  const racine = depot()
  try {
    gatesVertes(racine)
    const { refus } = jugerPush({ cwd: racine, stdin: pousse(racine), env: ciRouge(racine) })
    assert.match(refus.join('\n'), new RegExp(`CI de main en ÉCHEC \\(failure\\) — course 33691303703 sur ${teteMain(racine).slice(0, 7)}`))
    assert.match(refus.join('\n'), /WFRP_PUSH_SUR_ROUGE=1/)
  } finally {
    jeter(racine)
  }
})

test('dérogation motivée sur CI rouge : passe, et la ligne de TENTATIVE part au JOURNAL', () => {
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
    assert.match(notes.join('\n'), /DÉROGATION journalisée \(rouge\) : correctif de la CI rouge elle-même/)
    const journal = readFileSync(join(cheminJustificatifs({ cwd: racine }), 'derogations.log'), 'utf8')
    const ligne = JSON.parse(journal.trim())
    assert.equal(ligne.etat, 'tentative')
    assert.equal(ligne.motif, 'rouge')
    assert.equal(ligne.sha, sha)
    assert.equal(ligne.raison, 'correctif de la CI rouge elle-même')
    // Le hook précède le TRANSFERT : deux tentatives pour un seul push abouti sont normales, et le
    // journal doit le dire de lui-même (mesuré sur `c3692d0f9`, deux lignes, une course).
    jugerPush({ cwd: racine, stdin: pousse(racine), env })
    const relu = readFileSync(join(cheminJustificatifs({ cwd: racine }), 'derogations.log'), 'utf8')
    assert.equal(relu.trim().split('\n').length, 2)
    assert.ok(relu.trim().split('\n').every((l) => JSON.parse(l).etat === 'tentative'))
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

test('`gh` indisponible (hors ligne) : refus NON CONSULTABLE, et son levier propre', () => {
  // Un push hors ligne ne prouve RIEN de la CI. L'ancien régime le laissait passer en note : la
  // porte disait alors « pas de rouge vu » là où elle n'avait rien lu.
  const racine = depot()
  try {
    gatesVertes(racine)
    const { refus } = jugerPush({
      cwd: racine,
      stdin: pousse(racine),
      env: { WFRP_GH_STUB: join(racine, 'gh-absent.json') },
    })
    assert.match(refus.join('\n'), /CI de `main` non consultable/)
    assert.match(refus.join('\n'), /WFRP_PUSH_CI_NON_CONSULTABLE=1/)
    assert.ok(!refus.join('\n').includes('WFRP_PUSH_SUR_ROUGE'), 'le levier du ROUGE ne franchit pas une panne de lecture')
  } finally {
    jeter(racine)
  }
})

test('hors ligne + levier NON CONSULTABLE motivé : passe, et le journal porte le motif mesuré', () => {
  const racine = depot()
  try {
    gatesVertes(racine)
    const { refus } = jugerPush({
      cwd: racine,
      stdin: pousse(racine),
      env: {
        WFRP_GH_STUB: join(racine, 'gh-absent.json'),
        WFRP_PUSH_CI_NON_CONSULTABLE: '1',
        WFRP_DEROGATION: 'push hors ligne depuis le train, CI relue au retour',
      },
    })
    assert.deepEqual(refus, [])
    const ligne = JSON.parse(readFileSync(join(cheminJustificatifs({ cwd: racine }), 'derogations.log'), 'utf8').trim())
    assert.equal(ligne.motif, 'non-consultable')
  } finally {
    jeter(racine)
  }
})

test('les leviers ne se franchissent PAS l’un l’autre (croisé)', () => {
  const racine = depot()
  try {
    gatesVertes(racine)
    const motive = 'une raison de vingt caractères au moins, mesurée'
    // ROUGE lu + levier de la NON-CONSULTATION : refusé.
    const surRouge = jugerPush({
      cwd: racine,
      stdin: pousse(racine),
      env: { ...ciRouge(racine), WFRP_PUSH_CI_NON_CONSULTABLE: '1', WFRP_DEROGATION: motive },
    })
    assert.match(surRouge.refus.join('\n'), /CI de main en ÉCHEC/)
    // Lecture impossible + levier du ROUGE : refusé aussi.
    const horsLigne = jugerPush({
      cwd: racine,
      stdin: pousse(racine),
      env: {
        WFRP_GH_STUB: join(racine, 'gh-absent.json'),
        WFRP_PUSH_SUR_ROUGE: '1',
        WFRP_DEROGATION: motive,
      },
    })
    assert.match(horsLigne.refus.join('\n'), /non consultable/)
  } finally {
    jeter(racine)
  }
})

// Session #1508 (2026-09-05) : « `gh` a servi une liste périmée une fois … le second push, 2 min plus
// tard, est passé ». La liste servie ne porte PAS la tête de `main` : elle n'est pas concluante, donc
// elle est RELUE — et c'est la relecture qui décide, jamais une horloge.
test('liste PÉRIMÉE (#1508) : relue une fois, et le verdict est celui de la RELECTURE', () => {
  const racine = depot()
  try {
    gatesVertes(racine)
    const env = stubCi(racine, {
      appels: [
        [{ conclusion: 'failure', status: 'completed', databaseId: 7, headSha: 'ancien30aout', createdAt: '2026-08-30T09:00:00Z' }],
        [course(racine)],
      ],
    })
    const { refus, notes } = jugerPush({ cwd: racine, stdin: pousse(racine), env })
    assert.deepEqual(refus, [], 'la relecture porte la tête de main et elle est VERTE')
    assert.match(notes.join('\n'), /aucune course ne porte la tête de main [0-9a-f]{9} : la liste est relue une fois/)
  } finally {
    jeter(racine)
  }
})

test('liste toujours non concluante après relecture : refus PÉRIMÉE qui nomme la tête cherchée', () => {
  const racine = depot()
  try {
    gatesVertes(racine)
    const env = stubCi(racine, [{ conclusion: 'success', status: 'completed', databaseId: 7, headSha: 'unautre', createdAt: '2026-08-30T09:00:00Z' }])
    const { refus } = jugerPush({ cwd: racine, stdin: pousse(racine), env })
    assert.match(refus.join('\n'), new RegExp(`aucune course pour la tête de \`main\` ${teteMain(racine).slice(0, 9)}`))
    assert.match(refus.join('\n'), /liste périmée ou course pas encore créée/)
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
    g(['update-ref', 'refs/remotes/origin/main', shaA])
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

// P1.4 (#1613) — le job `migrations` de la CI est le seul qu'aucun justificatif ne couvre : le
// pre-push le JOUE, sur un EXPORT de la tête, et seulement quand la plage poussée touche ce qu'il
// mesure. La migration de fixture est NON IDEMPOTENTE (elle réécrit `src/data/props.json`).
const MIGRATION_NON_IDEMPOTENTE = `/**
 * FIXTURE : migration NON IDEMPOTENTE.
 * ENTRÉES : \`src/data/props.json\`.
 */
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const f = ROOT + 'src/data/props.json';
const j = JSON.parse(fs.readFileSync(f, 'utf8'));
j.__sonde_non_idempotente = Date.now();
fs.writeFileSync(f, JSON.stringify(j, null, 2) + '\\n');
`


test('plage touchant `src/data` + une migration NON IDEMPOTENTE : refus nommant la donnée réécrite', () => {
  const racine = depot()
  const g = git(racine)
  try {
    const base = g(['rev-parse', 'HEAD'])
    ecrire(racine, 'src/data/props.json', `${JSON.stringify({ props: [] }, null, 2)}\n`)
    ecrire(racine, 'scripts/migrations/2026-09-03-fixture.mjs', MIGRATION_NON_IDEMPOTENTE)
    g(['add', '-A'])
    g(['commit', '-m', 'donnée + migration'])
    gatesVertes(racine)
    const { refus } = jugerPush({ cwd: racine, stdin: pousse(racine, { base }), env: ciVerte(racine) })
    const dit = refus.join('\n')
    assert.match(dit, /rejeu des migrations ROUGE sur l’export/)
    assert.match(dit, /DONNÉE RÉÉCRITE|RÉÉCRITE\(S\)/)
    assert.match(dit, /src\/data\/props\.json/)
    assert.match(dit, /npm run migrations:replay:head/)
  } finally {
    jeter(racine)
  }
})

test('plage touchant `src/data` avec des migrations IDEMPOTENTES : le rejeu passe et sa durée est dite', () => {
  const racine = depot()
  const g = git(racine)
  try {
    const base = g(['rev-parse', 'HEAD'])
    ecrire(racine, 'src/data/props.json', `${JSON.stringify({ props: [] }, null, 2)}\n`)
    ecrire(
      racine,
      'scripts/migrations/2026-09-03-idempotente.mjs',
      ['/** ENTRÉES : `src/data/props.json`. */', "import fs from 'node:fs';", "import { fileURLToPath } from 'node:url';", "const f = fileURLToPath(new URL('../../', import.meta.url)) + 'src/data/props.json';", 'fs.writeFileSync(f, fs.readFileSync(f));', ''].join('\n'),
    )
    g(['add', '-A'])
    g(['commit', '-m', 'donnée + migration idempotente'])
    gatesVertes(racine)
    const { refus, notes } = jugerPush({ cwd: racine, stdin: pousse(racine, { base }), env: ciVerte(racine) })
    assert.deepEqual(refus, [])
    assert.match(notes.join('\n'), /rejeu des migrations vert sur l’export de [0-9a-f]{7} \(\d+(\.\d+)?s\)/)
  } finally {
    jeter(racine)
  }
})

test('plage HORS périmètre : le saut est DIT, et aucun export n’est fabriqué', () => {
  const racine = depot()
  const g = git(racine)
  try {
    const base = g(['rev-parse', 'HEAD'])
    ecrire(racine, 'src/a.ts', 'export const a = 2\n')
    g(['add', '-A'])
    g(['commit', '-m', 'code hors périmètre'])
    gatesVertes(racine)
    // `jugerPush` joue le rejeu DANS CE PROCESSUS : ses exports portent NOTRE pid. La racine est
    // partagée — lire le dossier entier ferait juger le pre-push du voisin.
    const avant = exportsDuProcessus()
    const { refus, notes } = jugerPush({ cwd: racine, stdin: pousse(racine, { base }), env: ciVerte(racine) })
    assert.deepEqual(refus, [])
    assert.match(notes.join('\n'), /replay sauté : aucun fichier du périmètre des migrations dans [0-9a-f]{40}\.\.[0-9a-f]{40}/)
    assert.deepEqual(exportsDuProcessus(), avant, 'un rejeu sauté ne fabrique aucun export')
  } finally {
    jeter(racine)
  }
})

test('armeLeRejeu : le périmètre écrit et `scripts/migrations`, par SEGMENT de chemin', () => {
  assert.equal(armeLeRejeu(['src/data/props.json']), true)
  assert.equal(armeLeRejeu(['src/scenes/arene/arene-projet.json']), true)
  assert.equal(armeLeRejeu(['scripts/migrations/2026-09-03-x.mjs']), true)
  assert.equal(armeLeRejeu(['scripts/arene/generate.mjs']), true)
  assert.equal(armeLeRejeu(['src/database/x.ts', 'src/dataset.json']), false)
  assert.equal(armeLeRejeu(['src/ui/RollShell.tsx', 'docs/raw/combat.md']), false)
  assert.equal(armeLeRejeu([]), false)
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

// ── verdictCi, PUR : les quatre motifs, la note « en vol », et la lecture en DEUX TEMPS ──────────
const TETE = 'a'.repeat(40)
const AIEUL = 'b'.repeat(40)

test('verdictCi : sans tête de main, refus NON CONSULTABLE qui porte la raison lue', () => {
  const { refus } = verdictCi({ courses: [], teteMain: null, raisonTete: '`git fetch origin main` — hors ligne' })
  assert.equal(refus.length, 1)
  assert.equal(refus[0].motif, 'non-consultable')
  assert.match(refus[0].dit, /hors ligne/)
})

test('verdictCi : une course EN VOL est une NOTE, jamais un refus (10 % des pushes réels)', () => {
  const { refus, notes } = verdictCi({
    courses: [
      { headSha: TETE, status: 'in_progress', conclusion: null, createdAt: '2026-09-05T11:00:00Z' },
      { headSha: AIEUL, status: 'completed', conclusion: 'success', createdAt: '2026-09-05T10:00:00Z' },
    ],
    teteMain: TETE,
    ancetres: [TETE, AIEUL],
  })
  assert.deepEqual(refus, [])
  assert.match(notes.join('\n'), /1 course\(s\) EN VOL sur main/)
})

test('verdictCi : aucun ancêtre vert dans les 30 → les 300 sont lues, et elles tranchent', () => {
  const enVol = [{ headSha: TETE, status: 'in_progress', conclusion: null, createdAt: '2026-09-05T11:00:00Z' }]
  const vertLoin = [...enVol, { headSha: AIEUL, status: 'completed', conclusion: 'success', createdAt: '2026-08-01T10:00:00Z' }]
  const lus = []
  const trouve = verdictCi({
    courses: enVol,
    teteMain: TETE,
    ancetres: [TETE, AIEUL],
    relire: (limite) => { lus.push(limite); return limite === 300 ? vertLoin : enVol },
  })
  assert.deepEqual(trouve.refus, [])
  assert.deepEqual(lus, [300], 'la liste des 30 porte la tête : elle n’est pas relue à l’identique')
  assert.match(trouve.notes.join('\n'), /ancêtre vert trouvé dans les 300/)

  const rien = verdictCi({ courses: enVol, teteMain: TETE, ancetres: [TETE], relire: () => enVol })
  assert.equal(rien.refus[0].motif, 'sans-ancetre')
  assert.match(rien.refus[0].dit, /règle d’ingénierie, revue de palier n°4/)
})

test('verdictCi : le ROUGE se lit sur la dernière course TERMINÉE, pas sur celle qui court', () => {
  const { refus } = verdictCi({
    courses: [
      { headSha: TETE, status: 'in_progress', conclusion: null, createdAt: '2026-09-05T11:00:00Z' },
      { headSha: AIEUL, status: 'completed', conclusion: 'failure', databaseId: 42, createdAt: '2026-09-05T10:00:00Z' },
    ],
    teteMain: TETE,
    ancetres: [TETE, AIEUL],
  })
  assert.equal(refus[0].motif, 'rouge')
  assert.match(refus[0].dit, /course 42 sur bbbbbbb/)
})
