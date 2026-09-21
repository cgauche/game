// GARDE DE FORME du workflow d'extraction de fiches d'Atlas (#1825 lot E).
//
// L'invariant : le script ne NOMME aucun livre ni aucun DOMAINE — ni sigle, ni titre, ni dossier, ni
// édition, ni cardinal de livres/chapitres —, ni dans son code, ni dans un PROMPT. Le périmètre
// (cœur de règles, livres, dossiers, LANGUES) et le vocabulaire des DOMAINES (carte du cœur, lot à
// traiter) lui ENTRENT par le global `args`, projetés de `src/data/books.json` et de
// `scripts/raw/domaines.json` par `perimetreDeCoeur` (`workflow-args.mjs`).
//
// Un banc qui ne lirait que le CODE raterait le cas qui a coûté : une identité de livre en dur dans
// un prompt, invisible à tout grep de table. Ce banc JOUE donc le script (enveloppe partagée
// `scripts/guards/lib/jouer-workflow.mjs`, doublures pour `agent`/`parallel`/`pipeline`/`phase`/
// `log`) avec un registre de FIXTURE à deux cœurs et deux langues dont RIEN n'existe au registre
// réel, puis confronte les prompts RÉELLEMENT envoyés.
//
// COUVERTURE — deux runs : l'un « audit sec » (chemin nominal), l'autre à TROUS et à fidélité
// REFUSÉE, qui seul atteint `applyGaps` (`augmentPrompt`) et la re-vérification. Les prompts des
// deux sont FUSIONNÉS avant jugement, et un contrat exige que CHAQUE fonction `*Prompt` du SOURCE
// ait produit au moins un prompt : une phase jamais atteinte rougit, au lieu de passer en silence.
import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'
import { REGISTRE_LIVRES } from './_lib.mjs'
import { assemble } from './assemble-domain.mjs'
import { lireRendu, perimetreDeCoeur } from './workflow-args.mjs'
import { coeursDeDomaines, coeursDuRegistre, domainesDe } from './_lib.mjs'
import { scanForbiddenCounts } from './check-atlas-counts.mjs'
import { jouerWorkflow } from '../guards/lib/jouer-workflow.mjs'

const SCRIPT = fileURLToPath(new URL('./atlas-domain.workflow.js', import.meta.url))
const SOURCE = readFileSync(SCRIPT, 'utf8')

// Registre de FIXTURE : deux cœurs, deux langues, sigles/titres/dossiers/langues inventés.
// `SXX` (sans `dir`) mesure qu'un livre sans extraction ne descend pas au périmètre.
const REGISTRE_FIXTURE = [
  { id: 'base-alpha', abbr: 'BKA', label: 'Socle Alpha', dir: 'Source/Fixture - Base Alpha', language: 'Langue-A', coeur: 'alpha' },
  { id: 'base-beta', abbr: 'BKB', label: 'Socle Beta', dir: 'Source/Fixture - Base Beta', language: 'Langue-B', coeur: 'beta' },
  { id: 'supplement-gamma', abbr: 'SPG', label: 'Appendice Gamma', dir: 'Source/Fixture - Supplement Gamma', language: 'Langue-B' },
  { id: 'sans-extraction', abbr: 'SXX', label: 'Jamais Extrait', language: 'Langue-A' },
]
// Domaines de FIXTURE : clés et titres INVENTÉS, deux cœurs — rien du registre réel.
const DOMAINES_FIXTURE = {
  alpha: [
    { cle: 'domaine-un', titre: 'Premier Domaine de Fixture' },
    { cle: 'domaine-deux', titre: 'Second Domaine de Fixture' },
  ],
  beta: [{ cle: 'domaine-trois', titre: 'Troisieme Domaine de Fixture' }],
}
const LOT = ['domaine-un']
const PERIMETRE = () => perimetreDeCoeur('alpha', {
  supplements: true, lot: LOT, registre: REGISTRE_FIXTURE, registreDomaines: DOMAINES_FIXTURE,
})

