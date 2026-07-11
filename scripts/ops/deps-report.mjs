// Rapport mensuel d'hygiène des dépendances (#303) — dépendances inutilisées (knip) + majeures
// obsolètes (npm outdated), ouvert en issue GitHub automatique. Le canari hebdo (canari.yml) gère
// déjà le blocage sur vulnérabilité (npm audit) ; ce script est un RAPPORT, pas une gate.
// Usage : node scripts/ops/deps-report.mjs (npm run deps:report). Requiert `gh` authentifié.
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'

const isWin = process.platform === 'win32'

function runJson(cmd, args, opts = {}) {
  try {
    return execFileSync(cmd, args, {
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
      shell: isWin,
      ...opts,
    })
  } catch (err) {
    // npm outdated / knip sortent en code 1 quand ils trouvent des résultats — le JSON reste sur stdout.
    if (typeof err.stdout === 'string' && err.stdout.trim()) return err.stdout
    throw err
  }
}

function majorOf(version) {
  const m = /^(\d+)\./.exec(version)
  return m ? Number(m[1]) : null
}

function outdatedMajors(prefixArgs, workspaceLabel) {
  const raw = runJson('npm', [...prefixArgs, 'outdated', '--json'])
  const parsed = raw.trim() ? JSON.parse(raw) : {}
  return Object.entries(parsed)
    .filter(([, info]) => {
      const cur = majorOf(info.current)
      const latest = majorOf(info.latest)
      return cur !== null && latest !== null && latest > cur
    })
    .map(([name, info]) => ({ workspace: workspaceLabel, name, current: info.current, latest: info.latest }))
}

function unusedDeps(cwd, workspaceLabel) {
  const raw = runJson('npx', ['--no-install', 'knip', '--dependencies', '--reporter', 'json'], { cwd })
  const parsed = raw.trim() ? JSON.parse(raw) : { issues: [] }
  const names = new Set()
  for (const issue of parsed.issues ?? []) {
    for (const dep of [...(issue.dependencies ?? []), ...(issue.devDependencies ?? [])]) names.add(dep.name)
  }
  return [...names].sort().map((name) => ({ workspace: workspaceLabel, name }))
}

function toMarkdown(majors, unused) {
  const majorsSection = majors.length
    ? majors.map((m) => `- \`${m.workspace}\` **${m.name}** : ${m.current} → ${m.latest}`).join('\n')
    : '_(aucune)_'
  const unusedSection = unused.length
    ? unused.map((u) => `- \`${u.workspace}\` **${u.name}**`).join('\n')
    : '_(aucune)_'
  return (
    `Rapport automatique (\`npm run deps:report\`) — à trier, pas un ordre de travail (les majeures\n` +
    `ne se prennent que sur décision explicite ; une dépendance listée « inutilisée » se vérifie avant\n` +
    `retrait, knip peut rater un usage hors des points d'entrée détectés).\n\n` +
    `## Majeures obsolètes\n\n${majorsSection}\n\n` +
    `## Dépendances potentiellement inutilisées\n\n${unusedSection}\n`
  )
}

const rootDir = join(fileURLToPath(import.meta.url), '..', '..', '..')

const majors = [
  ...outdatedMajors([], 'racine'),
  ...outdatedMajors(['--prefix', 'server'], 'server'),
]
const unused = [...unusedDeps(rootDir, 'racine')]

const body = toMarkdown(majors, unused)
const title = `Hygiène des dépendances — rapport ${new Date().toISOString().slice(0, 7)}`

if (process.env.DEPS_REPORT_DRY_RUN) {
  console.log(title)
  console.log(body)
} else {
  try {
    execFileSync('gh', ['issue', 'create', '--title', title, '--body', body, '--label', 'canari'], {
      stdio: 'inherit',
    })
  } catch {
    execFileSync('gh', ['issue', 'create', '--title', title, '--body', body], { stdio: 'inherit' })
  }
}
