// SONDE (lecture seule) — agents de `.claude/agents` : modèle et effort déclarés au frontmatter.
// Usage : node scripts/ops/sondes/audit-2026-09-01/p13-artefacts.mjs

import fs from 'fs';
import path from 'path';
import { RACINE } from './_socle.mjs';

const d=RACINE + '/.claude/agents';
for(const f of fs.readdirSync(d)){const t=fs.readFileSync(path.join(d,f),'utf8');
 const fm=t.split('---')[1]||'';
 const m=(fm.match(/model:\s*\S+/)||[''])[0],e=(fm.match(/effort:\s*\S+/)||[''])[0];
 console.log(f.padEnd(28)+m.padEnd(18)+e);}
