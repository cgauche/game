// CLIQUET du board des chantiers (node --test) : tout ce qui décide est PUR, et la MESURE se joue sur
// un git INJECTÉ — la base de comparaison est un paramètre, et la fixture le prouve avec une base qui
// n'est ni `main` ni `origin/main`.
// Lancé par `npm run test:ops`.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  CHAMPS, COULEURS_STATUT, JOURS_DORMANT, STATUTS, avanceDite, comptesDAvance, commitsDuLog,
  construireLignes, cleNormalisee, jourDe, lignesDeBranches, lireChamps, lireIssues, lireItems,
  mesurer, mutationOptions, optionsAReecrire, optionsDuChamp, planDeSync, poserChamp, requeteIssues,
  statutDe, statutLePlusVivant, synchroniser, ticketsCites, ticketsDe, valeursDeLigne,
} from './board.mjs'

const MS_JOUR = 24 * 60 * 60 * 1000
const MAINTENANT = new Date('2026-09-15T12:00:00Z')
const ilYA = (jours, secondes = 0) => new Date(MAINTENANT.getTime() - jours * MS_JOUR - secondes * 1000).toISOString()

test('lignesDeBranches lit nom, date ISO et sha — CRLF compris', () => {
  const texte = 'chantier/1727-cliquets\t2026-09-14T09:12:33+02:00\taaaaaaa\r\n'
    + 'codex/1388\t2026-09-01T18:00:00+02:00\tbbbbbbb\r\n'
    + 'main\t2026-09-15T08:00:00+02:00\tccccccc\r\n'
  const vues = lignesDeBranches(texte)
  assert.equal(vues.length, 3)
  assert.deepEqual(vues.map((b) => b.nom), ['chantier/1727-cliquets', 'codex/1388', 'main'])
  assert.equal(vues[0].dernierCommitISO, '2026-09-14T09:12:33+02:00')
  assert.equal(vues[1].sha, 'bbbbbbb')
})

test('lignesDeBranches sur une sortie vide rend []', () => {
  assert.deepEqual(lignesDeBranches(''), [])
  assert.deepEqual(lignesDeBranches('  \n\n'), [])
})

test('comptesDAvance lit la gauche en RETARD et la droite en AVANCE', () => {
  assert.deepEqual(comptesDAvance('17\t1\n'), { retard: 17, avance: 1 })
  assert.deepEqual(comptesDAvance('7\t0'), { retard: 7, avance: 0 })
  assert.equal(avanceDite({ avance: 1, retard: 17 }), '+1 / −17')
})

test('ticketsDe tire les segments PUREMENT numériques de ≥ 3 chiffres du nom de branche', () => {
  assert.deepEqual(ticketsDe('chantier/1478-1644-recette-opera'), [1478, 1644])
  assert.deepEqual(ticketsDe('wt-1728-L1'), [1728])
  assert.deepEqual(ticketsDe('codex/1388'), [1388])
  assert.deepEqual(ticketsDe('chantier/1739-crb5e'), [1739])
  assert.deepEqual(ticketsDe('chantier/1727-cliquets'), [1727])
  assert.deepEqual(ticketsDe('ab/phanes'), [])
})

test('ticketsDe se replie sur les messages d’avance : le plus cité, à égalité le plus petit', () => {
  const messages = 'fix(x): refs #1500 refs #1500\nchore: refs #1600\n'
  assert.deepEqual(ticketsDe('ab/notre', messages), [1500])
  const egalite = 'feat: refs #1600\nfix: corrige #1500\n'
  assert.deepEqual(ticketsDe('ab/notre', egalite), [1500])
  assert.deepEqual(ticketsDe('ab/notre', 'un message sans citation\n'), [])
})

