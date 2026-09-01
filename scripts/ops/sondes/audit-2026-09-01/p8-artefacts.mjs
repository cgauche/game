// SONDE (lecture seule) — hooks git : inventaire de `scripts/git-hooks` et lignes du pre-commit nommant une porte.
// Usage : node scripts/ops/sondes/audit-2026-09-01/p8-artefacts.mjs

import fs from 'fs';
import path from 'path';
import { RACINE } from './_socle.mjs';

const root=RACINE;
const h=path.join(root,'scripts/git-hooks');
console.log(fs.readdirSync(h).join(', '));
const pc=fs.readFileSync(path.join(h,'pre-commit.mjs'),'utf8');
console.log('pre-commit octets',pc.length);
console.log(pc.split(/\r?\n/).filter(l=>/claude|memory|gate|GATES|name:/i.test(l)).slice(0,60).join('\n'));
