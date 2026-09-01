// SONDE (lecture seule) — contournabilité du garde de labels (`issue-label-guard`) : dix formes d'émission confrontées à son évaluateur RÉEL.
// Usage : node scripts/ops/sondes/audit-2026-09-01/sonde-bypass.mjs

import { evaluate } from '../../../hooks/issue-label-guard.mjs'

// SONDE (lecture seule) : le détecteur `gh issue create` du garde de labels — donc TOUT garde
// d'émission bâti sur le même tokenizer (proposition P2-d) — est-il contournable ?
const cas = [
  ['direct (témoin, doit DENY)',            'gh issue create --title "x" --body "y"'],
  ['sh -c',                                 `sh -c "gh issue create --title x --body y"`],
  ['bash -lc',                              `bash -lc 'gh issue create --title x'`],
  ['powershell -Command',                   `powershell -Command "gh issue create --title x"`],
  ['gh api REST',                           `gh api -X POST /repos/cgauche/game/issues -f title=x`],
  ['gh api graphql mutation',               `gh api graphql -f query='mutation{createIssue(input:{repositoryId:"R",title:"x"}){issue{number}}}'`],
  ['script committé qui appelle gh',        `node scripts/tmp-open.mjs`],
  ['npm script',                            `npm run open-ticket`],
  ['xargs',                                 `echo x | xargs -I{} gh issue create --title {}`],
  ['env var indirection',                   `$GH issue create --title x`],
]
for (const [nom, cmd] of cas) {
  const d = evaluate(cmd)
  console.log((d ? 'DENY  ' : 'PASSE ') + nom + '  ::  ' + cmd.slice(0, 70))
}
