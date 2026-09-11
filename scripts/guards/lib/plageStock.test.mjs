// Tests de la porte de PLAGE (`plageStock.mjs`) : par commit, filtrée par la croissance cumulée.
// Les deux premiers cas sont la sonde qui a DISCRIMINÉ les deux niveaux le 2026-09-03 — jugée en
// cumulé seul, une plage de deux commits cliquetés `+2` rougit à tort ; jugée par commit seul, une
// plage qui ajoute puis RETIRE un stock rougit à tort aussi. Lancé par `npm run test:hooks`.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { refusDeLaPlage, raisonDeRefusDePlage, croissancesDeLaPlage, SHA_NUL } from './plageStock.mjs'
import { instanceDeDepot } from './depotGabarit.mjs'

const PORTEUR = 'scripts/x.test.mjs'

/** Diff `-U0` d'un ajout/retrait de lignes dans le porteur, à partir de la ligne `ligne`. */
const diffDe = (ajoutees = [], retirees = [], ligne = 1) =>
  [
    `diff --git a/${PORTEUR} b/${PORTEUR}`,
    `--- a/${PORTEUR}`,
    `+++ b/${PORTEUR}`,
    `@@ -${ligne},${retirees.length} +${ligne},${ajoutees.length} @@`,
    ...retirees.map((l) => `-${l}`),
    ...ajoutees.map((l) => `+${l}`),
  ].join('\n')

/** Lecteur d'image qui rend `null` : la porte l'a, et le REPLI de ligne juge — la voie des diffs
 *  FABRIQUÉS ci-dessous, dont aucun fichier n'existe. Sans lecteur du tout, `croissanceDesStocks`
 *  refuse nommément (un compte sans image ment). */
const REPLI = { lirePostImage: () => null }

const A = "  'src/a.ts',"
const B = "  'src/b.ts',"
const C = "  'src/c.ts',"
const D = "  'src/d.ts',"

test('C : deux commits CLIQUETÉS +2 chacun passent — le cumul +4 ne demande pas un cliquet +4', () => {
  const refus = refusDeLaPlage({
    commits: [
      { sha: 'aaa1111', diff: diffDe([A, B]), images: REPLI, message: 'T1\n\nCLIQUET: scripts/x.test.mjs +2 — fixtures du test neuf, motif assez long' },
      { sha: 'bbb2222', diff: diffDe([C, D]), images: REPLI, message: 'T2\n\nCLIQUET: scripts/x.test.mjs +2 — seconde fournée, motif suffisamment long aussi' },
    ],
    cumule: diffDe([A, B, C, D]),
    imagesCumul: REPLI,
  })
  assert.deepEqual(refus, [], 'le CLIQUET vit dans UN message : la plage se juge par commit')
})

test('C : un stock ajouté puis RETIRÉ dans la plage ne refuse rien — le filtre cumulé l\'écarte', () => {
  const commits = [
    { sha: 'aaa1111', diff: diffDe([A, B]), images: REPLI, message: 'ajoute' },
    { sha: 'bbb2222', diff: diffDe([], [A, B]), images: REPLI, message: 'retire' },
  ]
  assert.equal(
    refusDeLaPlage({ commits, cumule: diffDe([A, B]), imagesCumul: REPLI }).length, 1,
    'sans retrait cumulé, le refus tient',
  )
  assert.deepEqual(
    refusDeLaPlage({ commits, cumule: '', imagesCumul: REPLI }), [],
    'croissance cumulée nulle : rien à refuser',
  )
})

test('C : un commit du MILIEU sans cliquet est refusé, et le refus le NOMME', () => {
  const refus = refusDeLaPlage({
    commits: [
      { sha: 'aaa1111', diff: diffDe([]), images: REPLI, message: 'socle' },
      { sha: 'bbb2222', diff: diffDe([A, B]), images: REPLI, message: 'lot sans cliquet' },
      { sha: 'ccc3333', diff: diffDe([]), images: REPLI, message: 'tête innocente' },
    ],
    cumule: diffDe([A, B]),
    imagesCumul: REPLI,
  })
  assert.deepEqual(refus.map((r) => [r.sha, r.fichier, r.net]), [['bbb2222', PORTEUR, 2]])
  const raison = raisonDeRefusDePlage(refus)
  assert.match(raison, /bbb2222/)
  assert.match(raison, /scripts\/x\.test\.mjs \+2/)
  assert.match(raison, /rebase -i/)
})

// ── Sur un dépôt JETABLE : la lecture git réelle, la plage et son repli ───────────────────────────

