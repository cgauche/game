// Carte du vocabulaire `Effect` = DONNÉE (#667) : GÉNÉRÉE depuis l'union discriminée `Effect` de
// src/state/scene.ts (AST TypeScript, pas de regex sur les accolades — l'union imbrique des types
// internes, ex. extendedTest/forceDoor/medicalAid/delayedEffect). Sortie : docs/campagne-effects.md.
// Re-run : node scripts/docs/build-effects.mjs (npm run docs:effects).
// Mode --check (chaîné dans npm run docs:check) : régénère en mémoire, compare au .md committé,
// exit 1 avec message actionnable si diff — jamais d'écriture en mode --check.
import ts from 'typescript'
import { readFileSync, writeFileSync, existsSync } from 'node:fs'

const SRC = 'src/state/scene.ts'
const OUT = 'docs/campagne-effects.md'

const text = readFileSync(SRC, 'utf8')
const sf = ts.createSourceFile(SRC, text, ts.ScriptTarget.Latest, true)

let effectAlias
sf.forEachChild((node) => {
  if (ts.isTypeAliasDeclaration(node) && node.name.text === 'Effect') effectAlias = node
})
if (!effectAlias) {
  console.error(`build-effects — type alias « Effect » introuvable dans ${SRC}`)
  process.exit(1)
}
const union = effectAlias.type
if (!ts.isUnionTypeNode(union)) {
  console.error(`build-effects — « Effect » n'est pas une union discriminée dans ${SRC}`)
  process.exit(1)
}

// 1re phrase d'un bloc JSDoc /** … */, abréviations FR (« ex. », « l. », « p. »…) exclues des
// coupures de phrase (sinon un « (ex. » tronque le rôle en pleine parenthèse ouverte).
const ABBR = new Set(['ex', 'cf', 'l', 'p', 'ch', 'art', 'etc', 'n', 'vs', 'c'])
function firstSentence(body) {
  const re = /\.(?=\s|$)/g
  let m
  while ((m = re.exec(body))) {
    const before = body.slice(0, m.index)
    const word = (before.match(/([A-Za-zÀ-ÿ]+)$/) ?? [])[1]?.toLowerCase()
    if (word && ABBR.has(word)) continue
    return body.slice(0, m.index + 1)
  }
  return body
}

