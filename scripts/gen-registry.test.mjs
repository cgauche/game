// Importer `scripts/gen-registry.mjs` ne lance pas la génération : seul le point d'entrée du processus
// (`node scripts/gen-registry.mjs`, `npm run gen`) la déclenche (#1897).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { fileURLToPath, pathToFileURL } from 'node:url'

const RACINE = fileURLToPath(new URL('..', import.meta.url))
const MODULE = pathToFileURL(fileURLToPath(new URL('./gen-registry.mjs', import.meta.url))).href

test("un import depuis la racine du dépôt ne lance pas genAll", () => {
  const r = spawnSync(process.execPath, ['--input-type=module', '-e', `await import(${JSON.stringify(MODULE)})`], {
    cwd: RACINE,
    encoding: 'utf8',
  })
  assert.equal(r.status, 0, r.stderr)
  assert.doesNotMatch(r.stdout, /gen-registry:/)
})
