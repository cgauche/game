// Importer `scripts/gen-registry.mjs` ne lance pas la génération : seul le point d'entrée du processus
// (`node scripts/gen-registry.mjs`, `npm run gen`) la déclenche (#1897). Une seule règle de lecture d'un
// littéral (`champsLitteraux`) pour l'union d'ids et la projection.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

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

test("idUnion : un id en guillemets doubles entre dans l'union ; un id calculé lève en nommant le def", async () => {
  const { unionDesIds } = await import(MODULE)
  const dir = mkdtempSync(join(tmpdir(), 'gen-registry-union-'))
  try {
    writeFileSync(join(dir, 'a.ts'), "export const icons = [\n  { \n    id: 'simple',\n  },\n  {\n    id: \"double\",\n  },\n];\n")
    assert.deepEqual(unionDesIds(dir, ['a.ts'], 'id'), ['double', 'simple'])
    writeFileSync(join(dir, 'b.ts'), "export const icons = [\n  {\n    id: 'fixe',\n  },\n  { id: slug(label) },\n];\n")
    assert.throws(() => unionDesIds(dir, ['a.ts', 'b.ts'], 'id'), /b\.ts : 1 champ\(s\) « id » non littéral\(aux\)/)
    writeFileSync(join(dir, 'c.ts'), 'export const icons = [];\n')
    assert.throws(() => unionDesIds(dir, ['c.ts'], 'id'), /c\.ts : 0 champ\(s\) « id » littéral\(aux\)/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})
