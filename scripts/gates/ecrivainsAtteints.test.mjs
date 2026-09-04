// CLIQUET : la table ÉCRIT/LU de `npm run gates` confrontée à la SOURCE (#1679 L2 T1d).
//   node --test scripts/gates/ecrivainsAtteints.test.mjs   (chaîné dans `npm run test:hooks`)
//
// `ECRIT_LU` (scripts/gates/toutes.mjs) est ce qui autorise deux gates à tourner EN MÊME TEMPS. Elle
// est MESURÉE, donc elle se démode : une gate qui se met à atteindre un module capable d'écrire est
// une gate dont il faut RE-mesurer `ecrit`. Ce cliquet fige la liste, par gate, des scripts atteints
// qui portent un appel d'écriture — un ajout ARRÊTE la CI en nommant la gate et le module.
//
// Le cas fondateur : `test:hooks` mutait `scripts/hooks/ecrans-ui.json`, un fichier COMMITTÉ
// (`new-src-file-guard.test.mjs`), sans que la table le dise ; le 2026-09-04 son `finally` de remise
// à l'octet a échoué sous charge et l'arbre est resté sale.
//
// GRAIN : le SCRIPT, pas la ligne — la limite est écrite dans `ecrivainsAtteints.mjs`. Baisser une
// entrée est libre ; en ajouter une exige de dire ce que la gate écrit.
import test from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { ecrivainsParGate } from './ecrivainsAtteints.mjs'
import { ECRIT_LU } from './toutes.mjs'

const RACINE = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim()

/** Scripts ÉCRIVAINS atteints par chaque gate — mesuré le 2026-09-04, stock à faire DÉCROÎTRE. */
const ATTENDU = {
  'agents:check': ['scripts/agents/compat-cli.mjs'],
  'test:agents': ['scripts/agents/compat-cli.mjs'],
  'test:hooks': [
    'scripts/docs/build-all.mjs',
    'scripts/docs/lib/empreinte-sources.mjs',
    'scripts/docs/lib/enregistreur-lectures.test.mjs',
    'scripts/gates/toutes.mjs',
    'scripts/gates/toutes.test.mjs',
    'scripts/git-hooks/arbre-imbrique.test.mjs',
    'scripts/git-hooks/merge-docs.mjs',
    'scripts/git-hooks/merge-docs.test.mjs',
    'scripts/git-hooks/pre-push.mjs',
    'scripts/git-hooks/pre-push.test.mjs',
    'scripts/guards/lib/enteteArbre.test.mjs',
    'scripts/guards/lib/importGraph.test.mjs',
    'scripts/guards/lib/justificatif.mjs',
    'scripts/guards/lib/justificatif.test.mjs',
    'scripts/guards/lib/lintStage.test.mjs',
    'scripts/guards/lib/plageStock.test.mjs',
    'scripts/guards/lib/portePush.test.mjs',
    'scripts/hooks/git-destructive-guard.test.mjs',
    'scripts/hooks/inject-project-credo.test.mjs',
    'scripts/hooks/new-src-file-guard.mjs',
    'scripts/hooks/new-src-file-guard.test.mjs',
    'scripts/hooks/segments-profonds.test.mjs',
    'scripts/hooks/solde-ticket-guard-driver.test.mjs',
    'scripts/hooks/solde-ticket-guard.mjs',
    'scripts/hooks/solde-ticket-guard.test.mjs',
    'scripts/hooks/typecheck-fast-wrapper.test.mjs',
    'scripts/migrations/lib/empreinteRejeu.test.mjs',
    'scripts/migrations/lib/idempotence-ordre-des-cles.test.mjs',
    'scripts/migrations/replay-head.mjs',
    'scripts/raw/build-implemente.mjs',
    'scripts/test/verrou.mjs',
  ],
  'test:ops': ['scripts/ops/knip-exports-ratchet.mjs'],
  'test:runner': [
    'scripts/lancer-local.test.mjs',
    'scripts/test/run-capture.test.mjs',
    'scripts/test/run-isolation.test.mjs',
    'scripts/test/verrou.mjs',
  ],
  'test:docs': [
    'scripts/docs/build-all-check.test.mjs',
    'scripts/docs/build-all.mjs',
    'scripts/docs/check-plans-anchors.test.mjs',
    'scripts/docs/lib/empreinte-sources.mjs',
  ],
  'deps:unused': [],
  'test:recette': ['scripts/recette/lib.mjs'],
  typecheck: [],
  lint: [],
  test: ['scripts/guards/lib/justificatif.mjs', 'scripts/test/run.mjs', 'scripts/test/verrou.mjs'],
  build: [],
  'docs:check': ['scripts/docs/build-all.mjs', 'scripts/docs/lib/empreinte-sources.mjs'],
  'docs:empreinte': ['scripts/docs/build-all.mjs', 'scripts/docs/lib/empreinte-sources.mjs'],
  'raw:coverage': ['scripts/docs/lib/empreinte-sources.mjs'],
  'raw:reconcile': ['scripts/docs/lib/empreinte-sources.mjs', 'scripts/raw/build-implemente.mjs'],
  'test:raw': [
    'scripts/docs/lib/empreinte-sources.mjs',
    'scripts/raw/anchor-fill.mjs',
    'scripts/raw/build-implemente.mjs',
    'scripts/raw/build-implemente.test.mjs',
    'scripts/raw/check-code-refs.test.mjs',
    'scripts/raw/check-entity-in-chapter.test.mjs',
    'scripts/raw/check-folio-continuity.test.mjs',
    'scripts/raw/check-refs.test.mjs',
    'scripts/raw/citation-graphy-guard.test.mjs',
    'scripts/raw/folio-bootstrap.mjs',
    'scripts/raw/folio-bootstrap.test.mjs',
    'scripts/raw/reanchor-split.mjs',
    'scripts/raw/reanchor.mjs',
    'scripts/raw/reanchor.test.mjs',
    'scripts/raw/reconcile.test.mjs',
  ],
  'raw:check-refs': [],
  'raw:check-code-refs': [],
  'raw:check-folio-continuity': [],
  'raw:reanchor': ['scripts/docs/lib/empreinte-sources.mjs', 'scripts/raw/reanchor.mjs'],
  'server:typecheck': [],
}

