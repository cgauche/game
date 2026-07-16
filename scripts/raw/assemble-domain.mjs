// Assemble la sortie JSON d'un workflow « Atlas RAW » en docs/raw/<domaine>.md.
// Gere mono-domaine ({domain,topics,...}) ET multi-domaines ({domains:[...]}).
// Le champ Implemente des topics est DERIVE du code par build-implemente (#487) : l'assembleur ne
// pose qu'un PLACEHOLDER nu (`**Implémente :** (non implémenté)`) par topic, jamais une carte
// code->regle ni un bilan de fidelite manuscrits (sections d'etat supprimees #507 — code-map.md eradique).
// Usage : node scripts/raw/assemble-domain.mjs <output.json> [Titre si mono]
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'

const [, , jsonPath, titleArg] = process.argv
if (!jsonPath) { console.error('usage: node scripts/raw/assemble-domain.mjs <output.json> [Titre]'); process.exit(1) }

const parsed = JSON.parse(readFileSync(jsonPath, 'utf8'))
const root = parsed.result || parsed
const list = root.domains && Array.isArray(root.domains) ? root.domains : [root]

const slug = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9 -]/g, '').trim().replace(/\s+/g, '-')

// Placeholder du champ Implemente : build-implemente le remplira a partir du code (jamais ecrit a la
// main). Toute forme authoree du champ dans le markdown d'un topic est NORMALISEE vers ce placeholder
// nu (frontiere = ligne debutant par `**Implement…**`, meme graphie que FIELD_START_RE du generateur).
const IMPLEMENTE_PLACEHOLDER = '**Implémente :** (non implémenté)'
const IMPLEMENTE_FIELD_LINE_RE = /^\*\*Impl[ée]ment[ée]?\s*[:.]?\*\*.*$/gim
function withPlaceholderField(md) {
  const stripped = md.replace(IMPLEMENTE_FIELD_LINE_RE, '').replace(/\n{3,}/g, '\n\n').trim()
  return `${stripped}\n\n${IMPLEMENTE_PLACEHOLDER}`
}

function assemble(data) {
  const domain = data.domain
  const title = data.title || titleArg || (domain.charAt(0).toUpperCase() + domain.slice(1))
  const topics = data.topics || []
  const toc = topics.map((t) => `- [${t.title}](#${slug(t.title)})`).join('\n')
  const body = topics.map((t) => withPlaceholderField(t.markdown.trim())).join('\n\n---\n\n')

  const autre = (data.autre || []).length
    ? (data.autre || []).map((h) => `- \`${h.ref}\` (${h.book}) — ${h.gist}`).join('\n')
    : '_(aucun)_'

  const counts = (data.surveyCounts || []).map((c) => `${c.book} ${c.hits}`).join(' · ')
  const meta = []
  if (data.inventoryCount != null) meta.push(`${data.inventoryCount} éléments inventoriés`)
  if (data.auditLoops != null) meta.push(`${data.auditLoops} boucle(s) d'audit` + (data.lastAuditDry ? ' (sec)' : ' (plafond atteint)'))

  const out = `# Atlas RAW — ${title}

> Référentiel **autosuffisant** des règles WFRP4 (RAW), consolidé sur les 14 livres autorisés, à usage
> d'agent (répondre + auditer le code sans rouvrir les livres). Chaque règle cite \`LIVRE NN l.X-Y\`
> (last-recours = la source). Abréviations : [\`sources.md\`](sources.md). Index : [\`00-index.md\`](00-index.md).
>
> ⚠️ Agent-généré + vérifié (passe adversariale). Le champ **Implémente** est DÉRIVÉ du code
> (\`npm run raw:implemente\`), jamais écrit à la main. ${meta.join(' · ')}.

## Sommaire

${toc}

---

${body}

---

## Hors-taxonomie (bucket « autre »)

${autre}

---

*Couverture du survey* : ${counts}.
`
  mkdirSync('docs/raw', { recursive: true })
  writeFileSync(join('docs/raw', domain + '.md'), out, 'utf8')
  return { domain, topics: topics.length }
}

const results = list.map(assemble)
for (const r of results) console.log(`wrote docs/raw/${r.domain}.md — ${r.topics} topics`)
