// Contrat du TRAIN de publication — tout ce qui se juge sans git, sans gh et sans réseau.
//   node --test scripts/ops/publier.test.mjs   (chaîné dans `npm run test:ops`)
//
// Rien ici ne touche l'arbre : le moteur reçoit des étapes FACTICES et un journal EN MÉMOIRE, les
// verdicts reçoivent des listes de courses littérales. Ce que ce fichier ne couvre pas est dit :
// les `jouer` réels (rebase, build-all, gates, push, gh) ne sont jugés que par le train joué.
import test, { after, describe } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, utimesSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { numerosCites } from '../guards/lib/fermetures.mjs'
import { refusDeSujet, sujetDuMessage } from '../guards/lib/sujetDeCommit.mjs'
import {
  ETAPES,
  MOTIF_APRES_REBASE,
  MOTIF_POST_REWRITE,
  RACINE,
  VERROU_TIMEOUT_MIN,
  commandeInterdite,
  corpsDePilotage,
  correspondGlob,
  estDocDerive,
  etatDeLEtape,
  finDeSortie,
  gatesRejouees,
  jouerLeTrain,
  journalInitial,
  journalVide,
  ligneDeDetachement,
  marquePublication,
  messageDeDerives,
  modeDuLog,
  motifDeRotation,
  nomDeJournal,
  nomDeRotation,
  optionsDe,
  partitionSales,
  plageDeCitations,
  planDeReprise,
  prerequisDesGates,
  rotationnerLog,
  sansOptionsGlobales,
  synchroniserAgents,
  titreDeCommit,
  verdictDeSondeDuVerrou,
  verdictDesRuns,
} from './publier.mjs'

const NOMS = ETAPES.map((e) => e.nom)

// ── optionsDe ──────────────────────────────────────────────────────────────────────────

test('optionsDe : les drapeaux et l’option à valeur, sans grammaire empruntée', () => {
  assert.deepEqual(optionsDe([]), {
    detache: false,
    reprendre: false,
    etapes: false,
    ciTimeoutMin: 40,
    verrouTimeoutMin: VERROU_TIMEOUT_MIN,
    inconnus: [],
  })
  assert.equal(optionsDe(['--detache']).detache, true)
  assert.equal(optionsDe(['--reprendre']).reprendre, true)
  assert.equal(optionsDe(['--etapes']).etapes, true)
  assert.equal(optionsDe(['--ci-timeout-min', '12']).ciTimeoutMin, 12)
  // La valeur d'une option n'est JAMAIS lue comme un drapeau inconnu.
  assert.deepEqual(optionsDe(['--ci-timeout-min', '12']).inconnus, [])
  // Une valeur absurde ne DÉGRADE pas la borne : le défaut tient.
  assert.equal(optionsDe(['--ci-timeout-min', 'zero']).ciTimeoutMin, 40)
  assert.deepEqual(optionsDe(['--force']).inconnus, ['--force'])
})

test('optionsDe : la borne de la SONDE DU VERROU a son option, son défaut et son parse', () => {
  assert.equal(VERROU_TIMEOUT_MIN, 60)
  assert.equal(optionsDe([]).verrouTimeoutMin, VERROU_TIMEOUT_MIN)
  assert.equal(optionsDe(['--verrou-timeout-min', '5']).verrouTimeoutMin, 5)
  assert.deepEqual(optionsDe(['--verrou-timeout-min', '5']).inconnus, [])
  assert.equal(optionsDe(['--verrou-timeout-min', 'zero']).verrouTimeoutMin, VERROU_TIMEOUT_MIN)
  // Les deux bornes sont INDÉPENDANTES : l'une ne mange pas la valeur de l'autre.
  const deux = optionsDe(['--ci-timeout-min', '12', '--verrou-timeout-min', '5'])
  assert.equal(deux.ciTimeoutMin, 12)
  assert.equal(deux.verrouTimeoutMin, 5)
})

// ── nomDeJournal ───────────────────────────────────────────────────────────────────────

test('nomDeJournal : une branche devient un NOM DE FICHIER légal', () => {
  assert.equal(nomDeJournal('chantier/1736-publier'), 'chantier_1736-publier')
  assert.equal(nomDeJournal('main'), 'main')
  // `\w` est ASCII : un accent tombe avec le reste — le nom de fichier reste ASCII, par construction.
  assert.equal(nomDeJournal('feat/ét é:x'), 'feat_t_x')
  assert.equal(nomDeJournal(undefined), 'sans-branche')
})

// ── planDeReprise / etatDeLEtape ───────────────────────────────────────────────────────

test('planDeReprise : journal vide → la première étape', () => {
  assert.equal(planDeReprise(journalVide('b'), NOMS, 'aaa'), NOMS[0])
  assert.equal(planDeReprise(undefined, NOMS, 'aaa'), NOMS[0])
})

test('planDeReprise : la première étape NON verte', () => {
  const journal = {
    tete: 'aaa',
    etapes: { preflight: { etat: 'vert', tete: 'aaa' }, derives: { etat: 'vert', tete: 'aaa' }, rebase: { etat: 'rouge', tete: 'aaa' } },
  }
  assert.equal(planDeReprise(journal, NOMS, 'aaa'), 'rebase')
})

test('planDeReprise : tout vert POUR CETTE TÊTE → rien à jouer', () => {
  const journal = { tete: 'aaa', etapes: Object.fromEntries(NOMS.map((n) => [n, { etat: 'vert', tete: 'aaa' }])) }
  assert.equal(planDeReprise(journal, NOMS, 'aaa'), null)
})

