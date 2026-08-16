// Garde BLOQUANTE des nouveaux composants d'UI (#1318 V5) : le hook est lancé POUR DE VRAI
// (spawnSync + stdin JSON), aucun fichier n'est écrit sous src/ — les chemins testés sont des
// fantômes qui n'existent pas (c'est précisément l'état qui déclenche la garde).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { estComposantUI, estDeclare, relPath, REGISTRE } from './new-src-file-guard.mjs'

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const HOOK = join(REPO, 'scripts', 'hooks', 'new-src-file-guard.mjs')
const FANTOME = 'src/ui/FantomeGardeV5.tsx'

function lanceAvec(tool_input, env = {}) {
  const r = spawnSync(process.execPath, [HOOK], {
    input: JSON.stringify({ tool_input }),
    encoding: 'utf8',
    cwd: REPO,
    env: { ...process.env, ...env },
  })
  return { code: r.status, out: r.stdout ?? '', err: r.stderr ?? '' }
}
const lance = (file_path, env = {}) => lanceAvec({ file_path }, env)

test('le fantôme de test n’existe pas (sinon la garde ne serait jamais sollicitée)', () => {
  assert.equal(existsSync(join(REPO, FANTOME)), false)
})

test('composant d’UI NEUF non déclaré → sortie non-zéro + geste attendu dans le message', () => {
  const r = lance(join(REPO, FANTOME))
  assert.notEqual(r.code, 0, 'la garde doit BLOQUER (statut non nul)')
  assert.match(r.err, /NON DÉCLARÉ/)
  assert.match(r.err, /Primitives partagées/)
  assert.match(r.err, /scripts\/hooks\/ecrans-ui\.json/)
  assert.match(r.err, /SKIP_NEW_SRC_GUARD=1/)
  assert.equal(r.out.trim(), '', 'un refus n’injecte pas de contexte')
})

test('un composant qui EXISTE déjà (édition, pas création) ne déclenche rien', () => {
  const inscrit = JSON.parse(readFileSync(REGISTRE, 'utf8')).ecrans[0]
  const r = lance(join(REPO, inscrit))
  assert.equal(r.code, 0)
  assert.equal(r.out.trim(), '')
  assert.equal(r.err.trim(), '')
})

test('primitive citée par le CLAUDE.md et écran inscrit sont tous deux « déclarés »', () => {
  const claudeMd = readFileSync(join(REPO, 'CLAUDE.md'), 'utf8')
  const registre = JSON.parse(readFileSync(REGISTRE, 'utf8'))
  assert.ok(estDeclare('src/ui/NumberField.tsx', claudeMd, registre), 'primitive du CLAUDE.md')
  assert.ok(estDeclare(registre.ecrans[0], claudeMd, registre), 'écran du registre')
  assert.ok(!estDeclare(FANTOME, claudeMd, registre))
})

test('échappement SKIP_NEW_SRC_GUARD=1 → passe, et LOGGUE la dérogation', () => {
  const r = lance(join(REPO, FANTOME), { SKIP_NEW_SRC_GUARD: '1' })
  assert.equal(r.code, 0)
  assert.match(r.err, /dérogation prise/)
  assert.match(r.err, new RegExp(FANTOME))
  assert.match(r.out, /additionalContext/)
})

test('un harnais .test.tsx et un fichier hors src/ui ne sont pas bloqués', () => {
  assert.equal(estComposantUI('src/ui/Machin.test.tsx'), false)
  assert.equal(estComposantUI('src/state/machin.ts'), false)
  assert.equal(estComposantUI('src/ui/sous/Machin.tsx'), true)
  const r = lance(join(REPO, 'src/state/fantome-garde-v5.ts'))
  assert.equal(r.code, 0)
  assert.match(r.out, /additionalContext/) // le régime non bloquant reste en place
})

test('relPath : chemin POSIX relatif à la RACINE du dépôt, null hors du dépôt', () => {
  assert.equal(relPath(join(REPO, 'src', 'ui', 'A.tsx')), 'src/ui/A.tsx')
  assert.equal(relPath('src/ui/A.tsx'), 'src/ui/A.tsx') // relatif → résolu depuis la racine
  assert.equal(relPath('/autre-projet/src/ui/A.tsx', '/le/depot'), null)
  assert.equal(relPath('D:\\autre-projet\\src\\ui\\A.tsx', 'C:\\le\\depot'), null)
})

test('un chemin HORS du dépôt (autre projet) n’est jamais bloqué', () => {
  const r = lance('D:/autre-projet/src/ui/FantomeExterne.tsx')
  assert.equal(r.code, 0)
  assert.equal(r.out.trim(), '')
  assert.equal(r.err.trim(), '')
})

test('ctx_patch op=create porte le chemin en `path` : même refus que Write', () => {
  const r = lanceAvec({ op: 'create', path: join(REPO, FANTOME), new_text: 'export {}' })
  assert.notEqual(r.code, 0)
  assert.match(r.err, /NON DÉCLARÉ/)
})

test('les DEUX surfaces matchent Write ET mcp__lean-ctx__ctx_patch (sinon la garde passe à vide)', () => {
  for (const surface of ['.claude/settings.json', '.codex/hooks.json']) {
    const config = JSON.parse(readFileSync(join(REPO, surface), 'utf8'))
    const matchers = (config.hooks?.PreToolUse ?? [])
      .filter((e) => (e.hooks ?? []).some((h) => String(h.command ?? '').includes('new-src-file-guard.mjs')))
      .map((e) => String(e.matcher ?? ''))
    assert.ok(matchers.length > 0, `${surface} : hook non câblé`)
    for (const canal of ['Write', 'mcp__lean-ctx__ctx_patch'])
      assert.ok(matchers.some((m) => m.split('|').includes(canal)), `${surface} : canal ${canal} non matché`)
  }
})

test('registre ILLISIBLE → refus fail-closed dont le corps dit de RÉPARER, pas d’inscrire', () => {
  const brut = readFileSync(REGISTRE, 'utf8')
  writeFileSync(REGISTRE, '{ ceci n’est pas du JSON')
  try {
    const r = lance(join(REPO, FANTOME))
    assert.notEqual(r.code, 0)
    assert.match(r.err, /ILLISIBLE/)
    assert.match(r.err, /réparer d'abord/)
    assert.doesNotMatch(r.err, /ordre alphabétique/, 'le corps « ajouter une ligne » est inopérant sur un JSON cassé')
  } finally {
    writeFileSync(REGISTRE, brut)
  }
  assert.equal(readFileSync(REGISTRE, 'utf8'), brut)
})

test('le registre des écrans est trié, sans doublon, et ne cite que des .tsx existants de src/ui', () => {
  const { ecrans } = JSON.parse(readFileSync(REGISTRE, 'utf8'))
  assert.deepEqual(ecrans, [...ecrans].sort(), 'registre non trié (diffs illisibles)')
  assert.equal(new Set(ecrans).size, ecrans.length, 'doublon dans le registre')
  for (const f of ecrans) {
    assert.ok(estComposantUI(f), `${f} : pas un composant d'UI`)
    assert.ok(existsSync(join(REPO, f)), `${f} : inscrit mais absent de l'arbre`)
  }
})
