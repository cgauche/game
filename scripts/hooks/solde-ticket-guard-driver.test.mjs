// Tests du DRIVER de `solde-ticket-guard` (le bloc `isMain`, non importable : il se teste en
// lançant le script réel avec un payload de hook sur stdin). Lancé par `npm run test:hooks`.
//
// Le driver est la couture où le message de commit est REJOINT à son répertoire d'exécution : un
// message packé dans un fichier (`-F`) doit être lu là où le `git commit` s'exécute, sinon une
// fermeture de ticket devient invisible au contrôle de solde (fail-open mesuré 2026-08-03, #1052).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const GUARD = join(REPO, 'scripts', 'hooks', 'solde-ticket-guard.mjs')

/** Décision rendue par le driver pour un payload `ctx_shell` donné (`null` si le hook se tait). */
function decisionOf(command, cwd) {
  const payload = JSON.stringify({
    session_id: 'test', hook_event_name: 'PreToolUse',
    tool_name: 'mcp__lean-ctx__ctx_shell', tool_input: { command, cwd },
  })
  const run = spawnSync(process.execPath, [GUARD], { input: payload, encoding: 'utf8', cwd: REPO })
  assert.equal(run.status, 0, `le hook a quitté en ${run.status} : ${run.stderr}`)
  if (!run.stdout.trim()) return null
  const { permissionDecision, permissionDecisionReason } = JSON.parse(run.stdout).hookSpecificOutput
  return { decision: permissionDecision, reason: permissionDecisionReason }
}

test('DRIVER : un message -F est lu dans le répertoire où le commit S\'EXÉCUTE (cd/worktree)', () => {
  const base = mkdtempSync(join(tmpdir(), 'solde-guard-'))
  try {
    mkdirSync(join(base, 'wt'))
    // Homonyme ANODIN à la racine : c'est lui qu'un driver résolvant contre le cwd de départ
    // lirait — la fermeture portée par le vrai fichier resterait alors invisible.
    writeFileSync(join(base, 'm2.txt'), 'chore: rien a signaler\n', 'utf8')
    writeFileSync(join(base, 'wt', 'm2.txt'), 'feat: bidule (corrige #999999)\n', 'utf8')

    const out = decisionOf('cd wt && git commit -F m2.txt', base)
    assert.ok(out, 'aucune décision : la fermeture #999999 portée par wt/m2.txt est passée inaperçue')
    assert.equal(out.decision, 'deny')
    assert.match(out.reason, /999999|PALIER|Palier/)
  } finally {
    rmSync(base, { recursive: true, force: true })
  }
})

test('DRIVER : un -F introuvable est fail-CLOSED (jamais un silence)', () => {
  const base = mkdtempSync(join(tmpdir(), 'solde-guard-'))
  try {
    const out = decisionOf('git commit -F absent.txt', base)
    assert.ok(out, 'aucune décision sur un -F illisible')
    assert.equal(out.decision, 'deny')
    assert.match(out.reason, /illisible/)
  } finally {
    rmSync(base, { recursive: true, force: true })
  }
})