test('planDeReprise : une étape verte pour une AUTRE tête est À FAIRE (2ᵉ lot sur la même branche)', () => {
  const journal = { tete: 'bbb', etapes: Object.fromEntries(NOMS.map((n) => [n, { etat: 'vert', tete: 'aaa' }])) }
  assert.equal(planDeReprise(journal, NOMS, 'bbb'), NOMS[0])
  assert.equal(etatDeLEtape(journal, 'ci', 'bbb'), 'à faire (verte pour une autre tête)')
  assert.equal(etatDeLEtape({ tete: 'aaa', etapes: {} }, 'ci', 'aaa'), 'à faire')
})

test('planDeReprise : la règle de tête porte sur la tête VIVANTE, et une étape SANS estampille est à faire', () => {
  // La tête PUBLIÉE du journal ne décide de rien : seule la tête vivante est comparée.
  const publie = { tete: 'aaa', etapes: Object.fromEntries(NOMS.map((n) => [n, { etat: 'vert', tete: 'aaa' }])) }
  assert.equal(planDeReprise(publie, NOMS, 'bbb'), NOMS[0])
  assert.equal(planDeReprise(publie, NOMS, 'aaa'), null)
  // Une étape estampillée `null` (journal d'avant la règle) N'est PAS verte pour toute tête.
  const sansEstampille = {
    tete: 'aaa',
    etapes: Object.fromEntries(NOMS.map((n) => [n, { etat: 'vert', tete: n === 'preflight' ? null : 'aaa' }])),
  }
  assert.equal(planDeReprise(sansEstampille, NOMS, 'aaa'), 'preflight')
  assert.equal(etatDeLEtape(sansEstampille, 'preflight', 'aaa'), 'à faire (verte pour une autre tête)')
  assert.equal(etatDeLEtape(publie, 'ci', 'aaa'), 'vert')
})

test('planDeReprise / etatDeLEtape : une étape SANS estampille est à faire, MÊME sans tête vivante', () => {
  // L'échappatoire fermée : `null !== null` est FAUX — une étape estampillée `null` jugée alors que
  // la tête vivante n'a pas pu être mesurée se déclarait verte. L'ABSENCE d'estampille décide seule.
  const sansEstampille = {
    tete: 'aaa',
    etapes: Object.fromEntries(NOMS.map((n) => [n, { etat: 'vert', tete: n === 'preflight' ? null : 'aaa' }])),
  }
  assert.equal(planDeReprise(sansEstampille, NOMS, null), 'preflight')
  assert.equal(etatDeLEtape(sansEstampille, 'preflight', null), 'à faire (verte pour une autre tête)')
  // Et avec une tête vivante NOMMÉE, le verdict est le même.
  assert.equal(planDeReprise(sansEstampille, NOMS, 'aaa'), 'preflight')
  assert.equal(etatDeLEtape(sansEstampille, 'preflight', 'aaa'), 'à faire (verte pour une autre tête)')
})

// ── jouerLeTrain (étapes factices) ─────────────────────────────────────────────────────

/** Étape factice : `jouer` rend ce qu'on lui dit, et NOTE son passage. */
const factice = (nom, verdict, { deja = false, joues } = {}) => ({
  nom,
  dejaFaite: () => deja,
  jouer: () => {
    joues?.push(nom)
    return typeof verdict === 'function' ? verdict() : verdict
  },
})

test('jouerLeTrain : joue dans l’ordre et rend vert', () => {
  const joues = []
  const journal = journalVide('b')
  const vu = jouerLeTrain({}, [factice('un', { ok: true }, { joues }), factice('deux', { ok: true }, { joues })], journal)
  assert.deepEqual(vu, { etat: 'vert' })
  assert.deepEqual(joues, ['un', 'deux'])
  assert.equal(journal.etapes.deux.etat, 'vert')
})

test('jouerLeTrain : ARRÊTE à la première rouge', () => {
  const joues = []
  const journal = journalVide('b')
  const vu = jouerLeTrain({}, [
    factice('un', { ok: true }, { joues }),
    factice('deux', { ok: false, raison: 'cassé' }, { joues }),
    factice('trois', { ok: true }, { joues }),
  ], journal)
  assert.deepEqual(vu, { etat: 'rouge', etape: 'deux', raison: 'cassé' })
  assert.deepEqual(joues, ['un', 'deux'])
  assert.equal(journal.etapes.trois, undefined)
})

test('jouerLeTrain : saute ce que dejaFaite déclare', () => {
  const joues = []
  const journal = journalVide('b')
  jouerLeTrain({}, [factice('un', { ok: true }, { joues, deja: true }), factice('deux', { ok: true }, { joues })], journal)
  assert.deepEqual(joues, ['deux'])
})

