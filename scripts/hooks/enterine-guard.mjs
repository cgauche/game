// Hook PreToolUse(Write|Edit) : le tag `[entériné AAAA-MM-JJ]` est RÉSERVÉ à l'utilisateur (credo,
// règle 6b) — toute écriture qui l'INTRODUIT exige sa confirmation explicite : ce dialogue EST la
// validation. Opposable aux sessions ET aux sous-agents (aucune mémoire/discipline requise).
let raw = ''
process.stdin.setEncoding('utf8')
for await (const chunk of process.stdin) raw += chunk

let input = null
try { input = JSON.parse(raw)?.tool_input ?? null } catch { /* stdin illisible → silence */ }

const TAG = /\[entériné[^\]]*\]/i
// Write : tout `content` qui porte le tag. Edit : seulement si new_string l'INTRODUIT (absent
// d'old_string) — re-sauver un fichier qui portait déjà un tag validé ne redemande rien.
const introduces = input && (
  (typeof input.content === 'string' && TAG.test(input.content)) ||
  (typeof input.new_string === 'string' && TAG.test(input.new_string) && !TAG.test(String(input.old_string ?? '')))
)

if (introduces) {
  console.log(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'ask',
      permissionDecisionReason:
        `⚠ Cette écriture INTRODUIT un tag [entériné] — mot RÉSERVÉ à l'utilisateur (credo 6b : ` +
        `« sans validation utilisateur explicite et traçable »). Confirmer ce dialogue VAUT validation ` +
        `pour CE site précis ; refuser si l'arbitrage n'a pas été rendu par l'utilisateur lui-même.`,
    },
  }))
}