test('aucune gate n’acquiert un module ÉCRIVAIN sans que ÉCRIT/LU soit re-mesurée', () => {
  const mesure = ecrivainsParGate(RACINE)
  assert.deepEqual(Object.keys(mesure).sort(), Object.keys(ATTENDU).sort(), 'les gates de ci.yml ont changé')
  for (const [gate, scripts] of Object.entries(mesure)) {
    const neufs = scripts.filter((s) => !ATTENDU[gate].includes(s))
    assert.deepEqual(
      neufs,
      [],
      `« ${gate} » atteint ${neufs.length} module(s) écrivain(s) de plus : mesure ce qu'ils écrivent DANS L'ARBRE, ` +
        `déclare-le dans ECRIT_LU (scripts/gates/toutes.mjs) — ecrit, ou ecritFerme avec sa porte — puis inscris-les ici.`,
    )
  }
})

test('la sonde n’est pas AVEUGLE : elle voit les écrivains connus, et ignore les lecteurs purs', () => {
  const mesure = ecrivainsParGate(RACINE)
  // Trois vérités indépendantes, chacune vérifiable à la main.
  assert.ok(
    mesure['raw:coverage'].includes('scripts/docs/lib/empreinte-sources.mjs'),
    '`ecrireDoc` est le seam par lequel raw:coverage écrit docs/raw/coverage.md',
  )
  assert.ok(
    mesure['test:hooks'].includes('scripts/hooks/new-src-file-guard.test.mjs'),
    'le cas fondateur (un test qui mute un fichier committé) doit rester visible',
  )
  assert.deepEqual(mesure.typecheck, [], '`tsc --noEmit` n’atteint aucun module écrivain')
  assert.deepEqual(mesure.lint, [], '`eslint` sans `--fix` n’atteint aucun module écrivain')
})

test('toute gate qui atteint un écrivain a une entrée ÉCRIT/LU qui en parle', () => {
  for (const [gate, scripts] of Object.entries(ecrivainsParGate(RACINE))) {
    if (!scripts.length) continue
    const e = ECRIT_LU[gate]
    assert.ok(e, `${gate} : aucune entrée ÉCRIT/LU`)
    const declare = [...e.ecrit, ...Object.keys(e.ecritFerme ?? {})]
    assert.ok(
      declare.length || e.raison.length > 20,
      `${gate} atteint ${scripts.length} module(s) écrivain(s) et ne déclare NI écriture NI raison de n'en pas avoir`,
    )
  }
})