test('jouerLeTrain : une étape DÉJÀ FAITE s’ENREGISTRE, estampillée à la tête VIVANTE du ctx', () => {
  const sauves = []
  const journal = journalVide('b')
  jouerLeTrain({ tete: 'vivante' }, [factice('un', { ok: true }, { deja: true }), factice('deux', { ok: true })], journal, {
    sauver: (j) => sauves.push(Object.keys(j.etapes).join('+')),
  })
  const vue = journal.etapes.un
  assert.equal(vue.etat, 'vert')
  assert.equal(vue.detail.dejaFaite, true)
  assert.equal(vue.tete, 'vivante')
  assert.ok(vue.debut && vue.fin, 'une étape enregistrée porte ses bornes de temps')
  // Elle est SAUVÉE comme une étape jouée — le journal du disque la porte.
  assert.deepEqual(sauves, ['un', 'un+deux'])
  // Une étape JOUÉE s’estampille à la même tête vivante, jamais à la tête publiée du journal.
  assert.equal(journal.etapes.deux.tete, 'vivante')
  // Le détail PRÉCÉDENT survit : `ci.dejaFaite` relit `detail.etat`, l’écraser resonderait la course.
  const repris = { ...journalVide('b'), etapes: { ci: { etat: 'vert', tete: 'vivante', detail: { etat: 'verte' } } } }
  jouerLeTrain({ tete: 'vivante' }, [factice('ci', { ok: true }, { deja: true })], repris)
  assert.deepEqual(repris.etapes.ci.detail, { etat: 'verte', dejaFaite: true })
})

test('jouerLeTrain : le journal est écrit APRÈS CHAQUE étape', () => {
  const sauves = []
  const journal = journalVide('b')
  jouerLeTrain({}, [factice('un', { ok: true }), factice('deux', { ok: false, raison: 'x' })], journal, {
    sauver: (j) => sauves.push(Object.keys(j.etapes).join('+')),
  })
  assert.deepEqual(sauves, ['un', 'un+deux'])
})

test('jouerLeTrain : une étape INDÉTERMINÉE arrête le train sans le rougir', () => {
  const journal = journalVide('b')
  const vu = jouerLeTrain({}, [factice('ci', { indetermine: true, raison: 'pas de verdict' })], journal)
  assert.deepEqual(vu, { etat: 'indeterminee', etape: 'ci', raison: 'pas de verdict' })
  assert.equal(journal.etapes.ci.etat, 'indéterminée')
})

test('jouerLeTrain : une RELANCE remet les étapes nommées à faire et reprend du début', () => {
  const joues = []
  const journal = journalVide('b')
  let bouge = true
  const etapes = [
    factice('rebase', { ok: true }, { joues }),
    {
      nom: 'push',
      dejaFaite: () => false,
      jouer: () => {
        joues.push('push')
        if (bouge) {
          bouge = false
          return { ok: true, relancer: ['rebase'] }
        }
        return { ok: true }
      },
    },
  ]
  const vu = jouerLeTrain({}, etapes, journal)
  assert.deepEqual(vu, { etat: 'vert' })
  assert.deepEqual(joues, ['rebase', 'push', 'rebase', 'push'])
})

// ── verdictDesRuns ─────────────────────────────────────────────────────────────────────

const course = (o) => ({ headSha: 'aaa', status: 'completed', workflowName: 'CI', databaseId: 1, createdAt: '2026-09-14T00:00:00Z', ...o })

test('verdictDesRuns : absente, en vol, verte, rouges, annulée', () => {
  assert.equal(verdictDesRuns([], 'aaa').etat, 'absente')
  assert.equal(verdictDesRuns([course({ status: 'in_progress' })], 'aaa').etat, 'en-vol')
  assert.equal(verdictDesRuns([course({ conclusion: 'success' })], 'aaa').etat, 'verte')
  assert.equal(verdictDesRuns([course({ conclusion: 'failure' })], 'aaa').etat, 'rouge')
  assert.equal(verdictDesRuns([course({ conclusion: 'timed_out' })], 'aaa').etat, 'rouge')
  assert.equal(verdictDesRuns([course({ conclusion: 'startup_failure' })], 'aaa').etat, 'rouge')
  assert.equal(verdictDesRuns([course({ conclusion: 'cancelled' })], 'aaa').etat, 'annulee')
})

test('verdictDesRuns : un sha ABSENT de la liste, et une course d’un AUTRE workflow, ne disent rien', () => {
  assert.equal(verdictDesRuns([course({ conclusion: 'success' })], 'bbb').etat, 'absente')
  assert.equal(verdictDesRuns([course({ conclusion: 'success', workflowName: 'Déploiement prod' })], 'aaa').etat, 'absente')
})

test('verdictDesRuns : une conclusion INCONNUE n’est pas verte, et se dit inattendue', () => {
  const vu = verdictDesRuns([course({ conclusion: 'neutral' })], 'aaa')
  assert.equal(vu.etat, 'rouge')
  assert.equal(vu.inattendue, true)
})

test('verdictDesRuns : la PREMIÈRE course de la liste triée gouverne', () => {
  const vu = verdictDesRuns([course({ conclusion: 'success', databaseId: 2 }), course({ conclusion: 'failure', databaseId: 1 })], 'aaa')
  assert.equal(vu.etat, 'verte')
  assert.equal(vu.course.databaseId, 2)
})

// ── estDocDerive ───────────────────────────────────────────────────────────────────────

test('correspondGlob : `*` ne franchit PAS un séparateur', () => {
  assert.equal(correspondGlob('docs/raw/catalogue-divers.md', 'docs/raw/catalogue-*.md'), true)
  // Le cas qui compte : `docs/*.md` NE couvre PAS un doc d'un sous-dossier — sans quoi un manuscrit
  // de `docs/raw/` passerait pour dérivé.
  assert.equal(correspondGlob('docs/raw/catalogue-divers.md', 'docs/*.md'), false)
  assert.equal(correspondGlob('docs/systemes.md', 'docs/*.md'), true)
})

