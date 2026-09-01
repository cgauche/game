// SONDE (lecture seule) — garde de labels : quatre formes d'ouverture de ticket (témoin court de `sonde-bypass.mjs`).
// Usage : node scripts/ops/sondes/audit-2026-09-01/probe-label.mjs

import { evaluate } from '../../../hooks/issue-label-guard.mjs'

const cases = [
  'gh issue create -t X -b Y',
  'gh api -X POST repos/cgauche/game/issues -f title=X -f body=Y',
  'gh api repos/cgauche/game/issues --method POST --input i.json',
  'gh issue create --title X --body Y --label domaine:UX',
]
for (const c of cases) console.log((evaluate(c) ? 'DENY ' : 'ALLOW'), c)
