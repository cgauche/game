// Export des issues GitHub vers docs/decisions/ — les arbitrages RAW/maison (gabarit #101+) vivent
// dans les issues GitHub, introuvables hors-ligne. Ce script les mécanise en JSON + index Markdown.
// Idempotent (tri déterministe par number) : un re-run sans changement produit un diff vide.
// Usage : node scripts/ops/export-issues.mjs (npm run issues:export). Requiert `gh` authentifié.
import { execFileSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const OUT_DIR = join('docs', 'decisions')
const FIELDS = 'number,title,state,labels,body,createdAt,closedAt'

function fetchIssues() {
  const raw = execFileSync(
    'gh',
    ['issue', 'list', '--state', 'all', '--limit', '500', '--json', FIELDS],
    { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }
  )
  return JSON.parse(raw)
}

function normalize(issues) {
  return issues
    .map((i) => ({
      number: i.number,
      title: i.title,
      state: i.state,
      labels: (i.labels ?? []).map((l) => l.name).sort(),
      body: i.body ?? '',
      createdAt: i.createdAt,
      closedAt: i.closedAt ?? null,
    }))
    .sort((a, b) => a.number - b.number)
}

function toIndexMarkdown(issues) {
  const line = (i) => `#${i.number} [${i.labels.join(', ')}] ${i.title}`
  const open = issues.filter((i) => i.state === 'OPEN')
  const closed = issues.filter((i) => i.state === 'CLOSED')
  const section = (title, list) =>
    `## ${title}\n\n${list.length ? list.map((i) => `- ${line(i)}`).join('\n') : '_(aucune)_'}\n`
  return (
    `# Index des issues (généré — voir issues.json pour le détail)\n\n` +
    `${section('Ouvertes', open)}\n${section('Fermées', closed)}`
  )
}

const issues = normalize(fetchIssues())
mkdirSync(OUT_DIR, { recursive: true })
writeFileSync(join(OUT_DIR, 'issues.json'), JSON.stringify(issues, null, 2) + '\n', 'utf8')
writeFileSync(join(OUT_DIR, 'issues.md'), toIndexMarkdown(issues), 'utf8')
console.log(`export-issues — ${issues.length} issue(s) exportée(s) vers ${OUT_DIR}/`)
