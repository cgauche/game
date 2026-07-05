// Hook PreToolUse(Write) : rappel anti-réinvention quand un NOUVEAU fichier va être créé sous src/.
// Non bloquant — injecte du contexte, ne décide pas de la permission.
import { existsSync } from 'node:fs'

let raw = ''
process.stdin.setEncoding('utf8')
for await (const chunk of process.stdin) raw += chunk

let fp = ''
try { fp = String(JSON.parse(raw)?.tool_input?.file_path ?? '') } catch { /* stdin illisible → silence */ }

const norm = fp.replace(/\\/g, '/')
const inSrc = /(^|\/)src\//.test(norm)

if (fp && inSrc && !existsSync(fp)) {
  console.log(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      additionalContext:
        `⚠ Ce Write CRÉE un nouveau fichier sous src/ (${norm.slice(norm.indexOf('src/'))}). ` +
        `Réflexe anti-réinvention : as-tu vérifié la table « Primitives partagées » du CLAUDE.md et grep 2-3 variantes du concept dans l'existant ? ` +
        `Si un module/primitive existant couvre le besoin, RÉUTILISE-le ou ÉTENDS-le (général + paramétrable) au lieu de créer ce fichier. ` +
        `Sinon, énonce explicitement pourquoi aucun existant ne convient avant de poursuivre.`,
    },
  }))
}
