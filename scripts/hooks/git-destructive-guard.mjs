// Hook PreToolUse(Bash|PowerShell|mcp__lean-ctx__ctx_shell) : l'arbre est PARTAGÉ entre sessions
// parallèles — toute commande git destructive (qui peut effacer du WIP non commité) exige une
// confirmation humaine explicite.
//
// Détection STRUCTURELLE (jamais un grep de sous-chaîne sur la ligne entière) : on réutilise le
// tokenizer quote-aware de `solde-ticket-guard` (`splitCommandSegments`/`gitSubcommand`, invariant
// partagé) — sans lui, `Write-Output "git stash"` ou un message de commit citant `git reset --hard`
// déclenchaient un `ask` sur une commande qui n'exécute rien (faux positif mesuré 2026-08-03).
import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'
import { splitCommandSegments, gitSubcommand } from './solde-ticket-guard.mjs'

/** Une option courte parmi `letters` est-elle présente (isolée ou groupée : `-fd`, `-fdx`) ? */
const hasShortFlag = (args, letters) =>
  args.some((a) => /^-[a-zA-Z]+$/.test(a) && [...a.slice(1)].some((c) => letters.includes(c)))

/** `{ sub, args }` d'un `git` → libellé de la destructivité, ou `null`. */
function destructiveReason({ sub, args }) {
  switch (sub) {
    // `git checkout -- <paths>` / `git checkout .` : écrase l'arbre de travail.
    case 'checkout':
      return args.includes('--') || args.includes('.') ? 'git checkout de fichiers' : null
    // `--staged` seul ne touche que l'index ; sans lui, l'arbre de travail est écrasé.
    case 'restore':
      return args.includes('--staged') ? null : "git restore de l'arbre de travail"
    case 'reset':
      return args.includes('--hard') ? 'git reset --hard' : null
    case 'clean':
      return hasShortFlag(args, 'fdx') || args.some((a) => /^--(force|d)$/.test(a)) ? 'git clean' : null
    // `stash list`/`stash show` sont des LECTURES ; tout le reste déplace ou détruit du WIP.
    case 'stash':
      return args[0] === 'list' || args[0] === 'show' ? null : 'git stash'
    case 'push':
      return args.some((a) => a === '-f' || /^--force(-with-lease)?(=|$)/.test(a)) ? 'git push --force' : null
    default:
      return null
  }
}

/**
 * Décision du hook (PURE, testable). `null` = silence ; `{ reason }` = ask.
 * Une commande est destructive si l'un de ses SEGMENTS exécute réellement un git destructif.
 */
export function evaluate(command) {
  if (!command) return null
  for (const segment of splitCommandSegments(command)) {
    const git = gitSubcommand(segment)
    if (!git) continue
    const what = destructiveReason(git)
    if (!what) continue
    return {
      reason:
        `⚠ Arbre PARTAGÉ multi-sessions : commande git DESTRUCTIVE détectée (${what}). Les fichiers ` +
        `visés peuvent porter le WIP vivant d'une AUTRE session (near-miss documenté : #126 a failli ` +
        `écraser le travail de la session parallèle par mauvaise attribution du diff). Vérifie ` +
        `l'attribution (git log, contenu) avant de confirmer.`,
    }
  }
  return null
}

// ── Driver stdin (n'exécute QUE lancé en direct, jamais à l'import du module de test) ─────────────
const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isMain) {
  let raw = ''
  process.stdin.setEncoding('utf8')
  for await (const chunk of process.stdin) raw += chunk
  let command = ''
  try { command = String(JSON.parse(raw)?.tool_input?.command ?? '') } catch { /* stdin illisible → silence */ }
  const decision = evaluate(command)
  if (decision) {
    console.log(JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision: 'ask',
        permissionDecisionReason: decision.reason,
      },
    }))
  }
  process.exit(0)
}
