// Hook PreToolUse (canaux shell) : un `tsc --noEmit` NU coûte ~42-51 s mesurés, là où le
// typecheck incrémental du dépôt coûte ~7 s à chaud. Rappel DOUX (aucun blocage, aucune décision) :
// le hook n'émet qu'un contexte additionnel quand la commande contourne `npm run typecheck:fast`.
// Le rappel se déclenche sur un APPEL de `tsc`, jamais sur une commande qui MENTIONNE le motif :
// le segment doit COMMENCER par l'exécutable (éventuellement `npx `/`node ` et son chemin), et les
// lecteurs de texte (grep, cat…) sont écartés d'emblée.
const LECTEURS = /^(?:grep|rg|cat|echo|type|findstr|Select-String|sed|awk|head|tail)\b/i
const APPEL_TSC = /^(?:npx\s+|node\s+)?(?:\S*[\\/])?tsc(?:\.cmd|\.js)?(?=\s|$)/

function appelleTscNu(commande) {
  return commande
    .split(/[|&;\n]+/)
    .map((segment) => segment.trim())
    .some(
      (segment) =>
        !LECTEURS.test(segment) && APPEL_TSC.test(segment) && /--noEmit\b/.test(segment),
    )
}

let brut = ''
process.stdin.resume()
process.stdin.on('data', (morceau) => {
  brut += morceau
})
process.stdin.on('end', () => {
  let commande = ''
  try {
    commande = String(JSON.parse(brut || '{}').tool_input?.command ?? '')
  } catch {
    commande = ''
  }

  const tscNu = appelleTscNu(commande)
  const dejaRapide = /typecheck:fast|typecheck-fast\.mjs/.test(commande)
  if (!tscNu || dejaRapide) {
    process.exit(0)
  }

  process.stdout.write(
    JSON.stringify({
      suppressOutput: true,
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        additionalContext:
          '[RAPPEL — runner] Ce dépôt a `npm run typecheck:fast` : incrémental ~7 s (cache ' +
          'node_modules/.cache/typecheck.tsbuildinfo), sortie COMPLÈTE écrite dans ' +
          'node_modules/.cache/typecheck-last.txt et toutes les erreurs listées — le `tsc --noEmit` ' +
          'nu coûte ~42 s. La porte de vérité full reste `npm run typecheck`.',
      },
    }) + '\n',
  )
})