test('commitsDuLog rend un enregistrement par commit, corps multi-lignes compris', () => {
  const texte = '2026-09-10T10:00:00+02:00sujet un\ncorps\n\nsuite\n'
    + '2026-09-11T10:00:00+02:00sujet deux refs #1392\n'
  const vus = commitsDuLog(texte)
  assert.equal(vus.length, 2)
  assert.equal(vus[0].dateISO, '2026-09-10T10:00:00+02:00')
  assert.match(vus[0].texte, /suite/)
  assert.match(vus[1].texte, /refs #1392/)
})

test('statutDe rend les cinq statuts, et la frontière de JOURS_DORMANT est inclusive', () => {
  const cadre = { maintenant: MAINTENANT, joursDormant: JOURS_DORMANT }
  assert.equal(statutDe({ avance: 3, dernierCommitISO: ilYA(0) }, cadre), 'En cours')
  assert.equal(statutDe({ avance: 3, dernierCommitISO: ilYA(7) }, cadre), 'En cours')
  assert.equal(statutDe({ avance: 3, dernierCommitISO: ilYA(7, 1) }, cadre), 'Dormant')
  assert.equal(statutDe({ avance: 0, dernierCommitISO: ilYA(1), citeParLaBase: true }, cadre), 'Fusionné')
  assert.equal(statutDe({ avance: 0, dernierCommitISO: ilYA(1), issue: { state: 'CLOSED' } }, cadre), 'Fermé')
})

test('à 0 commit d’avance, `Fusionné` EXIGE la preuve : sans citation de la base, c’est `Ouvert`', () => {
  const cadre = { maintenant: MAINTENANT, joursDormant: JOURS_DORMANT }
  assert.equal(statutDe({ avance: 0, dernierCommitISO: ilYA(0) }, cadre), 'Ouvert')
  assert.equal(statutDe({ avance: 0, dernierCommitISO: ilYA(0), citeParLaBase: false }, cadre), 'Ouvert')
  assert.equal(statutDe({ avance: 0, dernierCommitISO: ilYA(0), citeParLaBase: true }, cadre), 'Fusionné')
  assert.equal(statutDe({ avance: 3, dernierCommitISO: ilYA(0), citeParLaBase: true }, cadre), 'En cours')
  assert.deepEqual(STATUTS, ['En cours', 'Dormant', 'Ouvert', 'Fusionné', 'Fermé'])
  assert.equal(statutLePlusVivant('Fusionné', 'Ouvert'), 'Ouvert')
})

test('statutDe : `Fermé` PRIME sur une branche vivante', () => {
  const vu = statutDe(
    { avance: 12, dernierCommitISO: ilYA(0), issue: { state: 'CLOSED', closedAt: ilYA(1) } },
    { maintenant: MAINTENANT, joursDormant: JOURS_DORMANT },
  )
  assert.equal(vu, 'Fermé')
  assert.equal(statutLePlusVivant('Dormant', 'En cours'), 'En cours')
  assert.equal(statutLePlusVivant('Fusionné', 'Fermé'), 'Fusionné')
})

test('un ticket porté par DEUX branches : statut le plus vivant, et les deux branches listées', () => {
  const lignes = construireLignes({
    branches: [
      { nom: 'chantier/1501-a', avance: 2, retard: 5, dernierCommitISO: ilYA(20), tickets: [1501], worktrees: [] },
      { nom: 'wt-1501-L2', avance: 4, retard: 1, dernierCommitISO: ilYA(1), tickets: [1501], worktrees: ['/dep/.wt-1501 (sale)'] },
    ],
    issues: new Map([[1501, { number: 1501, state: 'OPEN', title: 'Un chantier' }]]),
  }, { maintenant: MAINTENANT, joursDormant: JOURS_DORMANT })
  assert.equal(lignes.length, 1)
  assert.equal(lignes[0].statut, 'En cours')
  assert.deepEqual(lignes[0].branches, ['chantier/1501-a', 'wt-1501-L2'])
  assert.equal(lignes[0].avance, '+2 / −5 · +4 / −1')
  assert.deepEqual(lignes[0].worktrees, ['/dep/.wt-1501 (sale)'])
  assert.equal(lignes[0].dernierCommit, ilYA(1).slice(0, 10))
})

test('ticketsCites lit une CHAÎNE de `#N` après le mot-clé, et ignore les `#N` nus', () => {
  assert.deepEqual([...ticketsCites('fix: refs #1392 #1388').keys()], [1392, 1388])
  assert.deepEqual([...ticketsCites('feat: refs #1687 #1644 lot 2').keys()], [1687, 1644])
  assert.deepEqual([...ticketsCites('refs #1392, #1388').keys()], [1392, 1388])
  assert.deepEqual([...ticketsCites('taxe #1648').keys()], [])
  assert.deepEqual([...ticketsCites('voir #12').keys()], [])
  assert.deepEqual([...ticketsCites('refs #1644\nautre ligne #99').keys()], [1644])
  assert.equal(ticketsCites('refs #1644 #1644').get(1644), 2)
})

test('jourDe garde le JOUR ÉCRIT PAR GIT (fuseau du committer), jamais un jour recalculé en UTC', () => {
  assert.equal(jourDe('2026-09-14T23:30:00+02:00'), '2026-09-14')
  assert.equal(jourDe('2026-09-14T01:00:00-05:00'), '2026-09-14')
  assert.equal(jourDe(''), '')
  assert.equal(jourDe('pas une date'), '')
})

test('construireLignes trie par statut (En cours → Fermé) puis par ticket croissant', () => {
  const lignes = construireLignes({
    branches: [
      { nom: 'chantier/1900', avance: 1, retard: 0, dernierCommitISO: ilYA(30), tickets: [1900], worktrees: [] },
      { nom: 'chantier/1800', avance: 1, retard: 0, dernierCommitISO: ilYA(0), tickets: [1800], worktrees: [] },
      { nom: 'chantier/1700', avance: 0, retard: 3, dernierCommitISO: ilYA(2), tickets: [1700], worktrees: ['/dep/.wt (propre+fusionné)'] },
      { nom: 'chantier/1300', avance: 0, retard: 0, dernierCommitISO: ilYA(0), tickets: [1300], worktrees: ['/dep/.wt-1300 (tenu)'] },
      { nom: 'chantier/1500', avance: 2, retard: 4, dernierCommitISO: ilYA(0), tickets: [1500], worktrees: ['/dep/.wt-1500 (sale)'] },
    ],
    fusionnes: [{ ticket: 1600, dateISO: ilYA(3) }, { ticket: 1700, dateISO: ilYA(2) }],
    issues: new Map([
      [1600, { number: 1600, state: 'OPEN', closedAt: null }],
      [1500, { number: 1500, state: 'CLOSED', closedAt: ilYA(1) }],
    ]),
  }, { maintenant: MAINTENANT, joursDormant: JOURS_DORMANT })
  assert.deepEqual(lignes.map((l) => [l.statut, l.ticket]),
    [['En cours', 1800], ['Dormant', 1900], ['Ouvert', 1300], ['Fusionné', 1600], ['Fusionné', 1700], ['Fermé', 1500]])
})

test('un ticket SEULEMENT cité par la base et DÉJÀ CLOS ne fait AUCUNE ligne', () => {
  const issues = new Map([[1736, { number: 1736, state: 'CLOSED', closedAt: ilYA(2), title: 'Fini' }]])
  const cadre = { maintenant: MAINTENANT, joursDormant: JOURS_DORMANT }
  assert.deepEqual(construireLignes({ fusionnes: [{ ticket: 1736, dateISO: ilYA(2) }], issues }, cadre), [])

  const avecBranche = construireLignes({
    branches: [{
      nom: 'chantier/1736', avance: 0, retard: 3, dernierCommitISO: ilYA(2), tickets: [1736],
      worktrees: ['/dep/.wt-1736 (propre+fusionné)'],
    }],
    fusionnes: [{ ticket: 1736, dateISO: ilYA(2) }],
    issues,
  }, cadre)
  assert.deepEqual(avecBranche.map((l) => [l.ticket, l.statut, l.worktrees.length]), [[1736, 'Fermé', 1]])
})

const LIGNE = {
  ticket: 1727,
  titre: 'Cliquets',
  statut: 'En cours',
  branches: ['chantier/1727-cliquets'],
  worktrees: ['/dep/.wt-1727 (sale)'],
  avance: '+1 / −17',
  dernierCommit: '2026-09-14',
}

const itemDe = (surcharges = {}) => ({
  id: 'PVTI_1',
  ticket: 1727,
  champs: {
    status: 'En cours',
    branche: 'chantier/1727-cliquets',
    worktree: '/dep/.wt-1727 (sale)',
    avance: '+1 / −17',
    derniercommit: '2026-09-14',
    ...surcharges,
  },
})

test('planDeSync (a) un item ABSENT est ajouté', () => {
  const plan = planDeSync([LIGNE], [])
  assert.deepEqual(plan.ajouts, [1727])
  assert.deepEqual(plan.editions, [])
  assert.deepEqual(plan.archivages, [])
})

test('planDeSync (b) un item PRÉSENT identique ne produit AUCUN geste — idempotence', () => {
  const plan = planDeSync([LIGNE], [itemDe()])
  assert.deepEqual(plan, { ajouts: [], editions: [], archivages: [] })
})

test('planDeSync (c) une seule valeur qui diffère → UNE édition, qui NOMME son champ', () => {
  const plan = planDeSync([LIGNE], [itemDe({ status: 'Dormant' })])
  assert.deepEqual(plan.editions, [{ itemId: 'PVTI_1', champ: 'Status', valeur: 'En cours' }])
  assert.deepEqual(plan.ajouts, [])
})

test('planDeSync : une DATE ne se compare que sur son jour', () => {
  const plan = planDeSync([LIGNE], [itemDe({ derniercommit: '2026-09-14T00:00:00Z' })])
  assert.deepEqual(plan.editions, [])
  assert.equal(CHAMPS.find((c) => c.nom === 'Dernier commit').type, 'DATE')
})

test('planDeSync (b2) un item existant NON mesuré dont l’issue est CLOSED est ARCHIVÉ', () => {
  const parti = { id: 'PVTI_9', ticket: 1751, champs: { status: 'Fermé' } }
  const plan = planDeSync([LIGNE], [itemDe(), parti], {
    issues: new Map([[1751, { number: 1751, state: 'CLOSED', closedAt: ilYA(1) }]]),
  })
  assert.deepEqual(plan.archivages, ['PVTI_9'])
  assert.deepEqual(plan.editions, [])
  assert.deepEqual(plan.ajouts, [])
})

test('planDeSync (c2) un item existant NON mesuré dont l’issue est OUVERTE n’est PAS touché', () => {
  const aLaMain = { id: 'PVTI_9', ticket: 999, champs: { status: 'Todo' } }
  const plan = planDeSync([LIGNE], [itemDe(), aLaMain], {
    issues: new Map([[999, { number: 999, state: 'OPEN', closedAt: null }]]),
  })
  assert.deepEqual(plan, { ajouts: [], editions: [], archivages: [] })
  const sansEtat = planDeSync([LIGNE], [itemDe(), aLaMain])
  assert.deepEqual(sansEtat.archivages, [])
})

test('planDeSync (d) une ligne `Fermé` MESURÉE s’édite normalement et ne s’archive JAMAIS', () => {
  const clos = { ...LIGNE, statut: 'Fermé' }
  const plan = planDeSync([clos], [itemDe()], {
    issues: new Map([[1727, { number: 1727, state: 'CLOSED', closedAt: ilYA(400) }]]),
  })
  assert.deepEqual(plan.archivages, [])
  assert.deepEqual(plan.editions, [{ itemId: 'PVTI_1', champ: 'Status', valeur: 'Fermé' }])
})

test('valeursDeLigne joint branches et worktrees par « · », et keye par NOM de champ', () => {
  const valeurs = valeursDeLigne({ ...LIGNE, branches: ['a', 'b'], worktrees: ['/x (sale)', '/y (tenu)'] })
  assert.deepEqual(Object.keys(valeurs), CHAMPS.map((c) => c.nom))
  assert.equal(valeurs.Branche, 'a · b')
  assert.equal(valeurs.Worktree, '/x (sale) · /y (tenu)')
})

test('le STATUT est porté par le champ INTÉGRÉ `Status`, dont les options sont les nôtres', () => {
  const declare = CHAMPS.find((c) => c.type === 'SINGLE_SELECT')
  assert.equal(declare.nom, 'Status')
  assert.deepEqual([...declare.options], STATUTS)
  assert.equal(valeursDeLigne(LIGNE).Status, 'En cours')
  assert.equal(cleNormalisee('Status'), 'status')
})

test('optionsAReecrire : les nôtres → non ; le Todo/In Progress/Done intégré → oui', () => {
  const integre = {
    fields: [{
      id: 'PVTSSF_1',
      name: 'Status',
      type: 'ProjectV2SingleSelectField',
      options: [{ id: 'a', name: 'Todo' }, { id: 'b', name: 'In Progress' }, { id: 'c', name: 'Done' }],
    }],
  }
  const notre = {
    fields: [{
      id: 'PVTSSF_1',
      name: 'Status',
      type: 'ProjectV2SingleSelectField',
      options: STATUTS.map((nom, i) => ({ id: `o${i}`, name: nom })),
    }],
  }
  assert.deepEqual(optionsDuChamp(integre, 'Status'), ['Todo', 'In Progress', 'Done'])
  assert.equal(optionsAReecrire(optionsDuChamp(integre, 'Status')), true)
  assert.equal(optionsAReecrire(optionsDuChamp(notre, 'Status')), false)
  assert.equal(optionsAReecrire(['Dormant', 'En cours', 'Fusionné', 'Fermé']), true)
  assert.deepEqual(optionsDuChamp(integre, 'Statut absent'), [])
})

test('mutationOptions nomme les 5 options et leur COULEUR, sur le fieldId donné', () => {
  const requete = mutationOptions('PVTSSF_1')
  assert.match(requete, /updateProjectV2Field\(input: \{fieldId: "PVTSSF_1", singleSelectOptions: \[/)
  for (const nom of STATUTS) {
    assert.ok(requete.includes(`{name: "${nom}", color: ${COULEURS_STATUT[nom]}, description: ""}`),
      `option manquante : ${nom} — ${requete}`)
  }
  assert.deepEqual(Object.values(COULEURS_STATUT), ['GREEN', 'ORANGE', 'YELLOW', 'BLUE', 'GRAY'])
  assert.match(requete, /\.\.\. on ProjectV2SingleSelectField \{ id options \{ id name \} \}/)
})

test('requeteIssues rend un alias par ticket, sous le dépôt nommé', () => {
  const requete = requeteIssues([1727, 1388])
  assert.match(requete, /repository\(owner: "cgauche", name: "game"\)/)
  assert.match(requete, /i1727: issue\(number: 1727\)/)
  assert.match(requete, /i1388: issue\(number: 1388\)/)
  assert.match(requete, /number state closedAt title/)
})

test('lireIssues : un alias `null` est une ANOMALIE nommée, pas un ticket silencieux', () => {
  const reponse = { data: { repository: { i1727: { number: 1727, state: 'OPEN', closedAt: null, title: 'T' }, i9999: null } } }
  const vu = lireIssues(reponse, [1727, 9999])
  assert.equal(vu.issues.get(1727).title, 'T')
  assert.equal(vu.issues.has(9999), false)
  assert.deepEqual(vu.anomalies, ['ticket #9999 introuvable dans cgauche/game'])
})

test('lireChamps et lireItems ne lisent que ce qui est contractuel, par NOM normalisé', () => {
  const champs = lireChamps({
    fields: [
      { id: 'F1', name: 'Status', type: 'ProjectV2SingleSelectField', options: [{ id: 'O1', name: 'En cours' }] },
      { id: 'F2', name: 'Dernier commit', type: 'ProjectV2Field' },
    ],
  })
  assert.equal(champs.get(cleNormalisee('Dernier commit')).id, 'F2')
  assert.equal(champs.get('status').options.get(cleNormalisee('En cours')), 'O1')

  const items = lireItems({
    items: [
      { id: 'PVTI_1', title: 'x', content: { type: 'Issue', number: 1727, repository: 'cgauche/game' }, statut: 'En cours', 'dernier commit': '2026-09-14' },
      { id: 'PVTI_2', content: { type: 'DraftIssue', title: 'note' } },
      { id: 'PVTI_3', content: { type: 'Issue', number: 12, repository: 'autre/depot' } },
    ],
    totalCount: 3,
  })
  assert.deepEqual(items.map((i) => i.ticket), [1727])
  assert.equal(items[0].champs[cleNormalisee('Dernier commit')], '2026-09-14')
})

test('la MESURE reçoit sa BASE en paramètre : `main` local n’est jamais la base', () => {
  const appels = []
  const fait = (stdout) => ({ disponible: true, valeur: { status: 0, stdout, stderr: '' } })
  const git = (args) => {
    appels.push(args.join(' '))
    if (args[0] === 'rev-parse') return fait('/dep/.git\n')
    if (args[0] === 'for-each-ref') return fait('chantier/1727-cliquets\t2026-09-14T09:00:00+02:00\taaaaaaa\nmain\t2026-09-15T08:00:00+02:00\tccccccc\n')
    if (args[0] === 'rev-list') return fait('17\t1\n')
    if (args[0] === 'log') return fait('')
    return fait('')
  }
  const vu = mesurer({
    cwd: '/dep/.wt-1768',
    base: 'origin/autre',
    git,
    fetch: () => fait(''),
    inv: () => ({ ok: true, worktrees: [{ chemin: '/dep', principal: true, branche: 'main' }] }),
    issues: () => ({ issues: new Map([[1727, { number: 1727, state: 'OPEN', title: 'Cliquets' }]]), anomalies: [] }),
    maintenant: MAINTENANT,
  })
  assert.equal(vu.ok, true)
  assert.ok(appels.includes('rev-list --left-right --count origin/autre...chantier/1727-cliquets'),
    `args reçus : ${JSON.stringify(appels)}`)
  assert.ok(appels.some((a) => a.includes('origin/autre..chantier/1727-cliquets')),
    `args reçus : ${JSON.stringify(appels)}`)
  assert.ok(appels.every((a) => !/(^| )main\.\.|\.\.\.main( |$)/.test(a)), `args reçus : ${JSON.stringify(appels)}`)
  assert.deepEqual(vu.lignes.map((l) => [l.ticket, l.statut, l.avance]), [[1727, 'En cours', '+1 / −17']])
})

test('la mesure NOMME le worktree détaché et la branche sans ticket, et les tient hors du board', () => {
  const fait = (stdout) => ({ disponible: true, valeur: { status: 0, stdout, stderr: '' } })
  const git = (args) => {
    if (args[0] === 'rev-parse') return fait('/dep/.git\n')
    if (args[0] === 'for-each-ref') {
      return fait('ab/phanes\t2026-09-10T09:00:00+02:00\taaaaaaa\nchantier/vide\t2026-09-10T09:00:00+02:00\tbbbbbbb\n')
    }
    if (args[0] === 'rev-list') return fait('3\t2\n')
    if (args[0] === 'log') return fait('2026-09-10T09:00:00+02:00un message sans citation\n')
    return fait('')
  }
  const vu = mesurer({
    cwd: '/dep',
    base: 'origin/main',
    git,
    fetch: () => fait(''),
    inv: () => ({
      ok: true,
      worktrees: [
        { chemin: '/dep', principal: true, branche: 'main' },
        { chemin: '/dep/.codex/worktrees/914b/Game', principal: false, branche: null, classe: 'propre+hors-main' },
      ],
    }),
    issues: () => ({ issues: new Map(), anomalies: [] }),
    maintenant: MAINTENANT,
  })
  assert.equal(vu.ok, true)
  assert.deepEqual(vu.lignes, [])
  assert.equal(vu.anomalies.filter((a) => a.startsWith('worktree détaché')).length, 1)
  assert.equal(vu.anomalies.filter((a) => a.startsWith('branche sans ticket dérivable')).length, 2)
})

test('la mesure REFUSE nommément quand origin n’est pas consultable', () => {
  const fait = (stdout) => ({ disponible: true, valeur: { status: 0, stdout, stderr: '' } })
  const vu = mesurer({
    cwd: '/dep',
    git: (args) => (args[0] === 'rev-parse' ? fait('/dep/.git\n') : fait('')),
    fetch: () => ({ disponible: false, raison: 'réseau coupé' }),
  })
  assert.equal(vu.ok, false)
  assert.match(vu.refus, /origin non consultable \(réseau coupé\)/)
})

test('une branche sans avance ET sans worktree est IGNORÉE ; avec worktree, `Fusionné` si la base la cite, sinon `Ouvert`', () => {
  const fait = (stdout) => ({ disponible: true, valeur: { status: 0, stdout, stderr: '' } })
  const gitQuiCite = (citation) => (args) => {
    if (args[0] === 'rev-parse') return fait('/dep/.git\n')
    if (args[0] === 'for-each-ref') {
      return fait('chantier/1751-ops\t2026-09-12T09:00:00+02:00\taaaaaaa\n'
        + 'worktree-agent-mort\t2026-09-01T09:00:00+02:00\tbbbbbbb\n')
    }
    if (args[0] === 'rev-list') return fait('7\t0\n')
    if (args[0] === 'log') return fait(citation)
    return fait('')
  }
  const mesureAvec = (citation) => mesurer({
    cwd: '/dep',
    git: gitQuiCite(citation),
    fetch: () => fait(''),
    inv: () => ({
      ok: true,
      worktrees: [
        { chemin: '/dep', principal: true, branche: 'main' },
        { chemin: '/dep/.wt-1751', principal: false, branche: 'chantier/1751-ops', classe: 'propre+fusionné' },
      ],
    }),
    issues: () => ({ issues: new Map([[1751, { number: 1751, state: 'OPEN' }]]), anomalies: [] }),
    maintenant: MAINTENANT,
  })

  const cite = mesureAvec('2026-09-14T09:00:00+02:00feat: refs #1751\n')
  assert.deepEqual(cite.lignes.map((l) => [l.ticket, l.statut, l.worktrees]),
    [[1751, 'Fusionné', ['/dep/.wt-1751 (propre+fusionné)']]])
  assert.deepEqual(cite.anomalies, [])

  const sansCitation = mesureAvec('')
  assert.deepEqual(sansCitation.lignes.map((l) => [l.ticket, l.statut]), [[1751, 'Ouvert']])
})

test('la mesure NOMME un journal de base illisible, et ne dit pas « sans ticket » sur un log non lu', () => {
  const fait = (stdout) => ({ disponible: true, valeur: { status: 0, stdout, stderr: '' } })
  const git = (args) => {
    if (args[0] === 'rev-parse') return fait('/dep/.git\n')
    if (args[0] === 'for-each-ref') return fait('ab/phanes\t2026-09-10T09:00:00+02:00\taaaaaaa\n')
    if (args[0] === 'rev-list') return fait('3\t2\n')
    if (args[0] === 'log') return { disponible: false, raison: 'disque en panne' }
    return fait('')
  }
  const vu = mesurer({
    cwd: '/dep',
    git,
    fetch: () => fait(''),
    inv: () => ({ ok: true, worktrees: [{ chemin: '/dep', principal: true, branche: 'main' }] }),
    issues: () => ({ issues: new Map(), anomalies: [] }),
    maintenant: MAINTENANT,
  })
  assert.deepEqual(vu.lignes, [])
  assert.equal(vu.anomalies.filter((a) => a.startsWith('messages d’avance de ab/phanes illisibles')).length, 1)
  assert.equal(vu.anomalies.filter((a) => a.startsWith('journal de origin/main illisible')).length, 1)
  assert.equal(vu.anomalies.filter((a) => a.startsWith('branche sans ticket dérivable')).length, 0)
})

const CHAMPS_FIXTURE = {
  fields: [
    { id: 'F_ST', name: 'Status', type: 'ProjectV2SingleSelectField', options: STATUTS.map((nom, i) => ({ id: `O${i}`, name: nom })) },
    { id: 'F_BR', name: 'Branche', type: 'ProjectV2Field' },
    { id: 'F_WT', name: 'Worktree', type: 'ProjectV2Field' },
    { id: 'F_AV', name: 'Avance', type: 'ProjectV2Field' },
    { id: 'F_DC', name: 'Dernier commit', type: 'ProjectV2Field' },
  ],
}

/** Un `gh` de fixture : rend le JSON attendu par commande, et journalise chaque appel. */
function ghDeFixture(items, appels) {
  return (args) => {
    appels.push(args.join(' '))
    const quoi = args.slice(0, 2).join(' ')
    if (quoi === 'project list') {
      return JSON.stringify({ projects: [{ id: 'PVT_1', number: 1, title: 'Chantiers', closed: false }] })
    }
    if (quoi === 'project field-list') return JSON.stringify(CHAMPS_FIXTURE)
    if (quoi === 'project item-list') return JSON.stringify({ items, totalCount: items.length })
    if (quoi === 'project item-edit' || quoi === 'project item-archive') return '{}'
    if (quoi === 'project item-add') return JSON.stringify({ id: 'PVTI_NEUF' })
    throw new Error(`gh non prévu dans la fixture : ${args.join(' ')}`)
  }
}

const LIGNE_VIDEE = {
  ticket: 1700, statut: 'Fusionné', branches: [], worktrees: [], avance: '', dernierCommit: '',
}

const ITEM_1700 = (champs) => ({
  id: 'PVTI_7',
  content: { type: 'Issue', number: 1700, repository: 'cgauche/game' },
  ...champs,
})

test('synchroniser EFFACE les valeurs devenues vides (--clear) — une branche retirée ne reste pas affichée', () => {
  const appels = []
  const items = [ITEM_1700({
    status: 'En cours', branche: 'chantier/1700-x', worktree: '/dep/.wt-1700 (sale)', avance: '+3 / −2',
  })]
  const bilan = synchroniser({
    lignes: [LIGNE_VIDEE],
    gh: ghDeFixture(items, appels),
    issues: () => ({ issues: new Map(), anomalies: [] }),
  })
  const editions = appels.filter((a) => a.startsWith('project item-edit'))
  assert.equal(bilan.ok, true)
  assert.equal(bilan.misAJour, 4)
  assert.equal(editions.length, 4)
  assert.equal(editions.filter((a) => a.includes('--clear')).length, 3)
  assert.ok(editions.some((a) => a === 'project item-edit --project-id PVT_1 --id PVTI_7 --field-id F_ST --single-select-option-id O3'),
    `gestes reçus : ${JSON.stringify(editions)}`)
  for (const champ of ['F_BR', 'F_WT', 'F_AV']) {
    assert.ok(editions.includes(`project item-edit --project-id PVT_1 --id PVTI_7 --field-id ${champ} --clear`),
      `effacement manquant : ${champ} — ${JSON.stringify(editions)}`)
  }
  assert.equal(appels.filter((a) => a.startsWith('project item-add')).length, 0)
})

test('synchroniser : le SECOND passage sur l’item déjà à jour ne fait AUCUN geste', () => {
  const appels = []
  const items = [ITEM_1700({ status: 'Fusionné', branche: '', worktree: '', avance: '' })]
  const bilan = synchroniser({
    lignes: [LIGNE_VIDEE],
    gh: ghDeFixture(items, appels),
    issues: () => ({ issues: new Map(), anomalies: [] }),
  })
  assert.deepEqual(bilan, { ok: true, numero: 1, ajoutes: 0, misAJour: 0, archives: 0, cree: false })
  assert.deepEqual(appels.filter((a) => /item-(edit|add|archive)/.test(a)), [])
})

test('synchroniser ARCHIVE l’item d’un ticket non mesuré dont l’issue est CLOSED', () => {
  const appels = []
  const items = [ITEM_1700({ status: 'Fusionné', branche: '', worktree: '', avance: '' }), {
    id: 'PVTI_9', content: { type: 'Issue', number: 1751, repository: 'cgauche/game' }, status: 'Fermé',
  }]
  const bilan = synchroniser({
    lignes: [LIGNE_VIDEE],
    gh: ghDeFixture(items, appels),
    issues: (numeros) => {
      assert.deepEqual(numeros, [1751])
      return { issues: new Map([[1751, { number: 1751, state: 'CLOSED' }]]), anomalies: [] }
    },
  })
  assert.equal(bilan.archives, 1)
  assert.ok(appels.includes('project item-archive 1 --owner cgauche --id PVTI_9'),
    `gestes reçus : ${JSON.stringify(appels)}`)
})

test('poserChamp : un drapeau par TYPE — texte, date, option, et --clear pour le vide', () => {
  const champs = lireChamps(CHAMPS_FIXTURE)
  const args = []
  const ghFn = (a) => { args.push(a.join(' ')); return '{}' }
  const pose = (champ, valeur) => poserChamp({
    ghFn, projetId: 'PVT_1', itemId: 'PVTI_7', champs, champ, valeur,
  })
  pose('Branche', 'chantier/1700-x')
  pose('Dernier commit', '2026-09-14T09:00:00+02:00')
  pose('Status', 'Dormant')
  pose('Avance', '')
  assert.deepEqual(args, [
    'project item-edit --project-id PVT_1 --id PVTI_7 --field-id F_BR --text chantier/1700-x',
    'project item-edit --project-id PVT_1 --id PVTI_7 --field-id F_DC --date 2026-09-14',
    'project item-edit --project-id PVT_1 --id PVTI_7 --field-id F_ST --single-select-option-id O1',
    'project item-edit --project-id PVT_1 --id PVTI_7 --field-id F_AV --clear',
  ])
  assert.throws(() => pose('Status', 'Todo'), /option « Todo » absente du champ « Status »/)
})