/** Dépôt jetable où chaque élément de `commits` pose une version du porteur et son message. */
function depotJetable(commits) {
  const [fondation, ...suite] = commits
  assert.ok(fondation, 'depotJetable : le premier commit FONDE le dépôt — `commits` ne peut pas être vide')
  const { racine: repo, sha } = instanceDeDepot({ fichiers: { [PORTEUR]: fondation.contenu }, message: fondation.message })
  const git = (...args) => execFileSync('git', args, { cwd: repo, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
  const shas = [sha]
  for (const { contenu, message } of suite) {
    writeFileSync(join(repo, PORTEUR), contenu, 'utf8')
    git('add', '-A')
    git('commit', '-q', '--no-verify', '-m', message)
    shas.push(git('rev-parse', 'HEAD').trim())
  }
  return { repo, shas, git }
}

const sourceStock = (entrees) => `export const STOCK = [\n${entrees.join('\n')}\n]\n`

test('C : sur un dépôt réel, la plage voit le commit du MILIEU que `git show HEAD` ne voit pas', () => {
  const { repo, shas } = depotJetable([
    { contenu: sourceStock([]), message: 'socle' },
    { contenu: sourceStock([A, B]), message: 'deux exemptions de plus, sans cliquet' },
    { contenu: `${sourceStock([A, B])}// tête anodine\n`, message: 'tête' },
  ])
  try {
    const { refus } = croissancesDeLaPlage({ cwd: repo, avant: shas[0], apres: shas[2] })
    assert.deepEqual(refus.map((r) => [r.sha, r.fichier, r.net]), [[shas[1], PORTEUR, 2]])
  } finally {
    rmSync(repo, { recursive: true, force: true })
  }
})

test('C : la même croissance RETIRÉE plus loin dans la plage ne refuse plus rien', () => {
  const { repo, shas } = depotJetable([
    { contenu: sourceStock([]), message: 'socle' },
    { contenu: sourceStock([A, B]), message: 'deux exemptions de plus, sans cliquet' },
    { contenu: sourceStock([]), message: 'et on les retire' },
  ])
  try {
    assert.deepEqual(croissancesDeLaPlage({ cwd: repo, avant: shas[0], apres: shas[2] }).refus, [])
  } finally {
    rmSync(repo, { recursive: true, force: true })
  }
})

test('C : base NULLE sans `origin/main` → HEAD seul, et la porte le DIT (jamais un silence)', () => {
  const { repo, shas } = depotJetable([
    { contenu: sourceStock([]), message: 'socle' },
    { contenu: sourceStock([A, B]), message: 'deux exemptions de plus, sans cliquet' },
    { contenu: `${sourceStock([A, B])}// tête anodine\n`, message: 'tête' },
  ])
  try {
    const { refus, notes } = croissancesDeLaPlage({ cwd: repo, avant: SHA_NUL, apres: shas[2] })
    assert.deepEqual(refus, [], 'la tête seule ne porte aucune croissance')
    assert.equal(notes.length, 1)
    assert.match(notes[0], /plage inconnue/)
  } finally {
    rmSync(repo, { recursive: true, force: true })
  }
})

// TROIS ISSUES, pas deux : `null` dit « l'objet demandé n'existe pas » (une pre-image de fichier
// AJOUTÉ, cas normal de cette porte) ; une INDISPONIBILITÉ de git est rendue à part, et l'appelant
// la NOMME. Les confondre refuse le push d'un fichier neuf, ou juge une plage jamais lue.
test('git INDISPONIBLE : `indisponible` porte la raison, et la plage est NOMMÉE', () => {
  const hors = mkdtempSync(join(tmpdir(), 'plage-hors-'))
  try {
    const vu = croissancesDeLaPlage({ cwd: hors, avant: 'aaaaaaa', apres: 'bbbbbbb' })
    assert.match(vu.indisponible, /not a git repository/i)
    assert.equal(vu.plage, 'aaaaaaa..bbbbbbb')
    assert.deepEqual(vu.refus, [])
  } finally {
    rmSync(hors, { recursive: true, force: true })
  }
})

test('un lecteur injecté qui rend `null` (objet absent) ne lève AUCUNE indisponibilité', () => {
  const vu = croissancesDeLaPlage({ avant: 'aaaaaaa', apres: 'bbbbbbb', git: () => null })
  assert.equal(vu.indisponible, null)
  assert.match(vu.notes.join(' '), /plage `aaaaaaa\.\.bbbbbbb` illisible/)
})

// #1709 D1 — la classe qui a coûté TROIS runs de gates (2026-09-07) : la migration des marches
// d'arbre vers `readCorpus` (`6382c792d`, `cc71eb45c`) écrit un tableau de RACINES en ARGUMENT
// d'appel, et la plage le refusait comme « STOCK NOMINATIF qui GRANDIT ». Un argument est un
// paramètre. Le témoin de non-cécité est dans le même test : le stock RÉEL, lui, refuse toujours.
test('C : un tableau de RACINES passé en ARGUMENT ne fait grandir aucun stock, un vrai stock si', () => {
  const marche = [
    "import { readCorpus } from '../guards/lib/sourceCorpus.mjs'",
    "const SHEETS = readCorpus(['src/ui/styles'], { exts: ['.css'] })",
    "for (const { rel } of readCorpus(['src/ui'])) { void rel }",
  ].join('\n')
  const { repo, shas } = depotJetable([
    { contenu: '// socle\n', message: 'socle' },
    { contenu: `// socle\n${marche}\n`, message: 'marche migrée, SANS cliquet' },
    { contenu: `// socle\n${marche}\n${sourceStock([A, B])}`, message: 'deux exemptions, SANS cliquet' },
  ])
  try {
    assert.deepEqual(
      croissancesDeLaPlage({ cwd: repo, avant: shas[0], apres: shas[1] }).refus, [],
      'trois arguments d’appel : aucune entrée de stock',
    )
    const { refus } = croissancesDeLaPlage({ cwd: repo, avant: shas[1], apres: shas[2] })
    assert.deepEqual(
      refus.map((r) => [r.sha, r.fichier, r.net]), [[shas[2], PORTEUR, 2]],
      'le stock RÉEL reste vu — sans quoi la correction serait une cécité',
    )
  } finally {
    rmSync(repo, { recursive: true, force: true })
  }
})

// ÉQUIVALENCE DES DEUX VOIES. Le garde de solde (au commit, images de l'arbre de travail) et la
// porte de plage (au push, images `git show <sha>:<f>`) doivent rendre le MÊME compte sur le MÊME
// contenu : c'est leur divergence APPARENTE qui a fait payer des cliquets mensongers.
test('équivalence — solde au commit et plage au push comptent la même chose', async (t) => {
  const { diffDuCommit, evaluateStocksQuiGrandissent } = await import('../../hooks/solde-ticket-guard.mjs')
  const porteur = PORTEUR
  const cas = {
    'argument d’appel': ["const S = readCorpus(['src/ui'])"],
    'stock de module': ['const S = [', "  'src/a.ts',", "  'src/b.ts',", ']'],
  }
  for (const [nom, ajout] of Object.entries(cas)) {
    const { racine } = instanceDeDepot({ fichiers: { [porteur]: '// socle\n' }, message: 'socle' })
    const gitDe = (...args) => execFileSync('git', args, { cwd: racine, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
    try {
      writeFileSync(join(racine, porteur), `// socle\n${ajout.join('\n')}\n`, 'utf8')
      gitDe('add', '-A')
      const commande = 'git commit -m "test: sans cliquet"'
      const lectures = diffDuCommit(commande, racine)
      const auCommit = evaluateStocksQuiGrandissent({
        command: commande,
        diff: lectures.fichier(porteur),
        images: { lirePostImage: lectures.contenu, lirePreImage: lectures.avant },
      })
      const base = gitDe('rev-parse', 'HEAD').trim()
      gitDe('commit', '-q', '--no-verify', '-m', 'test: sans cliquet')
      const auPush = croissancesDeLaPlage({ cwd: racine, avant: base, apres: gitDe('rev-parse', 'HEAD').trim() })
      assert.equal(auPush.indisponible, null, `${nom} : plage illisible`)
      assert.equal(
        auCommit === null, auPush.refus.length === 0,
        `${nom} : les deux voies divergent — commit ${auCommit ? 'refuse' : 'passe'}, push ${auPush.refus.length ? 'refuse' : 'passe'}`,
      )
      const attenduRefus = nom === 'stock de module'
      assert.equal(auPush.refus.length > 0, attenduRefus, `${nom} : verdict de plage`)
      if (attenduRefus) assert.equal(auPush.refus[0].net, 2, `${nom} : compte de plage`)
    } finally {
      rmSync(racine, { recursive: true, force: true })
    }
  }
  t.diagnostic('deux voies, deux cas, même verdict')
})

// #1709 D3 — sonde 3 de la revue de palier du 2026-09-08, promue sur un dépôt RÉEL : un
// `*-stock.json` qui NAÎT. Ses entrées vivent sur des propriétés (`"sites": [ … ]`) qu'aucune
// lecture par ligne ne reconnaît : seule une IMAGE les compte. Les deux portes en ont une — l'arbre
// de travail au commit, `git show <sha>:<f>` au push — et rendent le même compte ; un appelant qui
// n'en fournit aucune est REFUSÉ, jamais servi d'un zéro.
test('équivalence — un `*-stock.json` qui NAÎT, puis qui GRANDIT : même compte aux deux portes', async (t) => {
  const { croissanceDesStocks } = await import('./stocksNominatifs.mjs')
  const { diffDuCommit, evaluateStocksQuiGrandissent } = await import('../../hooks/solde-ticket-guard.mjs')
  const porteur = 'scripts/raw/fixture-stock.json'
  const trous = (n) => Array.from({ length: n }, (_, i) => [`LIV ${i + 1}`, [`src/data/x${i + 1}.json`]])
  const stock = (entrees) => [
    '{',
    '  "quoi": "fixture — un trou dur par rubrique",',
    '  "trous": {',
    entrees.map(([cle, sites]) => [
      `    "${cle}": {`,
      `      "sites": [${sites.map((s) => `"${s}"`).join(', ')}],`,
      '      "lot": "#1709 D3"',
      '    }',
    ].join('\n')).join(',\n'),
    '  }',
    '}',
    '',
  ].join('\n')

  const { racine } = instanceDeDepot({ fichiers: { 'scripts/raw/socle.md': '# socle\n' }, message: 'socle' })
  const gitDe = (...args) => execFileSync('git', args, { cwd: racine, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
  const poser = (entrees) => { writeFileSync(join(racine, porteur), stock(entrees), 'utf8'); gitDe('add', '-A') }
  const auPush = (avant) => croissancesDeLaPlage({ cwd: racine, avant, apres: gitDe('rev-parse', 'HEAD').trim() })
  const auCommit = (commande) => {
    const lectures = diffDuCommit(commande, racine)
    return {
      verdict: evaluateStocksQuiGrandissent({
        command: commande,
        diff: lectures.fichier(porteur),
        images: { lirePostImage: lectures.contenu, lirePreImage: lectures.avant },
      }),
      diff: lectures.fichier(porteur),
    }
  }
  try {
    // NAISSANCE de 13 entrées, message muet : les deux portes refusent, et le compte est le VRAI.
    const base = gitDe('rev-parse', 'HEAD').trim()
    poser(trous(13))
    const naissance = auCommit('git commit -m "test: un stock qui naît"')
    assert.match(naissance.verdict?.reason ?? '', /\+13 entrée\(s\) nette\(s\)/, 'porte au commit : le compte de la naissance')
    assert.deepEqual(
      croissanceDesStocks(naissance.diff, { lirePostImage: (f) => readFileSync(join(racine, f), 'utf8') })
        .map((c) => c.net), [13],
      'troisième lecture, image de l’arbre : le même compte que les deux portes',
    )
    assert.throws(
      () => croissanceDesStocks(naissance.diff),
      /aucun lecteur d'image post — un compte sans image ment/,
      'un appelant sans lecteur (diagnostic, sonde, revue) est REFUSÉ, jamais servi d’un zéro qui ment',
    )
    gitDe('commit', '-q', '--no-verify', '-m', 'test: un stock qui naît')
    assert.deepEqual(auPush(base).refus.map((r) => [r.fichier, r.net]), [[porteur, 13]], 'porte au push : le même compte')

    // CROISSANCE de deux entrées sur les treize, DITE par le message : les deux portes passent.
    const avant = gitDe('rev-parse', 'HEAD').trim()
    poser(trous(15))
    const message = 'test: deux trous durs de plus\n\nCLIQUET: scripts/raw/fixture-stock.json +2 — deux chapitres non couverts par l’Atlas'
    const croissance = auCommit(`git commit -m "${message}"`)
    assert.equal(croissance.verdict, null, 'porte au commit : la croissance est DITE, elle passe')
    assert.deepEqual(
      croissanceDesStocks(croissance.diff, { lirePostImage: (f) => readFileSync(join(racine, f), 'utf8') })
        .map((c) => c.net), [2],
      'témoin de non-vacuité : la croissance vaut bien +2 — sans le cliquet, le verdict serait un refus',
    )
    gitDe('commit', '-q', '--no-verify', '-m', message)
    assert.deepEqual(auPush(avant).refus, [], 'porte au push : le cliquet du message couvre la croissance')
    t.diagnostic('naissance +13, croissance +2, trois lectures concordantes')
  } finally {
    rmSync(racine, { recursive: true, force: true })
  }
})
