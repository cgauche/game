// Hook PreToolUse(Bash|PowerShell|mcp__lean-ctx__ctx_shell) : REFUSE toute création de ticket
// GitHub sans label.
// Constat utilisateur (2026-07-22) : « les labels sont sous-exploités par les agents/orchestrateur ».
// La doctrine (credo : « les LABELS sont l'index du backlog ») ne suffit pas — on la rend MÉCANIQUE :
// un `gh issue create`/`gh issue new` sans option de label (`--label`/`-l`) est bloqué avant exécution.
// Pendant du garde `solde-ticket-guard` (fermeture sans solde) : même contrat de sortie deny.
//
// Robustesse : on ne fait PAS un grep de sous-chaîne (`gh issue create` cité dans un `--body`/un `echo`
// mordrait à tort) — on réutilise le TOKENIZER quote-aware de `solde-ticket-guard` (`splitCommandSegments`,
// invariant partagé, jamais redupliqué) puis on détecte STRUCTURELLEMENT l'exécutable `gh` + la
// sous-commande `issue create|new` (tokens `issue` puis `create`/`new` ADJACENTS après l'exe `gh`).
import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'
import { splitCommandSegments } from './solde-ticket-guard.mjs'

/** Un token porte-t-il une option de label ? (`--label`, `--label=X`, `-l`, `-lX` glué) */
export const isLabelFlag = (t) => /^--label(=|$)/.test(t) || /^-l/.test(t)

/** Le SEGMENT exécute-t-il `gh issue create|new` ? Exe de tête = `gh` (basename, `.exe`/`.cmd` et un
 *  `&` call-operator PowerShell tolérés), puis les tokens `issue` immédiatement suivi de `create`/`new`
 *  (adjacence : robuste à un flag global à valeur intercalé, ex. `gh -R owner/repo issue create`). */
export function isGhIssueCreateSegment(segment) {
  const start = segment[0] === '&' ? 1 : 0
  if (segment.length <= start) return false
  const exe = segment[start].replace(/\\/g, '/').split('/').pop().replace(/\.(exe|cmd)$/i, '').toLowerCase()
  if (exe !== 'gh') return false
  for (let i = start + 1; i < segment.length - 1; i++) {
    if (segment[i] === 'issue' && (segment[i + 1] === 'create' || segment[i + 1] === 'new')) return true
  }
  return false
}

/**
 * Décision du hook (PURE, testable). `null` = silence (commande autorisée) ; `{ reason }` = deny.
 * Une commande qui, dans un quelconque de ses segments (enchaînements `&&`/`;`/`||`/`|`), exécute
 * `gh issue create|new` SANS aucune option de label est refusée.
 */
export function evaluate(command) {
  if (!command) return null
  for (const segment of splitCommandSegments(command)) {
    if (!isGhIssueCreateSegment(segment)) continue
    if (segment.some(isLabelFlag)) continue
    return {
      reason:
        '⚠ Création de ticket SANS label refusée (credo : « les LABELS sont l\'index du backlog », ' +
        'gabarit #101+). Ajouter au moins un `--label` couvrant les axes pertinents : ' +
        '`livre:<source>` · `domaine:<naval|magie|combat|économie|art|coop|campagne|UX|moteur-pur|' +
        'primitives-UI|religion|maladie>` · `type:<donnée|système|règle-optionnelle>` · ' +
        '`sev:<majeur|mineur|smell>` · `audit:<contenu-manquant|non-branché|principe>` · le ' +
        '`chantier:*`/`campagne:*` s\'il existe. Vocabulaire canonique : `gh label list` — créer le ' +
        'label manquant (`gh label create`) plutôt que forcer un voisin inexact. Et AVANT de créer : ' +
        'dédupliquer PAR LABEL (`gh issue list --state all --label livre:X --label domaine:Y`).',
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
        permissionDecision: 'deny',
        permissionDecisionReason: decision.reason,
      },
    }))
  }
  process.exit(0)
}