// La fixture des générateurs vit DANS le corps du `describe(…)` : c'est une donnée LOCALE au sens de
// `scripts/guards/lib/stocksNominatifs.mjs` (§ PORTÉE DE MODULE), pas un stock nominatif de module.
describe('estDocDerive', () => {
  const GEN = [
    { script: 'a.mjs', targets: ['docs/systemes.md'] },
    { script: 'b.mjs', targets: ['docs/raw/catalogue-*.md'] },
    { script: 'c.mjs', targets: [], injecte: ['CLAUDE.md'] },
    { script: 'd.mjs', targets: [], injecte: ['docs/raw/*.md'] },
  ]

  test('estDocDerive : les cibles, les injections et les globs sont DÉRIVÉS', () => {
    assert.equal(estDocDerive('docs/systemes.md', GEN), true)
    assert.equal(estDocDerive('docs/raw/catalogue-divers.md', GEN), true)
    assert.equal(estDocDerive('CLAUDE.md', GEN), true)
    assert.equal(estDocDerive('docs/raw/00-index.md', GEN), true)
  })

  test('estDocDerive : la mesure `.sources-lues.json` et les sorties d’agents:sync sont DÉRIVÉES', () => {
    assert.equal(estDocDerive('docs/.sources-lues.json', GEN), true)
    assert.equal(estDocDerive('AGENTS.md', GEN), true)
    assert.equal(estDocDerive('.agents/skills/ajouter-une-donnee/SKILL.md', GEN), true)
    assert.equal(estDocDerive('.codex/credo.md', GEN), true)
  })

  test('estDocDerive : un MANUSCRIT n’est pas dérivé', () => {
    assert.equal(estDocDerive('docs/architecture.md', GEN), false)
    assert.equal(estDocDerive('src/state/cascade.ts', GEN), false)
    assert.equal(estDocDerive('', GEN), false)
  })

  // Le cas MESURÉ (2026-09-14) : le hook `post-rewrite` d'un rebase manuel laisse des dérivés sales.
  // La préflight doit les distinguer d'un manuscrit — l'étape `docs` sait committer les premiers.
  test('partitionSales : des DÉRIVÉS seuls — aucun manuscrit à refuser', () => {
    const vu = partitionSales(['docs/systemes.md', 'docs/raw/00-index.md'], GEN)
    assert.deepEqual(vu.derives, ['docs/systemes.md', 'docs/raw/00-index.md'])
    assert.deepEqual(vu.manuscrits, [])
  })

  test('partitionSales : des MANUSCRITS seuls', () => {
    const vu = partitionSales(['src/state/cascade.ts', 'docs/architecture.md'], GEN)
    assert.deepEqual(vu.derives, [])
    assert.deepEqual(vu.manuscrits, ['src/state/cascade.ts', 'docs/architecture.md'])
  })

  test('partitionSales : MIXTE — chaque chemin dans son tas, l’ordre conservé', () => {
    const vu = partitionSales(['docs/systemes.md', 'src/state/cascade.ts', 'CLAUDE.md', 'docs/architecture.md'], GEN)
    assert.deepEqual(vu.derives, ['docs/systemes.md', 'CLAUDE.md'])
    assert.deepEqual(vu.manuscrits, ['src/state/cascade.ts', 'docs/architecture.md'])
  })

  test('partitionSales : rien de sale — deux tas vides (et `undefined` ne jette pas)', () => {
    assert.deepEqual(partitionSales([], GEN), { derives: [], manuscrits: [] })
    assert.deepEqual(partitionSales(undefined, GEN), { derives: [], manuscrits: [] })
  })
})

// ── commandeInterdite ──────────────────────────────────────────────────────────────────

test('commandeInterdite : chaque geste interdit rend sa RAISON', () => {
  for (const args of [
    ['add', '-A'],
    ['add', '--all'],
    ['add', '.'],
    ['stash'],
    ['stash', 'push'],
    ['push', 'origin', 'HEAD:main', '--force'],
    ['push', '-f', 'origin', 'HEAD:main'],
    ['push', 'origin', 'HEAD:main', '--force-with-lease'],
    ['push', 'origin', 'HEAD:main', '--force-with-lease=main:abc'],
    ['reset', '--hard', 'origin/main'],
    ['branch', '-D', 'chantier/1736'],
    ['worktree', 'remove', '--force', '.wt-1736'],
    ['worktree', 'remove', '-f', '.wt-1736'],
    ['commit', '-F', '/tmp/msg'],
    ['checkout', '--', 'docs/'],
    ['restore', 'docs/'],
  ]) {
    const raison = commandeInterdite(args)
    assert.equal(typeof raison, 'string', `git ${args.join(' ')} doit être REFUSÉ`)
    assert.ok(raison.length > 10, `git ${args.join(' ')} : la raison doit se lire`)
  }
})

test('commandeInterdite : les gestes du train passent', () => {
  for (const args of [
    ['rebase', 'origin/main'],
    ['rebase', '--abort'],
    ['add', '--', 'docs/systemes.md'],
    ['commit', '-F', '/tmp/msg', '--', 'docs/systemes.md'],
    ['push', 'origin', 'HEAD:main'],
    ['status', '--porcelain', '-z'],
    ['rev-parse', 'HEAD'],
  ]) {
    assert.equal(commandeInterdite(args), null, `git ${args.join(' ')} doit passer`)
  }
})

