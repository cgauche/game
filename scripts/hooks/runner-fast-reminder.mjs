// Hook PreToolUse (canaux shell) : un `tsc --noEmit` NU coûte ~42-51 s mesurés, là où le
// typecheck incrémental du dépôt coûte ~7 s à chaud ; un `vitest run` direct perd la capture en
// fichier et les bornes de charge du lanceur `npm test`. Rappel DOUX (aucun blocage, aucune
// décision) : le hook n'émet qu'un contexte additionnel quand la commande contourne la porte du
// dépôt. Le rappel se déclenche sur un APPEL, jamais sur une commande qui MENTIONNE le motif :
// le segment doit COMMENCER par l'exécutable (éventuellement `npx `/`node ` et son chemin), et les
// lecteurs de texte (grep, cat…) sont écartés d'emblée.
const LECTEURS = /^(?:grep|rg|cat|echo|type|findstr|Select-String|sed|awk|head|tail)\b/i
const APPEL_TSC = /^(?:npx\s+|node\s+)?(?:\S*[\\/])?tsc(?:\.cmd|\.js)?(?=\s|$)/
const APPEL_VITEST = /^(?:npx\s+|node\s+)?(?:\S*[\\/])?vitest(?:\.cmd|\.mjs|\.js)?(?=\s|$)/
// Modes où la capture en fichier n'a pas de sens : run interactif, sortie non composée d'un bilan.
const DRAPEAUX_HORS_CAPTURE = /(?:^|\s)(?:--watch|-w|--ui|--version)(?=\s|$)/
const SOUS_COMMANDES_HORS_CAPTURE = new Set(['list', 'bench'])

const segmenter = (commande) => commande.split(/[|&;\n]+/).map((segment) => segment.trim())

// Le sous-projet `server/` a son propre tsconfig : le typecheck racine n'y répond pas. Les deux
// façons d'y entrer n'ont PAS la même portée, et c'est le SEGMENT qui la porte :
//   `cd server` change le répertoire du shell — tout ce qui SUIT est dans le sous-projet (reporté) ;
//   `--prefix server` ne vaut que pour l'appel npm qui le porte — le segment suivant est à la RACINE.
// Évaluer ces marqueurs sur la commande ENTIÈRE masquait un vrai appel :
// `npm --prefix server run typecheck && tsc --noEmit` taisait le `tsc` RACINE du second segment.
const VERS_SERVER = /^cd\s+(\S+)/
const EST_SERVER = /(?:^|[\\/])server[\\/]?$/
const PREFIX_SERVER = /--prefix\s+server\b/
// Portes du dépôt : un segment qui les emprunte DÉJÀ n'a rien à se voir rappeler. Test par SEGMENT
// là encore — `npm test && npx vitest run src/ui` n'émettait rien sur la commande entière.
const PORTE_TYPECHECK = /typecheck:fast|typecheck-fast\.mjs/
const PORTE_VITEST = /\bnpm\s+(?:run\s+)?test\b|scripts[\\/]test[\\/]run\.mjs/

function appelleTscNu(commande) {
  let dansServer = false
  for (const segment of segmenter(commande)) {
    const cd = segment.match(VERS_SERVER)
    if (cd) {
      dansServer = EST_SERVER.test(cd[1])
      continue
    }
    if (dansServer || PREFIX_SERVER.test(segment)) continue
    if (LECTEURS.test(segment) || PORTE_TYPECHECK.test(segment)) continue
    if (APPEL_TSC.test(segment) && /--noEmit\b/.test(segment)) return true
  }
  return false
}

function appelleVitestNu(commande) {
  return segmenter(commande).some((segment) => {
    if (LECTEURS.test(segment) || PORTE_VITEST.test(segment)) return false
    if (!APPEL_VITEST.test(segment)) return false
    if (DRAPEAUX_HORS_CAPTURE.test(segment)) return false
    const premier = segment.replace(APPEL_VITEST, '').trim().split(/\s+/)[0] ?? ''
    return !SOUS_COMMANDES_HORS_CAPTURE.has(premier)
  })
}

let brut = ''
process.stdin.resume()
process.stdin.on('data', (morceau) => {
  brut += morceau
})
process.stdin.on('end', () => {
  let commande
  try {
    commande = String(JSON.parse(brut || '{}').tool_input?.command ?? '')
  } catch {
    commande = ''
  }

  const conseils = []
  if (appelleTscNu(commande)) {
    conseils.push(
      '[RAPPEL — runner] Ce dépôt a `npm run typecheck:fast` : incrémental ~7 s (cache ' +
        'node_modules/.cache/typecheck.tsbuildinfo), sortie COMPLÈTE écrite dans ' +
        'node_modules/.cache/typecheck-last.txt et toutes les erreurs listées — le `tsc --noEmit` ' +
        'nu coûte ~42 s. La porte de vérité full reste `npm run typecheck`.',
    )
  }
  if (appelleVitestNu(commande)) {
    conseils.push(
      '[RAPPEL — runner] Ce dépôt a un lanceur de suite : préfère `npm test -- <chemins>` ' +
        '(capture en fichier + bornes de charge) — la sortie complète part dans ' +
        'node_modules/.cache/vitest-run-<pid>.txt, en-tête et `status:` compris.',
    )
  }
  if (!conseils.length) {
    process.exit(0)
  }

  process.stdout.write(
    JSON.stringify({
      suppressOutput: true,
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        additionalContext: conseils.join('\n'),
      },
    }) + '\n',
  )
})
