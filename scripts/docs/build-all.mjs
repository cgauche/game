// scripts/docs/build-all.mjs — régénère TOUS les docs dérivés (`npm run docs:build`).
// SOURCE UNIQUE de la liste des générateurs : `GENERATORS`. `npm run docs:check` chaîne les MÊMES
// scripts en `--check` (plus des vérificateurs purs, qui n'écrivent rien) ; la garde
// scripts/git-hooks/merge-docs.test.mjs refuse toute dérive entre les deux listes.
// Ordre motivé : les rapports d'Atlas LISENT les fiches docs/raw (coverage.mjs:309, reconcile.mjs:54,
// reanchor.mjs:207), ils passent donc APRÈS build-catalogs/build-implemente qui les écrivent.
import { execFileSync } from 'node:child_process'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

/** `{ runner, script, targets, check }` — `runner` = 'node' | 'tsx' ; `targets` = docs ÉCRITS
 *  (glob toléré, cf. la garde de taxonomie de scripts/git-hooks/merge-docs.test.mjs) ;
 *  `check: false` = pas de mode `--check` (le script écrit toujours), donc sauté par `--check`.
 *  Ordre = ordre d'exécution. */
export const GENERATORS = [
  { runner: 'node', script: 'scripts/raw/build-catalogs.mjs', targets: ['docs/raw/catalogue-*.md'], check: false },
  { runner: 'node', script: 'scripts/raw/build-implemente.mjs', targets: [] },
  { runner: 'node', script: 'scripts/docs/build-systemes.mjs', targets: ['docs/systemes.md'] },
  { runner: 'node', script: 'scripts/docs/build-donnees.mjs', targets: ['docs/donnees.md'] },
  { runner: 'node', script: 'scripts/docs/build-sources-vf.mjs', targets: ['docs/sources-vf.md'] },
  { runner: 'node', script: 'scripts/docs/build-effects.mjs', targets: ['docs/campagne-effects.md'] },
  { runner: 'node', script: 'scripts/docs/build-vocabulaire.mjs', targets: ['docs/vocabulaire-mecanique.md'] },
  { runner: 'node', script: 'scripts/docs/build-index-moteur.mjs', targets: ['docs/index-moteur.md'] },
  { runner: 'node', script: 'scripts/docs/build-registre-jets.mjs', targets: ['docs/registre-jets.md'] },
  { runner: 'node', script: 'scripts/docs/build-usages-jets.mjs', targets: ['docs/usages-jets.md'] },
  { runner: 'node', script: 'scripts/docs/build-entity-orphans.mjs', targets: ['docs/orphelines-donnees.md'] },
  { runner: 'node', script: 'scripts/docs/build-test-scenarios.mjs', targets: ['docs/test-scenarios.md'] },
  { runner: 'node', script: 'scripts/docs/build-reprise.mjs', targets: ['docs/reprise-apres-pause.md'] },
  { runner: 'node', script: 'scripts/docs/build-icones.mjs', targets: ['docs/ajouter-une-icone.md'] },
  { runner: 'node', script: 'scripts/docs/build-codex-relations.mjs', targets: ['docs/codex-relations.md'] },
  { runner: 'node', script: 'scripts/docs/build-map-authoring.mjs', targets: ['docs/map-authoring.md'] },
  { runner: 'node', script: 'scripts/docs/build-passifs.mjs', targets: ['docs/systeme-passifs.md'] },
  { runner: 'node', script: 'scripts/docs/build-rendu-pipeline.mjs', targets: ['docs/rendu-pipeline.md'] },
  { runner: 'node', script: 'scripts/docs/build-flux-de-jet.mjs', targets: ['docs/ajouter-un-flux-de-jet.md'] },
  { runner: 'node', script: 'scripts/docs/build-mecanique.mjs', targets: ['docs/ajouter-une-mecanique.md'] },
  { runner: 'node', script: 'scripts/docs/build-sort.mjs', targets: ['docs/ajouter-un-sort.md'] },
  { runner: 'node', script: 'scripts/docs/build-ajouter-donnee.mjs', targets: ['docs/ajouter-une-donnee.md'] },
  { runner: 'tsx', script: 'scripts/gen-sorts-doc.mts', targets: ['docs/sorts-implementation.md'] },
  { runner: 'tsx', script: 'scripts/docs/build-field-consumers.mts', targets: ['docs/consommateurs-de-champs.md'] },
  { runner: 'tsx', script: 'scripts/docs/build-structures.mts', targets: ['docs/structures-donnees.md'] },
  // Rapports 100 % dérivés de l'Atlas : le .md est écrit AVANT la porte de régression (reanchor.mjs
  // l.343 puis l.354+), donc `docs:build` régénère le fichier ET laisse remonter l'exit 1.
  { runner: 'node', script: 'scripts/raw/coverage.mjs', targets: ['docs/raw/coverage.md'], check: false },
  { runner: 'node', script: 'scripts/raw/reconcile.mjs', targets: ['docs/raw/reconciliation.md'], check: false },
  { runner: 'node', script: 'scripts/raw/reanchor.mjs', targets: ['docs/raw/reanchor.md'], check: false },
]

/** Étapes de `docs:check` qui ne GÉNÈRENT rien (vérificateurs purs, sans `--check`) — déclarées
 *  ici pour que la chaîne npm reste dérivable d'UNE source. */
export const NON_GENERATOR_CHECKS = [
  'scripts/docs/check-doc-refs.mjs',
  'scripts/docs/check-plans-anchors.mjs',
  'scripts/raw/check-atlas-counts.mjs',
  'scripts/data/check-progression-schemas.mjs',
]

/** Scripts que `docs:check` passe en `--check` (source unique : ceux qui SAVENT vérifier). */
export const checkedScripts = () => new Set(GENERATORS.filter((g) => g.check !== false).map((g) => g.script))

function run({ runner, script }, { cwd, quiet, check }) {
  const cmd = runner === 'tsx' ? 'npx' : process.execPath
  const args = [...(runner === 'tsx' ? ['tsx', script] : [script]), ...(check ? ['--check'] : [])]
  execFileSync(cmd, args, { cwd, stdio: quiet ? ['ignore', 'ignore', 'pipe'] : 'inherit', shell: runner === 'tsx' && process.platform === 'win32' })
}

function main() {
  const quiet = process.argv.includes('--quiet')
  const check = process.argv.includes('--check')
  const cwd = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim()
  // Fail-fast : un générateur rouge laisse docs/ à moitié régénéré ; enchaîner les suivants
  // fabriquerait un lot incohérent que le hook annoncerait « à committer ».
  for (const g of GENERATORS) {
    if (check && g.check === false) continue
    try {
      run(g, { cwd, quiet, check })
    } catch (e) {
      process.stderr.write(`docs:build — ARRÊT sur ${g.script} (code ${e.status ?? e.message}) : docs/ n'est PAS à jour.\n`)
      process.exit(1)
    }
  }
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isMain) main()
