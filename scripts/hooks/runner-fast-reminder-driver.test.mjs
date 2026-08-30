// Tests du DRIVER de `runner-fast-reminder` (payloads de hook réels sur stdin) : le rappel doit
// distinguer un APPEL de `tsc` d'une commande qui MENTIONNE le motif — une recherche de texte
// (`grep -rn "tsc --noEmit" docs/`) déclenchait le rappel, mesuré en vif 2026-08-30 (#1591).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const HOOK = join(REPO, 'scripts', 'hooks', 'runner-fast-reminder.mjs')

/** `true` si le hook émet son rappel pour cette commande. */
function rappelle(command) {
  const payload = JSON.stringify({
    session_id: 'test',
    hook_event_name: 'PreToolUse',
    tool_name: 'Bash',
    tool_input: { command },
  })
  const run = spawnSync(process.execPath, [HOOK], { input: payload, encoding: 'utf8', cwd: REPO })
  assert.equal(run.status, 0, `le hook a quitté en ${run.status} : ${run.stderr}`)
  return run.stdout.trim() !== ''
}

const APPELS = [
  'tsc --noEmit',
  'npx tsc --noEmit',
  'node_modules/typescript/bin/tsc --noEmit',
  'tsc.cmd --noEmit',
  'npm run lint && tsc --noEmit',
  'cd sous-dossier; tsc --noEmit',
]

const NON_APPELS = [
  'grep -rn "tsc --noEmit" docs/',
  'rg "tsc --noEmit" docs/',
  'Select-String -Pattern "tsc --noEmit" CLAUDE.md',
  'echo "tsc --noEmit"',
  'node scripts/tsc-tools/x.mjs --noEmit',
  'npm run typecheck:fast',
  'npm run typecheck',
  'npx vitest run src/state',
]

for (const commande of APPELS) {
  test(`RAPPEL sur un appel réel : ${commande}`, () => {
    assert.ok(rappelle(commande), `aucun rappel sur « ${commande} » — un tsc nu passe inaperçu`)
  })
}

for (const commande of NON_APPELS) {
  test(`SILENCE sur : ${commande}`, () => {
    assert.ok(!rappelle(commande), `rappel parasite sur « ${commande} »`)
  })
}
