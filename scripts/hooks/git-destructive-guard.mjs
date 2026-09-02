// Hook PreToolUse(Bash|PowerShell|mcp__lean-ctx__ctx_shell) : l'arbre est PARTAGÉ entre sessions
// parallèles — toute commande git destructive (qui peut effacer du WIP non commité) exige une
// confirmation humaine explicite, et tout LIEN posé sur un `node_modules` est REFUSÉ (#1679 L1c).
//
// Détection STRUCTURELLE (jamais un grep de sous-chaîne sur la ligne entière) : on réutilise le
// tokenizer quote-aware de `solde-ticket-guard` (`segmentsProfonds`/`gitSubcommand`, invariant
// partagé) — sans lui, `Write-Output "git stash"` ou un message de commit citant `git reset --hard`
// déclenchaient un `ask` sur une commande qui n'exécute rien (faux positif mesuré 2026-08-03).
import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'
import { segmentsProfonds, gitSubcommand, valeurParametre } from './solde-ticket-guard.mjs'

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

/** Nom d'exécutable d'un segment : basename sans extension, en minuscules (call-operator sauté). */
function executableDe(segment) {
  const start = segment[0] === '&' ? 1 : 0
  if (segment.length <= start) return { exe: '', args: [] }
  const exe = segment[start].replace(/\\/g, '/').split('/').pop().replace(/\.(exe|cmd|bat)$/i, '').toLowerCase()
  return { exe, args: segment.slice(start + 1) }
}

/** Paramètres de `New-Item` (propres + communs) avec lesquels un préfixe pourrait être AMBIGU. */
const PARAMS_NEW_ITEM = [
  'ItemType', 'Path', 'Name', 'Value', 'Force', 'Credential', 'WhatIf', 'Confirm', 'UseTransaction',
  'Verbose', 'Debug', 'ErrorAction', 'ErrorVariable', 'WarningAction', 'WarningVariable',
  'InformationAction', 'InformationVariable', 'OutVariable', 'OutBuffer', 'PipelineVariable',
]

/** `mklink` est un BUILTIN de `cmd` : derrière `cmd /c`, l'exécutable du segment est `cmd`, et le
 *  reste de la ligne (chaînée par `&`/`;`, quotée ou non) porte l'invocation. On la lit sur les
 *  arguments RECOLLÉS — une chaîne quotée en un seul token la porte tout entière. */
const MKLINK_APRES_CMD_RE = /(?:^|[\s&;|("'])mklink(?=$|[\s"'])/i
const MKLINK_FLAG_RE = /(?:^|[\s"'])\/[jdh](?=$|[\s"'])/i

/**
 * Libellé du LIEN posé par ce segment sur un `node_modules`, ou `null`.
 * Trois graphies, une seule règle : `New-Item -ItemType Junction|SymbolicLink|HardLink` (PowerShell),
 * `mklink /J|/D|/H` (cmd, en direct ou derrière `cmd /c`), `ln -s` (POSIX) — dès qu'un des chemins
 * nomme `node_modules`.
 */
function lienNodeModules(segment) {
  const { exe, args } = executableDe(segment)
  let forme
  if (exe === 'new-item' || exe === 'ni') {
    const type = valeurParametre(args, 'ItemType', PARAMS_NEW_ITEM)
    if (!/^(junction|symboliclink|hardlink)$/i.test(type)) return null
    forme = `New-Item -ItemType ${type}`
  } else if (exe === 'mklink') {
    if (!args.some((a) => /^\/[jdh]$/i.test(a))) return null
    forme = 'mklink'
  } else if (exe === 'cmd') {
    const suite = args.join(' ')
    if (!MKLINK_APRES_CMD_RE.test(suite) || !MKLINK_FLAG_RE.test(suite)) return null
    forme = 'cmd /c mklink'
  } else if (exe === 'ln') {
    if (!args.some((a) => /^-[a-zA-Z]*s/.test(a))) return null
    forme = 'ln -s'
  } else {
    return null
  }
  return args.some((a) => /node_modules/i.test(a)) ? forme : null
}

/**
 * Décision du hook (PURE, testable). `null` = silence ; `{ decision, reason }` sinon — `ask` pour un
 * git destructif (l'humain arbitre), `deny` pour un lien sur `node_modules` (aucun cas légitime).
 * Une commande est visée si l'un de ses SEGMENTS PROFONDS (enchaînements, enrobeurs de tête,
 * sous-shells) l'exécute réellement.
 */
export function evaluate(command) {
  if (!command) return null
  for (const segment of segmentsProfonds(command)) {
    const lien = lienNodeModules(segment)
    if (lien) {
      return {
        decision: 'deny',
        reason:
          `⛔ Lien sur un node_modules REFUSÉ (${lien}, #1679 L1c) : supprimer le lien plus tard strippe ` +
          `le node_modules PARTAGÉ qu'il vise (Remove-Item/rm suivent la jonction et vident la cible), ` +
          `et un arbre qui emprunte les dépendances d'un autre ne prouve rien de ses propres versions. ` +
          `Poser un "npm ci" PROPRE dans l'arbre.`,
      }
    }
    const git = gitSubcommand(segment)
    if (!git) continue
    const what = destructiveReason(git)
    if (!what) continue
    return {
      decision: 'ask',
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
        permissionDecision: decision.decision ?? 'ask',
        permissionDecisionReason: decision.reason,
      },
    }))
  }
  process.exit(0)
}
