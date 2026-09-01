// SONDE (lecture seule) — `docs/systemes.md` et CLAUDE.md : octets et occurrences de « réflexe ».
// Usage : node scripts/ops/sondes/audit-2026-09-01/p11-artefacts.mjs

import fs from 'fs';const root=RACINE + '/';
import { RACINE } from './_socle.mjs';

const s=fs.readFileSync(root+'docs/systemes.md','utf8');
console.log('systemes.md octets',s.length);console.log(s.split(/\r?\n/).slice(0,25).join('\n'));
console.log('--- occurrences "réflexe" dans systemes.md:',(s.match(/réflexe/gi)||[]).length);
const cl=fs.readFileSync(root+'CLAUDE.md','utf8');console.log('CLAUDE.md octets',cl.length);