/** Rendus d'agent valides ; `trous` fait passer le run par `applyGaps` et la re-vérification. */
const repondreAvec = (trous) => {
  let audits = 0
  return (prompt, opts) => {
    switch (opts.phase) {
      case 'Cadrage': return { coverageRefs: [{ ab: 'BKA', nn: '05' }], sonnetBooks: ['SPG'] }
      case 'Cartographie': return { items: [{ item: 'Une regle de fixture', kind: 'table', ref: 'BKA 05 l.1-2', gist: 'un gist' }] }
      case 'Taxonomie': return { topics: [{ id: 'topic-un', t: 'Topic Un', hint: 'un hint', covers: ['Une regle de fixture'] }] }
      case 'Survey': return { hits: [{ topicId: 'topic-un', ref: 'BKA 05 l.1', gist: 'un gist' }] }
      case 'Synthese': return { topicId: 'topic-un', title: 'Topic Un', markdown: '## Topic Un\n\nUn corps.', refs: ['BKA 05 l.1'], codeHint: '' }
      case 'Audit':
        // `augment` vit AUSSI dans la phase Audit : seule la demande d'AUDIT porte le schéma `dry`.
        if (!/^AUDIT DE COMPLETUDE/.test(prompt)) return { topicId: 'topic-un', title: 'Topic Un', markdown: '## Topic Un\n\nCorrige.', refs: ['BKA 05 l.1'], codeHint: '' }
        audits += 1
        return (trous && audits === 1)
          ? { dry: false, gaps: [{ kind: 'survole', topicId: 'topic-un', what: 'une table aux bornes', ref: 'BKA 05 l.1' }] }
          : { dry: true, gaps: [] }
      // Une fidélité REFUSÉE ouvre la correction de fidélité puis la re-vérification.
      case 'Verif': return { topicId: 'topic-un', faithful: !trous, issues: trous ? ['une valeur fausse'] : [] }
      default: throw new Error(`phase inattendue : ${opts.phase}`)
    }
  }
}

/** Les deux runs, prompts FUSIONNÉS. */
async function promptsDesDeuxRuns() {
  const fusion = new Map()
  for (const trous of [false, true]) {
    const { promptsParLabel } = await jouerWorkflow(SCRIPT, PERIMETRE(), repondreAvec(trous))
    for (const [cle, p] of promptsParLabel) fusion.set(cle, p)
  }
  return fusion
}

/** Les fonctions de prompt du SOURCE, avec l'amorce littérale de ce qu'elles rendent. DÉRIVÉ. */
const fonctionsDePrompt = [...SOURCE.matchAll(/function (\w+Prompt)\s*\([^)]*\)\s*\{[\s\S]*?return \[\s*'((?:[^'\\]|\\.){10,})'/g)]
  .map((m) => ({ nom: m[1], amorce: m[2].slice(0, 20) }))

/** Bordures UNICODE : `\w` laisserait passer « ZI, ÉAA, l'ACE. */
const borde = (s) => new RegExp(`(?<![\\p{L}\\p{N}])${s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\\p{L}\\p{N}])`, 'u')

/** Toute identité du registre RÉEL : sigles, libellés, dossiers, cœurs, langues, TITRES de domaine. */
const identitesReelles = () => [
  ...REGISTRE_LIVRES.flatMap((b) => [b.abbr, b.label, b.dir].filter(Boolean)),
  ...coeursDuRegistre(REGISTRE_LIVRES),
  ...new Set(REGISTRE_LIVRES.map((b) => b.language).filter(Boolean)),
  ...coeursDeDomaines().flatMap((c) => domainesDe(c).map((d) => d.titre)),
]

test('workflow Atlas : CHAQUE fonction de prompt du script a produit un prompt (aucune phase muette)', async () => {
  const prompts = [...(await promptsDesDeuxRuns()).values()]
  assert.ok(fonctionsDePrompt.length >= 7, `amorces mal dérivées du source : ${fonctionsDePrompt.length}`)
  const muettes = fonctionsDePrompt.filter((f) => !prompts.some((p) => p.includes(f.amorce)))
  assert.deepEqual(muettes.map((f) => f.nom), [], 'fonctions de prompt jamais atteintes : la garde ne les juge pas')
})

