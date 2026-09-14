#!/usr/bin/env node
// LANCEUR DES TESTS `node --test` D'UNE GATE (#1759) :
//   node scripts/test/node-tests.mjs <gate> [drapeaux de `node --test`…]
// Les arguments supplémentaires vont à `node --test` AVANT les fichiers (`--test-name-pattern=…`,
// `--test-concurrency=…`…) : un lanceur qui les avalerait rendrait le filtrage d'un cas impossible.
//
// La liste des fichiers vient de `scripts/gates/testsParGate.mjs` — la table qui répartit les tests
// `scripts/**` par RÉPERTOIRE — et de nulle part ailleurs : ni d'un nom recopié dans `package.json`,
// ni d'un glob que le shell expanserait différemment selon la plateforme. Un seul chemin de code,
// donc une seule vérité sur « quels tests joue cette gate ».
//
// Et la couverture se juge AVANT de lancer : un test orphelin (aucune racine) ou revendiqué par deux
// gates ne doit pas être découvert APRÈS coup, par un vert qui ne prouve rien.
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { GATES, RACINES, couverture, listerTests, testsDe } from '../gates/testsParGate.mjs'
import { codeEnfant } from './partition.mjs'

const RACINE = fileURLToPath(new URL('../..', import.meta.url))

const gate = process.argv[2]
const drapeaux = process.argv.slice(3)
if (!gate || !GATES.includes(gate)) {
  console.error(
    '[tests] usage : node scripts/test/node-tests.mjs <gate> [drapeaux de `node --test`…] — ' +
      `gates connues : ${GATES.join(', ')}${gate ? ` (reçu « ${gate} »)` : ''}`,
  )
  process.exit(2)
}

const lister = () => listerTests(RACINE)
const { orphelins, doublons } = couverture(lister)
if (orphelins.length || doublons.length) {
  console.error(
    `[tests] répartition incomplète — rien n'est lancé.\n` +
      orphelins.map((t) => `  orphelin (aucune gate ne le joue) : ${t}`).join('\n') +
      (orphelins.length && doublons.length ? '\n' : '') +
      doublons.map((d) => `  doublon (${d.gates.join(' + ')}) : ${d.test}`).join('\n') +
      '\n  remède : donne son répertoire à UNE gate dans scripts/gates/testsParGate.mjs',
  )
  process.exit(2)
}

const tests = testsDe(gate, lister)
if (!tests.length) {
  console.error(`[tests] ${gate} : aucun test sous ses racines (${RACINES[gate].join(', ')}) — table ou arbre à revoir`)
  process.exit(2)
}

const { status, signal } = spawnSync(process.execPath, ['--test', ...drapeaux, ...tests], {
  cwd: RACINE,
  stdio: 'inherit',
})
process.exit(codeEnfant(status, signal))
