// Export des issues GitHub vers docs/decisions/ — les arbitrages RAW/maison (gabarit #101+) vivent
// dans les issues GitHub, introuvables hors-ligne. Ce script les mécanise en JSON + index Markdown.
// Idempotent (tri déterministe par number) : une seconde exécution sans changement produit un diff vide.
// Usage : node scripts/ops/export-issues.mjs (npm run issues:export). Requiert `gh` authentifié.
import { execFileSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const OUT_DIR = join('docs', 'decisions')

// Contrainte : l'export doit couvrir TOUTES les issues du dépôt, sans plafond à re-relever quand le
// stock grossit. `gh issue list --limit N` impose un N numérique (un `--limit 500` amputait l'export
// à une fenêtre glissante des 500 dernières). On passe donc par la pagination réelle de l'API REST
// (`--paginate`, 100 par page, jusqu'à épuisement) ; `--jq '.[]'` sérialise un objet JSON par ligne,
// forme stable quelle que soit la façon dont la version de `gh` recolle les pages. L'API `issues`
// renvoie aussi les pull requests : elles portent une clé `pull_request` et sont écartées.
// Les placeholders {owner}/{repo} sont résolus par `gh` depuis le dépôt courant.
function fetchIssues() {
  const raw = execFileSync(
    'gh',
    ['api', '--paginate', '--jq', '.[]', 'repos/{owner}/{repo}/issues?state=all&per_page=100'],
    { encoding: 'utf8', maxBuffer: 512 * 1024 * 1024 }
  )
  return raw
    .split('\n')
    .filter((l) => l.trim() !== '')
    .map((l) => JSON.parse(l))
}

function normalize(issues) {
  return issues
    .filter((i) => !i.pull_request)
    .map((i) => ({
      number: i.number,
      title: i.title,
      state: String(i.state).toUpperCase(),
      labels: (i.labels ?? []).map((l) => l.name).sort(),
      body: i.body ?? '',
      createdAt: i.created_at,
      closedAt: i.closed_at ?? null,
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
