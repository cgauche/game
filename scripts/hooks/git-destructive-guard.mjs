// Hook PreToolUse(Bash|PowerShell) : l'arbre est PARTAGÉ entre sessions parallèles — toute commande
// git destructive (qui peut effacer du WIP non commité) exige une confirmation humaine explicite.
let raw = ''
process.stdin.setEncoding('utf8')
for await (const chunk of process.stdin) raw += chunk

let cmd = ''
try { cmd = String(JSON.parse(raw)?.tool_input?.command ?? '') } catch { /* stdin illisible → silence */ }

const DESTRUCTIVE = [
  /git\s+checkout\s+(--\s|\.\s*$|.*\s--\s)/,          // checkout -- <paths> / checkout .
  /git\s+restore\s+(?!.*--staged)/,                    // restore worktree (sans --staged)
  /git\s+reset\s+--hard/,
  /git\s+clean\s+-\w*[fdx]/,
  /git\s+stash(?!\s+(list|show))/,                     // stash/pop/drop/clear (list/show = lecture)
  /git\s+push\s+.*(--force|\s-f\b)/,
]

if (cmd && DESTRUCTIVE.some((re) => re.test(cmd))) {
  console.log(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'ask',
      permissionDecisionReason:
        `⚠ Arbre PARTAGÉ multi-sessions : commande git DESTRUCTIVE détectée. Les fichiers visés peuvent ` +
        `porter le WIP vivant d'une AUTRE session (near-miss documenté : #126 a failli écraser le travail ` +
        `de la session parallèle par mauvaise attribution du diff). Vérifie l'attribution (git log, contenu) ` +
        `avant de confirmer.`,
    },
  }))
}