test('commandeInterdite : les options GLOBALES de git ne masquent pas le sous-commande', () => {
  // Mesuré avant correction : `['-c','x=y','add','-A']` rendait `null` — le sous-commande lu était `-c`.
  for (const args of [
    ['-c', 'x=y', 'add', '-A'],
    ['-c', 'protocol.version=2', 'push', '--force', 'origin', 'HEAD:main'],
    ['-C', '/dep', 'reset', '--hard'],
    ['--git-dir=/dep/.git', 'stash'],
    ['--no-pager', 'checkout', '--', 'docs/'],
    ['--work-tree=/dep', 'commit', '-F', '/tmp/msg'],
  ]) {
    assert.equal(typeof commandeInterdite(args), 'string', `git ${args.join(' ')} doit être REFUSÉ`)
  }
  assert.equal(commandeInterdite(['-c', 'x=y', 'add', '--', 'docs/systemes.md']), null)
  assert.equal(commandeInterdite(['-C', '/dep', 'push', 'origin', 'HEAD:main']), null)
})

test('sansOptionsGlobales : le sous-commande, quel que soit le préfixe', () => {
  assert.deepEqual(sansOptionsGlobales(['-c', 'x=y', 'add', '-A']), ['add', '-A'])
  assert.deepEqual(sansOptionsGlobales(['--no-pager', '-C', '/dep', 'log']), ['log'])
  assert.deepEqual(sansOptionsGlobales(['push', 'origin', 'HEAD:main']), ['push', 'origin', 'HEAD:main'])
  assert.deepEqual(sansOptionsGlobales([]), [])
})