test('workflow Atlas : aucune IDENTITÉ du registre RÉEL ne part dans un prompt', async () => {
  const prompts = await promptsDesDeuxRuns()
  const fuites = []
  for (const [cle, prompt] of prompts) {
    for (const identite of identitesReelles()) {
      const m = prompt.match(borde(identite))
      if (m) fuites.push(`${cle} : « ${identite} » dans « …${prompt.slice(Math.max(0, m.index - 30), m.index + identite.length + 30)}… »`)
    }
  }
  assert.deepEqual(fuites, [], `identités du registre réel écrites en dur dans un prompt :\n${fuites.join('\n')}`)
})

/**
 * Les noms de DOMAINE qu'un prompt ÉMET, lus à leur FORME d'émission : la carte du cœur (le bloc de
 * lignes `- <cle> : <titre>` que sa phrase d'introduction porte) et l'id du domaine du run. On ne
 * CHERCHE aucune clé réelle dans le texte — une `cle` est un mot commun (« combat », « magie »,
 * « tests »), et un tel détecteur rougirait sur du français. C'est l'ENSEMBLE émis qu'on confronte.
 */
function nomsDeDomaineEmis(prompts) {
  const noms = new Set()
  for (const prompt of prompts.values()) {
    // `(id …)` est ANCRÉ à l'en-tête du cadrage : la même forme sert aussi aux id de TOPIC, qui
    // viennent du rendu d'agent, pas des `args`.
    const cadrage = /^CADRAGE du domaine "([^"]+)" \(id ([^)]+)\)/m.exec(prompt)
    if (cadrage) { noms.add(cadrage[1]); noms.add(cadrage[2]) }
    for (const m of prompt.matchAll(/le TIEN est "([^"]+)"/g)) noms.add(m[1])
    const carte = /^.*domaines de l Atlas.*$\n((?:- .+\n?)+)/m.exec(prompt)
    for (const ligne of carte ? carte[1].trim().split('\n') : []) {
      const vu = /^- (\S+) : (.+)$/.exec(ligne)
      if (vu) { noms.add(vu[1]); noms.add(vu[2]) }
    }
  }
  return noms
}

test('workflow Atlas : tout nom de DOMAINE émis dans un prompt vient des `args` de la fixture', async () => {
  const attendus = PERIMETRE().domaines.flatMap((d) => [d.cle, d.titre]).sort()
  assert.deepEqual(
    [...nomsDeDomaineEmis(await promptsDesDeuxRuns())].sort(),
    attendus,
    'la carte des domaines émise doit être EXACTEMENT celle des `args` — un nom de plus est une ' +
      'identité écrite en dur, un nom de moins une carte devenue muette (que rien ne jugerait)',
  )
})

test('workflow Atlas : aucun CARDINAL de livres ou de chapitres dans un prompt', async () => {
  const prompts = await promptsDesDeuxRuns()
  const fuites = []
  for (const [cle, prompt] of prompts)
    for (const v of scanForbiddenCounts(prompt)) fuites.push(`${cle}:${v.line} « ${v.excerpt} » — ${v.reason}`)
  assert.deepEqual(fuites, [], `cardinaux écrits en dur dans un prompt :\n${fuites.join('\n')}`)
})

test('workflow Atlas : le livre de RÉFÉRENCE est le livre de cœur du périmètre reçu', async () => {
  const prompts = await promptsDesDeuxRuns()
  const cadrage = prompts.get(`Cadrage:${LOT[0]}:cadrage`)
  assert.ok(cadrage, `prompt de cadrage absent — labels : ${[...prompts.keys()].join(' · ')}`)
  assert.match(cadrage, /Source\/Fixture - Base Alpha\/00 - Index\.md/)
  assert.match(cadrage, /livre de REFERENCE du perimetre, BKA/)
  assert.match(cadrage, /coeur de regles « alpha »/)
  // Le livre de l'AUTRE cœur n'est pas du périmètre : il n'est cité nulle part.
  assert.equal([...prompts.values()].some((p) => /\bBKB\b/.test(p)), false)
})

