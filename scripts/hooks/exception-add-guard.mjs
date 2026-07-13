// Hook PreToolUse(Write|Edit) : les TABLES D'EXCEPTIONS/WHITELISTS des gardes ne grossissent
// JAMAIS sans l'utilisateur (demande du 2026-07-13) — toute écriture qui AJOUTE une entrée à une
// table d'exceptions de garde, ou qui AUGMENTE une baseline de cliquet, exige sa confirmation
// explicite. Les re-pointages (clé remplacée, compte constant) et les RETRAITS passent sans
// friction. Opposable aux sessions ET aux sous-agents.
import { readFileSync } from 'node:fs'

let raw = ''
process.stdin.setEncoding('utf8')
for await (const chunk of process.stdin) raw += chunk

let input = null
try { input = JSON.parse(raw)?.tool_input ?? null } catch { /* stdin illisible → silence */ }
if (!input) process.exit(0)

const file = String(input.file_path ?? input.path ?? '')
// Fichiers porteurs de tables d'exceptions/baselines : les gardes-tests connus + toute lib de
// scripts/guards (whitelists) + tout futur *-guard.test.ts (couverture par motif, pas par liste figée).
const GUARDED = /(label-logic-guard\.test\.ts|ui-ratchets\.test\.ts|component-conformance\.test\.ts|no-emoji-affordance\.test\.ts|comment-poison-guard\.test\.ts|[\\/]scripts[\\/]guards[\\/]|-guard\.test\.tsx?$)/
if (!GUARDED.test(file)) process.exit(0)

// « Ancien » vs « nouveau » : Edit compare ses deux extraits ; Write compare le contenu proposé au
// fichier sur disque (fichier absent → tout est ajout).
let before = ''
let after = ''
if (typeof input.new_string === 'string') {
  before = String(input.old_string ?? '')
  after = input.new_string
} else if (typeof input.content === 'string') {
  after = input.content
  try { before = readFileSync(file, 'utf8') } catch { before = '' }
} else process.exit(0)

/** Multiset des entrées « de table » d'un extrait : clés de map quotées (`'x': …`) + items de
 *  tableau quotés seuls sur leur ligne (`'x',`). */
function entries(text) {
  const bag = new Map()
  const add = (k) => bag.set(k, (bag.get(k) ?? 0) + 1)
  for (const m of text.matchAll(/(['"])((?:(?!\1)[^\n])+)\1\s*:/g)) add(m[2])
  for (const m of text.matchAll(/^\s*(['"])((?:(?!\1)[^\n])+)\1\s*,?\s*$/gm)) add(m[2])
  return bag
}
/** Paires clé quotée → nombre (baselines de cliquet). Dernière occurrence gagne. */
function baselines(text) {
  const map = new Map()
  for (const m of text.matchAll(/(['"])((?:(?!\1)[^\n])+)\1\s*:\s*(\d+)/g)) map.set(m[2], Number(m[3]))
  return map
}

const beforeBag = entries(before)
const afterBag = entries(after)
let added = []
const removed = []
for (const [k, n] of afterBag) if (n > (beforeBag.get(k) ?? 0)) added.push(k)
for (const [k, n] of beforeBag) if (n > (afterBag.get(k) ?? 0)) removed.push(k)
// RE-POINTAGE (clé `chemin:ligne` dont seule la ligne bouge, un retrait apparié) ≠ ajout : le
// décalage de lignes est le quotidien des refactors, il ne demande rien.
const stem = (k) => { const m = /^(.*):\d+$/.exec(k); return m ? m[1] : null }
const removedStems = removed.map(stem).filter(Boolean)
added = added.filter((k) => {
  const s = stem(k)
  const i = s ? removedStems.indexOf(s) : -1
  if (i === -1) return true
  removedStems.splice(i, 1) // un retrait n'apparie qu'UN ajout
  return false
})

const beforeBase = baselines(before)
const afterBase = baselines(after)
const raised = []
for (const [k, n] of afterBase) {
  const prev = beforeBase.get(k)
  if (prev != null && n > prev) raised.push(`${k} : ${prev} → ${n}`)
}
// Une hausse de baseline est AUSSI comptée comme « entrée ajoutée » par le multiset quand la clé
// est nouvelle — dédoublonne : une clé signalée en hausse n'est pas re-signalée en ajout.
const raisedKeys = new Set(raised.map((r) => r.split(' : ')[0]))
const netAdded = added.filter((k) => !raisedKeys.has(k))

if (netAdded.length === 0 && raised.length === 0) process.exit(0)

const parts = []
if (netAdded.length) parts.push(`AJOUT d'exception(s)/entrée(s) de garde : ${netAdded.slice(0, 5).join(' · ')}${netAdded.length > 5 ? ` (+${netAdded.length - 5})` : ''}`)
if (raised.length) parts.push(`HAUSSE de baseline (cliquet à rebours) : ${raised.slice(0, 5).join(' · ')}`)

console.log(JSON.stringify({
  hookSpecificOutput: {
    hookEventName: 'PreToolUse',
    permissionDecision: 'ask',
    permissionDecisionReason:
      `⚠ ${file.split(/[\\/]/).pop()} — ${parts.join(' ; ')}. Les tables d'exceptions des gardes ne ` +
      `grossissent qu'avec l'AUTORISATION de l'utilisateur (demande 2026-07-13) : confirmer ce dialogue ` +
      `VAUT autorisation pour CES entrées précises ; refuser sinon (re-pointages et retraits passent seuls).`,
  },
}))
