// Tests du DRIVER de `solde-ticket-guard` (le bloc `isMain`, non importable : il se teste en
// lançant le script réel avec un payload de hook sur stdin). Lancé par `npm run test:hooks`.
//
// Le driver est la couture où le message de commit est REJOINT à son répertoire d'exécution : un
// message packé dans un fichier (`-F`) doit être lu là où le `git commit` s'exécute, sinon une
// fermeture de ticket devient invisible au contrôle de solde (fail-open mesuré 2026-08-03, #1052).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { spawnSync, execFileSync } from 'node:child_process'
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

// Le contexte de solde du driver n'est pas qu'un branchement : « corrigé par <sha> <fichier>:<ligne> »
// se juge contre l'HISTOIRE GIT du répertoire où le commit s'exécute. On monte un dépôt réel, on y
// pose un commit qui touche UN fichier, et on fait citer par le solde un fichier qu'il ne touche pas.
test('DRIVER : « corrigé par <sha> » est confronté à l\'histoire git RÉELLE du dépôt cible', () => {
  const repo = mkdtempSync(join(tmpdir(), 'solde-histoire-'))
  try {
    const git = (...args) => execFileSync('git', args, { cwd: repo, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
    git('init', '-q')
    git('config', 'user.email', 'sonde@test')
    git('config', 'user.name', 'sonde')
    git('config', 'commit.gpgsign', 'false')
    mkdirSync(join(repo, 'src'), { recursive: true })
    writeFileSync(join(repo, 'src', 'touche.ts'), 'export const a = 1\n', 'utf8')
    git('add', 'src/touche.ts')
    git('commit', '-q', '--no-verify', '-m', 'socle')
    const sha = git('rev-parse', '--short=8', 'HEAD').trim()

    const aujourdhui = new Date()
    const jour = `${aujourdhui.getFullYear()}-${String(aujourdhui.getMonth() + 1).padStart(2, '0')}-${String(aujourdhui.getDate()).padStart(2, '0')}`
    const solde = (site) => [
      'VERIFIE: histoire git du dépôt cible relue commit par commit, fichiers touchés recoupés au numstat.',
      '', '## Restes', `- chemin mort cité -> corrigé par ${sha} ${site}`,
      '', '## Réfutation', 'verdict: CONFIRMÉ',
      'Un juge a rejoué le diff contre le DoD, tenté deux contournements, aucun ne passe sur ce lot.',
      '', `(${jour})`, '',
    ].join('\n')

    mkdirSync(join(repo, '.claude', 'soldes'), { recursive: true })
    const ecrireEtStager = (contenu) => {
      writeFileSync(join(repo, '.claude', 'soldes', '4242.md'), contenu, 'utf8')
      git('add', '--force', '.claude/soldes/4242.md')
    }

    ecrireEtStager(solde('src/jamais-touche.ts:12'))
    const faux = decisionOf('git commit -m "corrige #4242"', repo)
    assert.ok(faux, 'aucune décision : le site cité n\'a pas été confronté au commit')
    assert.match(faux.reason, /que ce commit ne touche PAS/)

    ecrireEtStager(solde('src/touche.ts:1'))
    const juste = decisionOf('git commit -m "corrige #4242"', repo)
    // Le dépôt de test est un arbre PRINCIPAL (son .git est un dossier) : le `ask` de worktree est
    // attendu et distinct — ce qui doit disparaître, c'est le refus portant sur le SITE cité.
    assert.doesNotMatch(juste?.reason ?? '', /ne touche PAS|ANCÊTRE|SOLDE conforme/, 'site conforme refusé')
  } finally {
    rmSync(repo, { recursive: true, force: true })
  }
})

// Volet ANCÊTRE de la même disposition : un sha qui n'est dans AUCUNE histoire de ce dépôt.
test('DRIVER : « corrigé par <sha> » dont le commit n\'existe pas dans le dépôt cible → refus', () => {
  const repo = mkdtempSync(join(tmpdir(), 'solde-ancetre-'))
  try {
    const git = (...args) => execFileSync('git', args, { cwd: repo, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
    git('init', '-q')
    git('config', 'user.email', 'sonde@test')
    git('config', 'user.name', 'sonde')
    git('config', 'commit.gpgsign', 'false')
    mkdirSync(join(repo, 'src'), { recursive: true })
    writeFileSync(join(repo, 'src', 'touche.ts'), 'export const a = 1\n', 'utf8')
    git('add', 'src/touche.ts')
    git('commit', '-q', '--no-verify', '-m', 'socle')

    const d = new Date()
    const jour = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    mkdirSync(join(repo, '.claude', 'soldes'), { recursive: true })
    writeFileSync(join(repo, '.claude', 'soldes', '4243.md'), [
      'VERIFIE: histoire git du dépôt cible relue commit par commit, fichiers touchés recoupés au numstat.',
      '', '## Restes', '- chemin mort cité -> corrigé par deadbeef1 src/touche.ts:1',
      '', '## Réfutation', 'verdict: CONFIRMÉ',
      'Un juge a rejoué le diff contre le DoD, tenté deux contournements, aucun ne passe sur ce lot.',
      '', `(${jour})`, '',
    ].join('\n'), 'utf8')
    git('add', '--force', '.claude/soldes/4243.md')

    const out = decisionOf('git commit -m "corrige #4243"', repo)
    assert.ok(out, 'aucune décision : un sha absent de l\'histoire est passé')
    assert.match(out.reason, /n'est pas un ANCÊTRE de HEAD/)
  } finally {
    rmSync(repo, { recursive: true, force: true })
  }
})