test('la SOURCE du train ne porte AUCUN geste de fermeture — la CI ferme', () => {
  const src = readFileSync(new URL('./publier.mjs', import.meta.url), 'utf8')
  assert.equal(/\['issue',\s*'close'/.test(src), false, '`gh issue close` n’appartient pas au train')
  assert.equal(/issue\s+close/.test(src.replace(/^\s*(\/\/|\*|\/\*).*$/gm, '')), false)
})

test('la table des ÉTAPES nomme les neuf étapes, dans l’ordre de ci.yml', () => {
  // `derives` vient AVANT `rebase` : mesuré le 2026-09-14, `git rebase origin/main` refuse de
  // démarrer sur un arbre sale, donc les dérivés laissés par le hook `post-rewrite` se commettent
  // avant lui — les tolérer à la préflight ne suffisait pas.
  assert.deepEqual(NOMS, ['preflight', 'derives', 'rebase', 'docs', 'gates', 'push', 'ci', 'pilotage', 'fin'])
})

// ── messageDeDerives / plageDeCitations ──────────────────────────────────────────

test('messageDeDerives : un SUJET que la règle du dépôt accepte, le motif au CORPS, pour les deux étapes', () => {
  const douze = Array.from({ length: 12 }, (_, i) => String(1700 + i))
  for (const motif of [MOTIF_POST_REWRITE, MOTIF_APRES_REBASE])
    for (const numeros of [['1751'], ['1736', '1384'], douze]) {
      const message = messageDeDerives(numeros, motif)
      const dit = `${numeros.length} numéro(s), motif « ${motif} »`
      assert.equal(refusDeSujet(message), null, dit)
      assert.ok(sujetDuMessage(message).startsWith('chore(docs):'), dit)
      assert.ok(message.split(/\r?\n/).slice(1).join('\n').includes(motif), `le motif est au CORPS — ${dit}`)
      for (const n of numeros) assert.match(message, new RegExp(`#${n}\\b`), `#${n} cité — ${dit}`)
    }
  // Les `#N` descendus au corps restent CITÉS : `numerosCites` lit le message entier.
  assert.deepEqual(numerosCites(messageDeDerives(douze, MOTIF_POST_REWRITE)), douze)
})

test('finDeSortie : la FIN de la sortie — les lignes `⛔` si la sortie en porte', () => {
  assert.equal(finDeSortie(`${'docs:check — OK\n'.repeat(40)}⛔ refus`), '⛔ refus')
  const mille = 'a'.repeat(1000)
  assert.equal(finDeSortie(mille), 'a'.repeat(400))
  assert.equal(finDeSortie(`${'b'.repeat(900)}${'c'.repeat(100)}`).endsWith('c'.repeat(100)), true)
  assert.equal(finDeSortie(''), '')
  assert.equal(finDeSortie(null), '')
})

test('plageDeCitations : le journal quand il PORTE la plage, `origin/main..HEAD` avant le rebase', () => {
  assert.equal(plageDeCitations({ base: 'b'.repeat(40), tete: 'a'.repeat(40) }), `${'b'.repeat(40)}..${'a'.repeat(40)}`)
  // L'étape `derives` joue AVANT `rebase` : le journal n'a encore ni base ni tête.
  assert.equal(plageDeCitations(journalVide('c')), 'origin/main..HEAD')
  assert.equal(plageDeCitations({ base: 'b'.repeat(40), tete: null }), 'origin/main..HEAD')
  assert.equal(plageDeCitations(undefined), 'origin/main..HEAD')
})

// ── journalInitial / gatesRejouees ───────────────────────────────────────────────

test('journalInitial : sans --reprendre, un lot NEUF ignore le journal du disque', () => {
  const lu = { branche: 'chantier/1736', base: 'b', tete: 't', reprises: 1, etapes: { push: { etat: 'vert' } } }
  const vu = journalInitial({ reprendre: false, lu, branche: 'chantier/1736' })
  assert.deepEqual(vu.journal, journalVide('chantier/1736'))
  assert.equal(vu.repris, false)
  // Le cas qui coûtait : `reprises` survivait, et le 2ᵉ lot refusait « origin/main a bougé DEUX fois ».
  assert.equal(vu.journal.reprises, 0)
})

test('journalInitial : avec --reprendre, le journal LU est repris et ses vertes comptées', () => {
  const lu = { branche: 'c', base: 'b', tete: 't', reprises: 1, etapes: { rebase: { etat: 'vert' }, docs: { etat: 'vert' }, gates: { etat: 'rouge' } } }
  const vu = journalInitial({ reprendre: true, lu, branche: 'c' })
  assert.equal(vu.journal, lu)
  assert.equal(vu.repris, true)
  assert.equal(vu.vertes, 2)
})

test('journalInitial : --reprendre sans journal sur disque part d’un journal NEUF', () => {
  const vu = journalInitial({ reprendre: true, lu: null, branche: 'c' })
  assert.deepEqual(vu.journal, journalVide('c'))
  assert.equal(vu.repris, false)
  assert.equal(vu.vertes, 0)
})

test('gatesRejouees : la trace vit sur l’ÉTAPE, et seulement pour la tête courante', () => {
  assert.equal(gatesRejouees({ tete: 't', etapes: { gates: { etat: 'vert', tete: 't', detail: { joue: true } } } }), true)
  assert.equal(gatesRejouees({ tete: 't', etapes: { gates: { etat: 'vert', tete: 'autre', detail: { joue: true } } } }), false)
  assert.equal(gatesRejouees({ tete: 't', etapes: { gates: { etat: 'vert', tete: 't', detail: null } } }), false)
  assert.equal(gatesRejouees(journalVide('c')), false)
})

// ── modeDuLog ─────────────────────────────────────────────────────────────────────

test('modeDuLog : le log suit le journal — lot NEUF tronque, `--reprendre` ajoute', () => {
  // Le cas mesuré (2026-09-14) : ouvert en `'a'` sans condition, un run neuf gardait la ligne
  // `PUBLICATION:` du run précédent, et la veille `until grep -q "^PUBLICATION:"` rendait aussitôt.
  assert.equal(modeDuLog({ reprendre: false }), 'w')
  assert.equal(modeDuLog({ reprendre: true }), 'a')
})

test('modeDuLog : l’ENFANT de `--detache` n’ouvre JAMAIS en troncature — le parent a déjà tronqué', () => {
  assert.equal(modeDuLog({ reprendre: false, enfant: true }), 'a')
  assert.equal(modeDuLog({ reprendre: true, enfant: true }), 'a')
  assert.equal(modeDuLog(), 'w')
})

// ── sonde du verrou ───────────────────────────────────────────────────────────────────

test('verdictDeSondeDuVerrou : les cinq cas de la sonde du verrou machine', () => {
  const debut = 1_000_000
  const tenant = { pid: 4242, cwd: '/arbre', date: '2026-09-14T10:00:00.000Z' }
  // 1. Aucun refus du verrou (rien joué encore, ou série jouée) : on (re)joue la série.
  assert.equal(verdictDeSondeDuVerrou({ status: null, tenantVivant: null, debut, maintenant: debut, timeoutMin: 60 }), 'rejouer')
  assert.equal(verdictDeSondeDuVerrou({ status: 0, tenantVivant: null, debut, maintenant: debut, timeoutMin: 60 }), 'rejouer')
  assert.equal(verdictDeSondeDuVerrou({ status: 1, tenantVivant: null, debut, maintenant: debut, timeoutMin: 60 }), 'rejouer')
  // 2. Refus 2, tenant VIVANT, sous la borne : on sonde.
  assert.equal(
    verdictDeSondeDuVerrou({ status: 2, tenantVivant: tenant, debut, maintenant: debut + 59 * 60_000, timeoutMin: 60 }),
    'sonder',
  )
  // 3. Refus 2 SANS tenant vivant, sous la borne : rouge ORPHELIN (le 2 ne vient que du verrou).
  assert.equal(
    verdictDeSondeDuVerrou({ status: 2, tenantVivant: null, debut, maintenant: debut, timeoutMin: 60 }),
    'rouge-orphelin',
  )
  // 4. Borne atteinte, tenant vivant : rouge BORNE.
  assert.equal(
    verdictDeSondeDuVerrou({ status: 2, tenantVivant: tenant, debut, maintenant: debut + 60 * 60_000, timeoutMin: 60 }),
    'rouge-borne',
  )
  // 5. Borne atteinte ET tenant mort au MÊME tour : la borne PRIME — on a bien attendu 60 min, et le
  //    refus doit dire « sondé 60 min », pas « aucun tenant vivant ».
  assert.equal(
    verdictDeSondeDuVerrou({ status: 2, tenantVivant: null, debut, maintenant: debut + 60 * 60_000, timeoutMin: 60 }),
    'rouge-borne',
  )
})

// ── rotation du log ───────────────────────────────────────────────────────────────────

test('nomDeRotation : `<nom>.log` devient `<nom>.<AAAAMMJJ-HHMMSS>.log`', () => {
  const date = new Date(2026, 8, 14, 3, 7, 9) // 14 septembre 2026, 03:07:09 — heure LOCALE
  assert.equal(
    nomDeRotation('/c/cache/publication/chantier_1751-ops-partout.log', date),
    '/c/cache/publication/chantier_1751-ops-partout.20260914-030709.log',
  )
  assert.equal(nomDeRotation('main.log', new Date(2026, 11, 1, 23, 59, 59)), 'main.20261201-235959.log')
})

describe('rotationnerLog', () => {
  // Fixture LOCALE : un dossier de cache jetable, jamais `node_modules/.cache` de l'arbre.
  const dossier = mkdtempSync(join(tmpdir(), 'publier-rotation-'))
  const log = join(dossier, 'chantier_1751.log')
  after(() => rmSync(dossier, { recursive: true, force: true }))

  test('un log NON VIDE est tourné ; le log courant libéré ; un log vide ou absent ne l’est pas', () => {
    assert.equal(rotationnerLog(log, new Date(2026, 8, 14, 3, 7, 9)), null, 'log absent : rien à tourner')
    writeFileSync(log, '')
    assert.equal(rotationnerLog(log, new Date(2026, 8, 14, 3, 7, 9)), null, 'log vide : rien à tourner')
    writeFileSync(log, 'PUBLICATION: vert abc\n')
    const tourne = rotationnerLog(log, new Date(2026, 8, 14, 3, 7, 9))
    assert.equal(tourne, join(dossier, 'chantier_1751.20260914-030709.log'))
    assert.equal(readFileSync(tourne, 'utf8'), 'PUBLICATION: vert abc\n')
    assert.equal(existsSync(log), false, 'le log courant est libéré — le run neuf le recrée vide')
  })

  test('le bornage est par PÉREMPTION d’ÂGE, et il ne touche QUE les logs tournés', () => {
    const vieux = join(dossier, 'chantier_1751.20250101-000000.log')
    const recent = join(dossier, 'chantier_1751.20260914-030710.log')
    const voisin = join(dossier, 'chantier_1751.json.31448.tmp')
    const autre = join(dossier, 'chantier_1751.log')
    for (const f of [vieux, recent, voisin, autre]) writeFileSync(f, 'x')
    const perime = Date.now() / 1000 - 8 * 24 * 60 * 60
    utimesSync(vieux, perime, perime)
    utimesSync(voisin, perime, perime)
    rotationnerLog(autre, new Date(2026, 8, 14, 4, 0, 0))
    assert.equal(existsSync(vieux), false, 'un log tourné de plus de 7 jours part')
    assert.equal(existsSync(recent), true, 'un log tourné récent reste')
    assert.equal(existsSync(voisin), true, 'le tmp du JOURNAL n’est pas un log tourné')
  })
})

test('motifDeRotation : il ne prend QUE les logs tournés — ni le log courant, ni le tmp du journal', () => {
  const motif = motifDeRotation('/c/cache/publication/chantier_1751.log')
  assert.equal(motif.test('chantier_1751.20260914-030709.log'), true)
  assert.equal(motif.test('chantier_1751.log'), false)
  assert.equal(motif.test('chantier_1751.json.31448.tmp'), false)
  // Le point du nom de branche est un POINT, jamais un joker : un autre log ne tombe pas dedans.
  assert.equal(motifDeRotation('a.b.log').test('axb.20260914-030709.log'), false)
})

// ── dejaFaite de l'étape `docs` ──────────────────────────────────────────────

test('étape `docs` : déjà faite sur la tête ENREGISTRÉE, pas sur `journal.tete`', () => {
  const docs = ETAPES.find((e) => e.nom === 'docs')
  const ctx = { tete: 'a'.repeat(40) }
  assert.equal(docs.dejaFaite(ctx, { tete: ctx.tete, etapes: { docs: { etat: 'vert', tete: ctx.tete } } }), true)
  // `journal.tete` est réécrit par le `rebase` du lot SUIVANT : un `docs` vert du lot PRÉCÉDENT
  // ne doit pas passer pour fait sur la tête courante.
  assert.equal(docs.dejaFaite(ctx, { tete: ctx.tete, etapes: { docs: { etat: 'vert', tete: 'b'.repeat(40) } } }), false)
  assert.equal(docs.dejaFaite(ctx, { tete: ctx.tete, etapes: { docs: { etat: 'rouge', tete: ctx.tete } } }), false)
  assert.equal(docs.dejaFaite(ctx, journalVide('c')), false)
})

// ── synchroniserAgents ─────────────────────────────────────────────────────────────────
// La décision passe par la porte `ctx.npm` du contexte : ce qui est joué, et dans quel ordre, se
// mesure sans lancer npm.

describe('synchroniserAgents', () => {
  const ctxFactice = (codes) => {
    const joues = []
    const dits = []
    return {
      joues,
      dits,
      npm(script) {
        joues.push(script)
        return { status: codes[script] ?? 0 }
      },
      journaliser: (t) => dits.push(t),
    }
  }

  test('`agents:check` VERT : `agents:check` est le seul script joué, et l’étape continue', () => {
    const ctx = ctxFactice({})
    assert.deepEqual(synchroniserAgents(ctx), { ok: true })
    assert.deepEqual(ctx.joues, ['agents:check'])
    assert.deepEqual(ctx.dits, [])
  })

  test('`agents:check` ROUGE : `agents:sync` est joué APRÈS lui, et l’étape continue', () => {
    const ctx = ctxFactice({ 'agents:check': 1 })
    assert.deepEqual(synchroniserAgents(ctx), { ok: true })
    assert.deepEqual(ctx.joues, ['agents:check', 'agents:sync'])
    assert.match(ctx.dits.join(''), /agents:check` rendu 1 : `npm run agents:sync`/)
  })

  test('`agents:sync` ROUGE : refus qui NOMME le script, son code et ce que le pre-commit ferait', () => {
    const ctx = ctxFactice({ 'agents:check': 1, 'agents:sync': 7 })
    const vu = synchroniserAgents(ctx)
    assert.equal(vu.ok, false)
    assert.equal(vu.raison, '`npm run agents:sync` a rendu 7 : le pre-commit jouerait `agents:check` et refuserait le commit')
    assert.deepEqual(ctx.joues, ['agents:check', 'agents:sync'])
  })
})

// ── ligneDeDetachement ─────────────────────────────────────────────────────────────────

test('ligneDeDetachement : la trace MACHINE que le parent laisse dans le log', () => {
  assert.equal(
    ligneDeDetachement({ pid: 4242, log: '/c/.cache/publication/chantier_1736-publier.log', args: ['--reprendre'] }),
    '[publier] détaché — pid=4242 log=/c/.cache/publication/chantier_1736-publier.log args=--reprendre\n',
  )
  assert.equal(ligneDeDetachement({ pid: 7, log: 'x.log', args: [] }), '[publier] détaché — pid=7 log=x.log args=\n')
})

// ── corpsDePilotage ────────────────────────────────────────────────────────────────────

const PILOTAGE = {
  numero: '1736',
  base: 'b'.repeat(40),
  tete: 'a'.repeat(40),
  commits: [{ sha: 'c'.repeat(40), message: 'feat(ops): corrige #1736 — le train\n\ncorps' }],
  gates: [{ nom: 'test', secondes: 120.5 }, { nom: 'lint' }],
  gatesJouees: true,
  ci: { etat: 'verte', course: { databaseId: 42 } },
  ferme: true,
}

test('corpsDePilotage : un ticket FERMÉ par la plage l’annonce, la marque est la DERNIÈRE ligne', () => {
  const corps = corpsDePilotage(PILOTAGE)
  assert.match(corps, /Ce commit FERME #1736/)
  assert.match(corps, /course `42`/)
  assert.match(corps, /test — 120\.5 s/)
  assert.match(corps, /lint — durée non mesurée/)
  assert.equal(corps.trimEnd().split('\n').at(-1), marquePublication(PILOTAGE.tete))
})

test('corpsDePilotage : un ticket RATTACHÉ le dit, sans promettre de fermeture', () => {
  const corps = corpsDePilotage({ ...PILOTAGE, ferme: false })
  assert.match(corps, /rattaché \(`refs`\)/)
  assert.doesNotMatch(corps, /FERME #1736/)
})

test('corpsDePilotage : fermé par la CI avant le rendu de l’étape `ci`, et fermé par un AUTRE geste', () => {
  assert.match(corpsDePilotage({ ...PILOTAGE, fermeParCi: true }), /FERMÉ par la CI \(job `fermetures`\)/)
  assert.match(corpsDePilotage({ ...PILOTAGE, fermeAutrement: true }), /déjà FERMÉ par un autre geste/)
})

test('corpsDePilotage : des gates NON rejouées ne montrent aucune durée, et le bridage est DIT', () => {
  const rejoue = corpsDePilotage(PILOTAGE)
  assert.match(rejoue, /WFRP_TEST_COEURS=4/)
  const saute = corpsDePilotage({ ...PILOTAGE, gatesJouees: false })
  assert.match(saute, /déjà justifiées pour ce contenu \(non rejouées\)/)
  assert.doesNotMatch(saute, /120\.5 s/)
})

test('titreDeCommit : première ligne, bornée à 120 caractères', () => {
  assert.equal(titreDeCommit('un titre\n\ncorps'), 'un titre')
  assert.equal(titreDeCommit(`${'x'.repeat(200)}`).length, 120)
})

// ── prerequisDesGates ──────────────────────────────────────────────────────────────────
// La table des gates et celle des prérequis sont INJECTÉES : ce qui se juge ici est la LECTURE du
// disque (le chemin est-il là ?) et le TEXTE rendu — celui de la gate, jamais une reformulation.

test('prerequisDesGates : rien à dire quand le chemin déclaré est là, une ligne quand il manque', () => {
  const racine = mkdtempSync(join(tmpdir(), 'prerequis-'))
  try {
    const gates = [{ nom: 'server:typecheck' }, { nom: 'lint' }]
    const ecritLu = {
      'server:typecheck': { prerequis: [{ chemin: 'server/node_modules', pose: 'npm --prefix server ci' }] },
      lint: { lit: [] },
    }
    assert.deepEqual(prerequisDesGates(racine, { gates, ecritLu }), [
      '[gates] server:typecheck — prérequis absent : `server/node_modules` (le pose : `npm --prefix server ci`)',
    ], 'le refus est MOT POUR MOT celui que la gate écrirait — après 881 s de série (3ᵉ train réel)')

    mkdirSync(join(racine, 'server', 'node_modules'), { recursive: true })
    assert.deepEqual(prerequisDesGates(racine, { gates, ecritLu }), [],
      'prérequis posé : la préflight ne dit plus rien, et le train paie la série')
  } finally { rmSync(racine, { recursive: true, force: true }) }
})

test('prerequisDesGates : les gates requises RÉELLES de ci.yml, mesurées sur l’arbre de ce dépôt', () => {
  // Pas d'attendu figé sur le CONTENU (l'arbre est équipé ou non selon la machine) : ce qui est
  // jugé est que la sonde tourne sur la table réelle et ne rend que des lignes de gate.
  for (const ligne of prerequisDesGates(RACINE)) assert.match(ligne, /^\[gates] \S+ — prérequis absent : `/)
})
