// Hook PreToolUse(Write|Edit) : rappel de GROUNDING quand une donnée app-owned (src/data/*.json) est
// éditée. Non bloquant — injecte du contexte (le hard-gate reste `npm test`). Atteint aussi les
// SOUS-AGENTS, où les skills ne se déclenchent jamais. Motivé par l'incident #148 (doublon « Bélier »).
let raw = ''
process.stdin.setEncoding('utf8')
for await (const chunk of process.stdin) raw += chunk

let fp = ''
try { fp = String(JSON.parse(raw)?.tool_input?.file_path ?? '') } catch { /* stdin illisible → silence */ }

const norm = fp.replace(/\\/g, '/')
const isData = /(^|\/)src\/data\/[^/]+\.json$/.test(norm)

if (isData) {
  const rel = norm.slice(norm.indexOf('src/data/'))
  const lines = [
    `⚠ Donnée app-owned éditée (${rel}). AVANT d'écrire — cf. incident #148 (doublon « Bélier ») :`,
    `1. CHECK-FIRST : grep l'id, le label ET le concept dans TOUT src/data/*.json — un concept vit peut-être déjà dans un autre sous-système (le Bélier existe dans 6 fichiers).`,
    `2. docs/donnees.md = carte « où va chaque donnée » + conventions (book, page, formes). Une « machine de guerre / véhicule / navire » n'est PAS un trapping.`,
    `3. Sort / créature / effet mécanique / icône / livre → utilise le skill de domaine dédié.`,
    `4. Chaque champ = Source RAW (en-tête de table incluse) ⊕ convention des entrées voisines. Zéro inflexion RAW silencieuse (issue #101+ ou valeur « maison » taguée).`,
    `5. Après édition : canonicaliser via serializeDataset, puis npm test (serialize, no-html-in-prose, id-collisions) + npm run typecheck.`,
  ]
  console.log(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      additionalContext: lines.join('\n'),
    },
  }))
}
