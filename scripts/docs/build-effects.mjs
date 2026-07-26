// Carte du vocabulaire `Effect` = DONNÉE (#667) : GÉNÉRÉE depuis l'union discriminée `Effect` de
// src/state/scene.ts (AST TypeScript, pas de regex sur les accolades — l'union imbrique des types
// internes, ex. extendedTest/forceDoor/medicalAid/delayedEffect). Sortie : docs/campagne-effects.md.
// Re-run : node scripts/docs/build-effects.mjs (npm run docs:effects).
// Mode --check (chaîné dans npm run docs:check) : régénère en mémoire, compare au .md committé,
// exit 1 avec message actionnable si diff — jamais d'écriture en mode --check.
// Lecture d'union / extraction JSDoc / écriture-vérification : scripts/docs/lib/jsdocUnion.mjs
// (socle PARTAGÉ avec build-vocabulaire.mjs).
import { loadSource, findAlias, readUnionMembers, renderFields, emitOrCheck } from './lib/jsdocUnion.mjs'

const SRC = 'src/state/scene.ts'
const OUT = 'docs/campagne-effects.md'
const TOOL = 'build-effects'

const FALLBACK_ROLE_REF = 'Pont unique vers le moteur mécanique des sorts/effets (GameOp).'

const { text, sf } = loadSource(SRC)
const alias = findAlias(sf, 'Effect', TOOL, SRC)
const { rows: merged, rawCount } = readUnionMembers(sf, text, alias, 'type', TOOL, { fallbackRole: FALLBACK_ROLE_REF })

let out = `# Carte des Effects de scène — GÉNÉRÉ\n\n`
out += `> ⚠️ Fichier GÉNÉRÉ par \`node scripts/docs/build-effects.mjs\` (\`npm run docs:effects\`) — NE PAS ÉDITER À LA MAIN.\n`
out += `> Source : le type \`Effect\` de \`src/state/scene.ts\`. Vocabulaire des actions authorées d'une scène/campagne,\n`
out += `> posées dans un \`Flow\` (\`onVictory\`, choix de dialogue, trigger, \`delayedEffect\`…). Voir \`docs/campagne-authoring.md\`.\n\n`
out += `| Effect (\`type\`) | Champs | Rôle |\n|---|---|---|\n`
for (const r of merged) {
  out += `| \`${r.name}\` | ${renderFields(r.fieldGroups)} | ${r.role ?? '—'} |\n`
}
out += `\n_${merged.length} Effects — dérivés de \`src/state/scene.ts\`._\n`

emitOrCheck({
  out,
  path: OUT,
  check: process.argv.includes('--check'),
  staleMsg: `docs:effects — ${OUT} est PÉRIMÉ (diverge du type Effect de ${SRC}).`,
  rerunMsg: '  → relancer `npm run docs:effects` et committer le résultat.',
  okMsg: `docs:effects — OK (${OUT} à jour, ${merged.length} Effects)`,
  writeMsg: `${OUT} — ${merged.length} Effects (${rawCount} membres d'union avant fusion).`,
})