test('workflow Atlas : la consigne de CITATION suit la langue du livre cité', async () => {
  const prompts = await promptsDesDeuxRuns()
  assert.match(prompts.get(`Survey:${LOT[0]}:survey:BKA`), /Livre : BKA \(langue : Langue-A\)/)
  assert.match(prompts.get(`Survey:${LOT[0]}:survey:SPG`), /Livre : SPG \(langue : Langue-B\)/)
  // La clause de CITATION va à TOUTE phase qui touche au texte du livre : la carto INVENTORIE des
  // intitulés et des tables, l'audit JUGE des tables transcrites, la synthèse et l'augmentation les
  // ÉCRIVENT. Une phase muette sur la langue rendrait un inventaire ou un verdict TRADUIT.
  const citation = [
    `Cartographie:${LOT[0]}:carto:BKA-05`, `Audit:${LOT[0]}:audit#1`,
    `Synthese:${LOT[0]}:synth:topic-un`, `Audit:${LOT[0]}:augment:topic-un`,
  ]
  for (const cle of citation) {
    const p = prompts.get(cle)
    assert.ok(p, `prompt ${cle} absent — labels : ${[...prompts.keys()].join(' · ')}`)
    assert.match(p, /LANGUE DES CITATIONS : .*reste VERBATIM dans la langue de CE livre \(Langue-A, Langue-B selon le livre/)
  }
  // La clause de FICHE ne vaut que là où une SYNTHÈSE s'écrit.
  for (const cle of [`Synthese:${LOT[0]}:synth:topic-un`, `Audit:${LOT[0]}:augment:topic-un`]) {
    assert.match(prompts.get(cle), /LANGUE DE LA FICHE : la SYNTHESE que tu rediges est en FRANCAIS/)
  }
})

test('workflow Atlas : le survey parcourt EXACTEMENT les livres du périmètre reçu, et le rendu PORTE son cœur', async () => {
  const { rendu } = await jouerWorkflow(SCRIPT, PERIMETRE(), repondreAvec(false))
  assert.deepEqual(rendu.domains[0].surveyCounts.map((c) => c.book), ['BKA', 'SPG'])
  assert.equal(rendu.coeur, 'alpha')
  assert.equal(rendu.supplements, true)
})

// UN DOMAINE SAUTÉ EST DIT PAR LE RENDU : un `log` ne se relit pas, et l'assemblage du reste du lot
// doit pouvoir nommer le manquant.
test('workflow Atlas : un domaine SAUTÉ sort dans `sautes`, avec sa RAISON, pour chaque cause', async () => {
  const causes = [
    ['Cadrage', { coverageRefs: [] }, /cadrage VIDE/],
    ['Cartographie', { items: [] }, /inventaire VIDE/],
    ['Taxonomie', { topics: [] }, /taxonomie VIDE/],
  ]
  for (const [phaseMuette, rendu, motif] of causes) {
    const { rendu: r } = await jouerWorkflow(SCRIPT, PERIMETRE(), (p, o) =>
      (o.phase === phaseMuette ? rendu : repondreAvec(false)(p, o)))
    assert.deepEqual(r.domains, [], `le domaine n'aurait pas dû être traité (${phaseMuette})`)
    assert.equal(r.sautes.length, 1, JSON.stringify(r.sautes))
    assert.equal(r.sautes[0].domain, LOT[0])
    assert.match(r.sautes[0].raison, motif)
  }
  // Un run NOMINAL ne saute rien : la clé existe, et elle est vide.
  const { rendu: sain } = await jouerWorkflow(SCRIPT, PERIMETRE(), repondreAvec(false))
  assert.deepEqual(sain.sautes, [])
})

// La consigne de TRANSCRIPTION ne va qu'aux phases qui ÉCRIVENT une table. La carto INVENTORIE :
// lui demander de transcrire n'avait pas d'objet (elle ne rend que des `item`/`ref`/`gist`).
test('workflow Atlas : la consigne de TRANSCRIPTION ne va qu’aux phases qui écrivent une table', async () => {
  const prompts = await promptsDesDeuxRuns()
  const TRANSCRIT = /TRANSCRIPTION DES TABLES : une table se transcrit ligne par ligne/
  for (const cle of [`Audit:${LOT[0]}:audit#1`, `Synthese:${LOT[0]}:synth:topic-un`, `Audit:${LOT[0]}:augment:topic-un`]) {
    assert.match(prompts.get(cle), TRANSCRIT)
  }
  const carto = prompts.get(`Cartographie:${LOT[0]}:carto:BKA-05`)
  assert.equal(TRANSCRIT.test(carto), false, 'la cartographie ne transcrit aucune table')
  assert.match(carto, /LANGUE DES CITATIONS/)
})

// ── REPRISE ───────────────────────────────────────────────────────────────────────────────────────
// Un run coûte des dizaines d'agents : il ne se jette pas parce qu'un agent de vérification est
// resté muet. Le rendu entre, seuls les topics SANS preuve de fidélité repassent, le rendu sort.
const RENDU_A_REPRENDRE = () => ({
  domain: LOT[0],
  title: 'Premier Domaine de Fixture',
  topics: [
    { topicId: 'deja-prouve', title: 'Deja Prouve', markdown: '## Deja Prouve\n\nUn corps.', refs: ['BKA 05 l.1'], codeHint: '', faithful: true, issues: [] },
    { topicId: 'jamais-juge', title: 'Jamais Juge', markdown: '## Jamais Juge\n\nUn corps.', refs: ['BKA 05 l.2'], codeHint: '', faithful: null, issues: [] },
  ],
  autre: [{ topicId: 'autre', ref: 'BKA 05 l.9', gist: 'un gist', book: 'BKA' }],
  inventoryCount: 4,
  auditLoops: 1,
  lastAuditDry: true,
  surveyCounts: [{ book: 'BKA', hits: 2 }, { book: 'SPG', hits: 0 }],
})
const ARGS_DE_REPRISE = (rendu = RENDU_A_REPRENDRE()) => ({ ...PERIMETRE(), reprise: rendu })
/** Les phases de DÉCOUVERTE : aucune ne doit être atteinte par une reprise. */
const DECOUVERTE = ['Cadrage', 'Cartographie', 'Taxonomie', 'Survey', 'Synthese']

test('workflow Atlas : une REPRISE ne lance AUCUN agent de découverte, et ne rejoue pas un topic PROUVÉ', async () => {
  const { rendu, promptsParLabel } = await jouerWorkflow(SCRIPT, ARGS_DE_REPRISE(), (p, o) => {
    assert.equal(o.phase, 'Verif', `phase inattendue en reprise : ${o.phase}`)
    return { topicId: 'jamais-juge', faithful: true, issues: [] }
  })
  const labels = [...promptsParLabel.keys()]
  assert.deepEqual(labels.filter((l) => DECOUVERTE.some((ph) => l.startsWith(`${ph}:`))), [])
  assert.deepEqual(labels.filter((l) => /:audit#/.test(l)), [])
  // Un seul agent : le topic sans verdict. Le topic prouvé fidèle n'est PAS rejoué.
  assert.deepEqual(labels, [`Verif:${LOT[0]}:verif:jamais-juge`])
  // Le rendu COMPLÉTÉ porte les MÊMES clés, et ce que le run avait mesuré est intact.
  const d = rendu.domains[0]
  assert.deepEqual(Object.keys(d).sort(), Object.keys(RENDU_A_REPRENDRE()).sort())
  assert.equal(d.inventoryCount, 4)
  assert.deepEqual(d.surveyCounts, RENDU_A_REPRENDRE().surveyCounts)
  assert.deepEqual(d.topics.map((t) => [t.topicId, t.faithful]), [['deja-prouve', true], ['jamais-juge', true]])
  assert.equal(rendu.coeur, 'alpha')
})

test('workflow Atlas : en REPRISE, une fidélité REFUSÉE ouvre la correction puis la re-vérif', async () => {
  let verifs = 0
  const { rendu, promptsParLabel } = await jouerWorkflow(SCRIPT, ARGS_DE_REPRISE(), (prompt, o) => {
    if (o.phase === 'Audit') return { topicId: 'jamais-juge', title: 'Jamais Juge', markdown: '## Jamais Juge\n\nCorrige.', refs: ['BKA 05 l.2'], codeHint: '' }
    verifs += 1
    return { topicId: 'jamais-juge', faithful: verifs > 1, issues: verifs > 1 ? [] : ['une valeur fausse'] }
  })
  const labels = [...promptsParLabel.keys()]
  assert.ok(labels.includes(`Audit:${LOT[0]}:augment:jamais-juge`), `augmentation absente — ${labels.join(' · ')}`)
  assert.ok(labels.includes(`Verif:${LOT[0]}:reverif:jamais-juge`))
  const t = rendu.domains[0].topics.find((x) => x.topicId === 'jamais-juge')
  assert.equal(t.faithful, true)
  assert.match(t.markdown, /Corrige\./)
})

// Le verdict se keye sur l'ENTRÉE JUGÉE. Avec la clé de la RÉPONSE, un agent qui rebaptise son topic
// inscrivait un fantôme : le topic réel restait `faithful:null`, et `assemble` refusait la fiche.
test('workflow Atlas : un agent de vérif qui rend un AUTRE `topicId` ne keye plus de fantôme', async () => {
  const { rendu } = await jouerWorkflow(SCRIPT, ARGS_DE_REPRISE(), () =>
    ({ topicId: 'un-id-que-personne-n-a-demande', faithful: true, issues: [] }))
  const topics = rendu.domains[0].topics
  assert.deepEqual(topics.map((t) => t.topicId), ['deja-prouve', 'jamais-juge'])
  assert.equal(topics.find((t) => t.topicId === 'jamais-juge').faithful, true)
})

// UNE RE-VÉRIF MUETTE NE DÉTRUIT PLUS UN VERDICT. Un topic entré `faithful:false` avec ses `issues`
// en ressortait `faithful:null` sans issue dès que l'agent ne rendait rien : le verdict établi était
// effacé, et plus rien ne disait comment corriger. Ce que personne n'a jugé reste `null` ; ce qu'un
// juge a refusé reste refusé, avec ses points.
test('workflow Atlas : en REPRISE, un agent MUET laisse le verdict antérieur INTACT', async () => {
  const rendu = RENDU_A_REPRENDRE()
  rendu.topics.push({ topicId: 'juge-refuse', title: 'Juge Refuse', markdown: '## Juge Refuse\n\nUn corps.', refs: ['BKA 05 l.3'], codeHint: '', faithful: false, issues: ['une valeur fausse'] })
  const { rendu: sorti } = await jouerWorkflow(SCRIPT, { ...PERIMETRE(), reprise: rendu }, () => { throw new Error('agent mort') })
  const topics = sorti.domains[0].topics
  const refuse = topics.find((t) => t.topicId === 'juge-refuse')
  assert.equal(refuse.faithful, false, 'le refus antérieur a été effacé par une re-vérif muette')
  assert.deepEqual(refuse.issues, ['une valeur fausse'])
  assert.match(refuse.markdown, /Un corps\./)
  // Le topic JAMAIS jugé reste sans verdict : on n'en invente pas un.
  assert.equal(topics.find((t) => t.topicId === 'jamais-juge').faithful, null)
  assert.equal(topics.find((t) => t.topicId === 'deja-prouve').faithful, true)
})

test('workflow Atlas : un `args.reprise` mal formé LÈVE en nommant la cause', async () => {
  const cas = [
    [{ ...PERIMETRE(), reprise: [] }, /`args\.reprise` non-objet/],
    [{ ...PERIMETRE(), reprise: { topics: [{}] } }, /`args\.reprise\.domain` absent ou non textuel/],
    [{ ...PERIMETRE(), reprise: { domain: LOT[0] } }, /`args\.reprise\.topics` absent ou vide/],
    [{ ...PERIMETRE(), lot: ['domaine-deux'], reprise: RENDU_A_REPRENDRE() }, /une reprise ne joue QUE le domaine de son rendu/],
  ]
  for (const [argsDuRun, motif] of cas) {
    await assert.rejects(() => jouerWorkflow(SCRIPT, argsDuRun, repondreAvec(false)), motif, JSON.stringify(argsDuRun.reprise))
  }
})

// BOUT EN BOUT — c'est le chemin qu'on emprunte quand un agent de vérification est resté muet :
// run → fichier → `--reprise` → workflow → fichier → `assemble`. Chaque maillon était testé seul ;
// aucun ne prouvait que le rendu de l'un ENTRE dans le suivant sans retaille à la main.
test('reprise de BOUT EN BOUT : rendu du run → lireRendu → workflow → assemble (Atlas jetable)', async () => {
  const dossier = mkdtempSync(join(tmpdir(), 'atlas-bout-en-bout-'))
  try {
    // 1. Un run dont la vérification reste MUETTE : les topics sortent sans preuve de fidélité.
    const { rendu: duRun } = await jouerWorkflow(SCRIPT, PERIMETRE(), (p, o) => {
      if (o.phase === 'Verif') return null
      return repondreAvec(false)(p, o)
    })
    assert.deepEqual(duRun.domains[0].topics.map((t) => t.faithful), [null])
    const cheminDuRun = join(dossier, 'run.json')
    writeFileSync(cheminDuRun, JSON.stringify(duRun), 'utf8')
    // `assemble` refuse ce rendu-là : c'est bien lui qu'il faut reprendre.
    assert.throws(() => assemble(duRun.domains[0], { racine: duRun, source: cheminDuRun, rawDir: dossier }), /JAMAIS verifie/)

    // 2. La REPRISE : le rendu du RUN entre tel quel, le domaine est celui que `--domaines` nomme.
    const reprise = lireRendu(cheminDuRun, LOT[0])
    const argsDeReprise = perimetreDeCoeur('alpha', {
      supplements: true, lot: LOT, registre: REGISTRE_FIXTURE, registreDomaines: DOMAINES_FIXTURE, reprise,
    })
    const { rendu: apres, promptsParLabel } = await jouerWorkflow(SCRIPT, argsDeReprise, (p, o) => {
      assert.equal(o.phase, 'Verif', `phase de découverte rejouée en reprise : ${o.phase}`)
      return { topicId: 'topic-un', faithful: true, issues: [] }
    })
    assert.deepEqual([...promptsParLabel.keys()], [`Verif:${LOT[0]}:verif:topic-un`])
    assert.deepEqual(apres.domains[0].topics.map((t) => t.faithful), [true])

    // 3. L'ASSEMBLAGE du rendu complété, dans un Atlas JETABLE.
    const cheminApres = join(dossier, 'apres.json')
    writeFileSync(cheminApres, JSON.stringify(apres), 'utf8')
    const relu = JSON.parse(readFileSync(cheminApres, 'utf8'))
    const r = assemble(relu.domains[0], { racine: relu, source: cheminApres, rawDir: join(dossier, 'atlas') })
    assert.equal(existsSync(r.path), true, r.path)
    assert.match(readFileSync(r.path, 'utf8'), /## Topic Un/)
  } finally {
    rmSync(dossier, { recursive: true, force: true })
  }
})

test('workflow Atlas : un `args` absent ou mal formé LÈVE en nommant la cause', async () => {
  const { livres, domaines } = PERIMETRE()
  const cas = [
    [undefined, /`args` absent ou non-objet/],
    [{ livres }, /`args\.coeur` absent ou non textuel/],
    [{ coeur: 'alpha' }, /`args\.livres` absent ou vide/],
    [{ coeur: 'alpha', livres: [{ ab: 'BKA', dir: 'Source/Fixture - Base Alpha' }] }, /sans `language`/],
    [{ coeur: 'alpha', livres: livres.filter((l) => !l.coeur) }, /aucun livre de coeur « alpha »/],
    [{ coeur: 'alpha', livres }, /`args\.domaines` absent ou vide/],
    [{ coeur: 'alpha', livres, domaines: [{ cle: 'domaine-un' }] }, /`args\.domaines` sans `titre`/],
    [{ coeur: 'alpha', livres, domaines }, /`args\.lot` absent ou vide/],
    [{ coeur: 'alpha', livres, domaines, lot: ['domaine-jamais-declare'] }, /« domaine-jamais-declare » du lot inconnu/],
  ]
  for (const [argsDuRun, motif] of cas) {
    await assert.rejects(() => jouerWorkflow(SCRIPT, argsDuRun, repondreAvec(false)), motif, `args = ${JSON.stringify(argsDuRun)}`)
  }
})
