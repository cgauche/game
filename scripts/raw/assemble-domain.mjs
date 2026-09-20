// Assemble la sortie JSON d'un workflow « Atlas RAW » en docs/raw/<domaine>.md.
// Gere mono-domaine ({domain,topics,...}) ET multi-domaines ({domains:[...]}).
// Le champ Implemente des topics est DERIVE du code par build-implemente (#487) : l'assembleur ne
// pose qu'un PLACEHOLDER nu (`**Implémente :** (non implémenté)`) par topic, jamais une carte
// code->regle ni un bilan de fidelite manuscrits (sections d'etat supprimees #507 — code-map.md eradique).
// CŒUR — l'entrée PORTE le cœur de règles de son run (`coeur`, clé de `src/data/books.json`) :
// l'assembleur le NOMME dans l'en-tête au lieu d'une édition écrite en dur, et il REFUSE d'écrire
// sur une fiche existante dont les livres de CŒUR cités relèvent d'un AUTRE cœur — sans quoi un run
// écraserait la fiche d'un autre corps de règles, ou produirait la fiche à deux cœurs que
// `reconcile.mjs` (`melangesDeCoeur`) fait rougir. OÙ vit la fiche d'un second cœur n'est PAS
// tranché ici : l'assembleur refuse, il ne route pas.
// Usage : node scripts/raw/assemble-domain.mjs <output.json> [Titre si mono]
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { coeurDe, looseRe, readText } from './_lib.mjs'

/** Les cœurs de règles qu'un texte de fiche CITE, par ses mentions de chapitre — PUR. */
export function coeursCites(texte) {
  const trouves = new Set()
  for (const m of texte.matchAll(looseRe())) {
    const coeur = coeurDe(m[1])
    if (coeur) trouves.add(coeur)
  }
  return [...trouves].sort()
}

/** Le cœur d'un rendu de workflow, ou LEVE en nommant la cause : il ne se devine pas. PUR. */
export function coeurDuRendu(data, racine = {}, source = '<entrée>') {
  const coeur = data.coeur ?? racine.coeur
  if (typeof coeur !== 'string' || !coeur)
    throw new Error(
      `assemble-domain: le rendu de workflow ${source} ne porte pas son \`coeur\` — l'en-tête d'une `
      + 'fiche NOMME le corps de règles qu\'elle synthétise, et il ne se devine pas depuis le JSON',
    )
  return coeur
}

/** Refuse d'écraser une fiche existante d'un AUTRE cœur — prédicat GÉNÉRAL, aucun cœur nommé. */
export function refuserSiAutreCoeur(path, coeur) {
  if (!existsSync(path)) return
  const autres = coeursCites(readText(path)).filter((c) => c !== coeur)
  if (!autres.length) return
  throw new Error(
    `assemble-domain: ${path} cite déjà le(s) cœur(s) ${autres.join(', ')} et ce run porte le cœur `
    + `${coeur} — refus d'écrire : une fiche synthétise UN corps de règles (écraser perdrait l'autre, `
    + 'fusionner produirait la fiche à deux cœurs que `raw:reconcile` fait rougir)',
  )
}

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

export function assemble(data, { racine = {}, source = '<entrée>', titleArg } = {}) {
  const coeur = coeurDuRendu(data, racine, source)
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

> Référentiel **autosuffisant** des règles du cœur **${coeur}** (RAW), consolidé sur les livres autorisés, à usage
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
  const path = join('docs/raw', domain + '.md')
  refuserSiAutreCoeur(path, coeur)
  mkdirSync('docs/raw', { recursive: true })
  writeFileSync(path, out, 'utf8')
  return { domain, topics: topics.length, coeur }
}

function main() {
  const [, , jsonPath, titleArg] = process.argv
  if (!jsonPath) { console.error('usage: node scripts/raw/assemble-domain.mjs <output.json> [Titre]'); process.exit(1) }
  const parsed = JSON.parse(readFileSync(jsonPath, 'utf8'))
  const racine = parsed.result || parsed
  const list = racine.domains && Array.isArray(racine.domains) ? racine.domains : [racine]
  for (const r of list.map((d) => assemble(d, { racine, source: jsonPath, titleArg })))
    console.log(`wrote docs/raw/${r.domain}.md — ${r.topics} topics (cœur ${r.coeur})`)
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isMain) main()
