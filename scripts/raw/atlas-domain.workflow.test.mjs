// GARDE DE FORME du workflow d'extraction de fiches d'Atlas (#1825 lot E).
//
// L'invariant : le script ne NOMME aucun livre — ni sigle, ni titre, ni dossier, ni édition, ni
// cardinal de livres/chapitres —, ni dans son code, ni dans un PROMPT. Le périmètre (cœur de règles,
// livres, dossiers, LANGUES) lui ENTRE par le global `args`, projeté de `src/data/books.json` par
// `perimetreDeCoeur` (`workflow-args.mjs`).
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
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { REGISTRE_LIVRES } from './_lib.mjs'
import { perimetreDeCoeur } from './workflow-args.mjs'
import { coeursDuRegistre } from './_lib.mjs'
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
const PERIMETRE = () => perimetreDeCoeur('alpha', { supplements: true, registre: REGISTRE_FIXTURE })

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

/** Toute identité du registre RÉEL : sigles, libellés, dossiers, cœurs, langues. */
const identitesReelles = () => [
  ...REGISTRE_LIVRES.flatMap((b) => [b.abbr, b.label, b.dir].filter(Boolean)),
  ...coeursDuRegistre(REGISTRE_LIVRES),
  ...new Set(REGISTRE_LIVRES.map((b) => b.language).filter(Boolean)),
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

test('workflow Atlas : aucun CARDINAL de livres ou de chapitres dans un prompt', async () => {
  const prompts = await promptsDesDeuxRuns()
  const fuites = []
  for (const [cle, prompt] of prompts)
    for (const v of scanForbiddenCounts(prompt)) fuites.push(`${cle}:${v.line} « ${v.excerpt} » — ${v.reason}`)
  assert.deepEqual(fuites, [], `cardinaux écrits en dur dans un prompt :\n${fuites.join('\n')}`)
})

test('workflow Atlas : le livre de RÉFÉRENCE est le livre de cœur du périmètre reçu', async () => {
  const prompts = await promptsDesDeuxRuns()
  const cadrage = prompts.get('Cadrage:traumatisme:cadrage')
  assert.ok(cadrage, `prompt de cadrage absent — labels : ${[...prompts.keys()].join(' · ')}`)
  assert.match(cadrage, /Source\/Fixture - Base Alpha\/00 - Index\.md/)
  assert.match(cadrage, /livre de REFERENCE du perimetre, BKA/)
  assert.match(cadrage, /coeur de regles « alpha »/)
  // Le livre de l'AUTRE cœur n'est pas du périmètre : il n'est cité nulle part.
  assert.equal([...prompts.values()].some((p) => /\bBKB\b/.test(p)), false)
})

test('workflow Atlas : la consigne de CITATION suit la langue du livre cité', async () => {
  const prompts = await promptsDesDeuxRuns()
  assert.match(prompts.get('Survey:traumatisme:survey:BKA'), /Livre : BKA \(langue : Langue-A\)/)
  assert.match(prompts.get('Survey:traumatisme:survey:SPG'), /Livre : SPG \(langue : Langue-B\)/)
  for (const cle of ['Synthese:traumatisme:synth:topic-un', 'Audit:traumatisme:augment:topic-un']) {
    const p = prompts.get(cle)
    assert.ok(p, `prompt ${cle} absent — labels : ${[...prompts.keys()].join(' · ')}`)
    assert.match(p, /LANGUE DE LA FICHE : la SYNTHESE que tu rediges est en FRANCAIS/)
    assert.match(p, /LANGUE DES CITATIONS : .*reste VERBATIM dans la langue de CE livre \(Langue-A, Langue-B selon le livre/)
  }
})

test('workflow Atlas : le survey parcourt EXACTEMENT les livres du périmètre reçu, et le rendu PORTE son cœur', async () => {
  const { rendu } = await jouerWorkflow(SCRIPT, PERIMETRE(), repondreAvec(false))
  assert.deepEqual(rendu.domains[0].surveyCounts.map((c) => c.book), ['BKA', 'SPG'])
  assert.equal(rendu.coeur, 'alpha')
  assert.equal(rendu.supplements, true)
})

test('workflow Atlas : un `args` absent ou mal formé LÈVE en nommant la cause', async () => {
  const { livres } = PERIMETRE()
  const cas = [
    [undefined, /`args` absent ou non-objet/],
    [{ livres }, /`args\.coeur` absent ou non textuel/],
    [{ coeur: 'alpha' }, /`args\.livres` absent ou vide/],
    [{ coeur: 'alpha', livres: [{ ab: 'BKA', dir: 'Source/Fixture - Base Alpha' }] }, /sans `language`/],
    [{ coeur: 'alpha', livres: livres.filter((l) => !l.coeur) }, /aucun livre de coeur « alpha »/],
  ]
  for (const [argsDuRun, motif] of cas) {
    await assert.rejects(() => jouerWorkflow(SCRIPT, argsDuRun, repondreAvec(false)), motif, `args = ${JSON.stringify(argsDuRun)}`)
  }
})