function jsdocRole(between) {
  const matches = [...between.matchAll(/\/\*\*[\s\S]*?\*\//g)]
  if (!matches.length) return null
  const raw = matches[matches.length - 1][0]
  const body = raw
    .replace(/^\/\*\*/, '')
    .replace(/\*\/$/, '')
    .split('\n')
    .map((l) => l.replace(/^\s*\*\s?/, ''))
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim()
  return firstSentence(body)
}

const FALLBACK_ROLE_REF = 'Pont unique vers le moteur mécanique des sorts/effets (GameOp).'

// Extrait {name, fields} d'un TypeLiteralNode (discriminant `type` littéral + reste des props).
function readTypeLiteral(member, prevEnd) {
  let name = null
  const fields = []
  for (const prop of member.members) {
    if (!ts.isPropertySignature(prop)) continue
    const pname = prop.name.getText(sf)
    if (pname === 'type' && prop.type && ts.isLiteralTypeNode(prop.type) && ts.isStringLiteral(prop.type.literal)) {
      name = prop.type.literal.text
      continue
    }
    fields.push(pname + (prop.questionToken ? '?' : ''))
  }
  if (!name) {
    console.error(`build-effects — membre de l'union sans propriété « type » littérale (autour de ${text.slice(prevEnd, prevEnd + 40)}…)`)
    process.exit(1)
  }
  return { name, fields }
}

const rows = []
let prevEnd = union.types.pos
for (const member of union.types) {
  const between = text.slice(prevEnd, member.getStart(sf))
  const role = jsdocRole(between)
  // `({ type: '…'; … } & ScheduleSpec)` (#668) : intersection parenthésée — le littéral porte le
  // discriminant `type` + ses champs propres, le(s) reste des membres (référence de type, ex.
  // `ScheduleSpec`) sont notés en champ « spread » `...Nom`.
  const inner = ts.isParenthesizedTypeNode(member) ? member.type : member
  if (ts.isIntersectionTypeNode(inner)) {
    const literal = inner.types.find((t) => ts.isTypeLiteralNode(t))
    if (!literal) {
      console.error(`build-effects — intersection sans littéral discriminant (autour de ${text.slice(prevEnd, prevEnd + 40)}…)`)
      process.exit(1)
    }
    const { name, fields } = readTypeLiteral(literal, prevEnd)
    for (const t of inner.types) {
      if (t === literal) continue
      if (ts.isTypeReferenceNode(t)) fields.push(`...${t.typeName.getText(sf)}`)
    }
    rows.push({ name, fieldGroups: [fields], role })
  } else if (ts.isTypeLiteralNode(inner)) {
    const { name, fields } = readTypeLiteral(inner, prevEnd)
    rows.push({ name, fieldGroups: [fields], role })
  } else if (ts.isTypeReferenceNode(inner)) {
    rows.push({ name: inner.typeName.getText(sf), fieldGroups: [], role: role ?? FALLBACK_ROLE_REF })
  } else {
    console.error(`build-effects — membre d'union non supporté (kind ${ts.SyntaxKind[member.kind]})`)
    process.exit(1)
  }
  prevEnd = member.getEnd()
}

// Fusion des formes en double (ex. `setTime` : `phase` OU `hour`+`minute?`) en UNE ligne, champs =
// union des formes (rendue « `phase` | `hour`, `minute?` »).
const merged = []
const byName = new Map()
for (const r of rows) {
  if (byName.has(r.name)) {
    const existing = byName.get(r.name)
    existing.fieldGroups.push(...r.fieldGroups)
    if (!existing.role && r.role) existing.role = r.role
  } else {
    const copy = { name: r.name, fieldGroups: [...r.fieldGroups], role: r.role }
    byName.set(r.name, copy)
    merged.push(copy)
  }
}

function renderFields(fieldGroups) {
  const nonEmpty = fieldGroups.filter((g) => g.length)
  if (!nonEmpty.length) return '—'
  return nonEmpty.map((g) => g.map((f) => `\`${f}\``).join(', ')).join(' \\| ')
}

let out = `# Carte des Effects de scène — GÉNÉRÉ\n\n`
out += `> ⚠️ Fichier GÉNÉRÉ par \`node scripts/docs/build-effects.mjs\` (\`npm run docs:effects\`) — NE PAS ÉDITER À LA MAIN.\n`
out += `> Source : le type \`Effect\` de \`src/state/scene.ts\`. Vocabulaire des actions authorées d'une scène/campagne,\n`
out += `> posées dans un \`Flow\` (\`onVictory\`, choix de dialogue, trigger, \`delayedEffect\`…). Voir \`docs/campagne-authoring.md\`.\n\n`
out += `| Effect (\`type\`) | Champs | Rôle |\n|---|---|---|\n`
for (const r of merged) {
  out += `| \`${r.name}\` | ${renderFields(r.fieldGroups)} | ${r.role ?? '—'} |\n`
}
out += `\n_${merged.length} Effects — dérivés de \`src/state/scene.ts\`._\n`

const CHECK = process.argv.includes('--check')
if (CHECK) {
  const current = existsSync(OUT) ? readFileSync(OUT, 'utf8') : null
  if (current !== out) {
    console.error(`docs:effects — ${OUT} est PÉRIMÉ (diverge du type Effect de ${SRC}).`)
    console.error('  → relancer `npm run docs:effects` et committer le résultat.')
    process.exit(1)
  }
  console.log(`docs:effects — OK (${OUT} à jour, ${merged.length} Effects)`)
} else {
  writeFileSync(OUT, out)
  console.log(`${OUT} — ${merged.length} Effects (${union.types.length} membres d'union avant fusion).`)
}
