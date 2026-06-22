// Assemble la sortie JSON d'un workflow « Atlas RAW » en docs/raw/<domaine>.md.
// Gere mono-domaine ({domain,topics,...}) ET multi-domaines ({domains:[...]}).
// Chaque <domaine>.md embarque sa propre carte code->regle en pied de fichier.
// Usage : node scripts/raw/assemble-domain.mjs <output.json> [Titre si mono]
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'

const [, , jsonPath, titleArg] = process.argv
if (!jsonPath) { console.error('usage: node scripts/raw/assemble-domain.mjs <output.json> [Titre]'); process.exit(1) }

const parsed = JSON.parse(readFileSync(jsonPath, 'utf8'))
const root = parsed.result || parsed
const list = root.domains && Array.isArray(root.domains) ? root.domains : [root]

const slug = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9 -]/g, '').trim().replace(/\s+/g, '-')

function assemble(data) {
  const domain = data.domain
  const title = data.title || titleArg || (domain.charAt(0).toUpperCase() + domain.slice(1))
  const topics = data.topics || []
  const toc = topics.map((t) => `- [${t.title}](#${slug(t.title)})`).join('\n')
  const body = topics.map((t) => t.markdown.trim()).join('\n\n---\n\n')

  const flagged = topics.filter((t) => t.faithful === false || (t.issues && t.issues.length))
  const bilan = flagged.length
    ? flagged.map((t) => `### ${t.title} ${t.faithful === false ? '❌' : '⚠'}\n` + (t.issues || []).map((i) => `- ${i}`).join('\n')).join('\n\n')
    : '_Aucune anomalie relevée par la passe de vérification._'

  const autre = (data.autre || []).length
    ? (data.autre || []).map((h) => `- \`${h.ref}\` (${h.book}) — ${h.gist}`).join('\n')
    : '_(aucun)_'

  const modules = (data.codeMap && data.codeMap.modules) || []
  const codemap = modules.length
    ? '| Module | Topics couverts | Note |\n|---|---|---|\n' + modules.map((m) => `| \`${m.module}\` | ${(m.topics || []).join(', ')} | ${(m.note || '').replace(/\|/g, '\\|')} |`).join('\n')
    : '_(non renseignée)_'

  const counts = (data.surveyCounts || []).map((c) => `${c.book} ${c.hits}`).join(' · ')
  const meta = []
  if (data.inventoryCount != null) meta.push(`${data.inventoryCount} éléments inventoriés`)
  if (data.auditLoops != null) meta.push(`${data.auditLoops} boucle(s) d'audit` + (data.lastAuditDry ? ' (sec)' : ' (plafond atteint)'))

  const out = `# Atlas RAW — ${title}

> Référentiel **autosuffisant** des règles WFRP4 (RAW), consolidé sur les 14 livres autorisés, à usage
> d'agent (répondre + auditer le code sans rouvrir les livres). Chaque règle cite \`LIVRE NN l.X-Y\`
> (last-recours = la source). Abréviations : [\`sources.md\`](sources.md). Index : [\`00-index.md\`](00-index.md).
>
> ⚠️ Agent-généré + vérifié (passe adversariale, voir § *Bilan de fidélité*). ${meta.join(' · ')}.

## Sommaire

${toc}

---

${body}

---

## Bilan de fidélité — passe de vérification adversariale

${bilan}

---

## Hors-taxonomie (bucket « autre »)

${autre}

---

## Carte code → règle (ce domaine)

${codemap}

---

*Couverture du survey* : ${counts}.
`
  mkdirSync('docs/raw', { recursive: true })
  writeFileSync(join('docs/raw', domain + '.md'), out, 'utf8')
  return { domain, topics: topics.length, flagged: flagged.length }
}

const results = list.map(assemble)
for (const r of results) console.log(`wrote docs/raw/${r.domain}.md — ${r.topics} topics, ${r.flagged} flagués`)
