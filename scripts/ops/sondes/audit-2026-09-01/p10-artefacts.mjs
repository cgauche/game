// SONDE (lecture seule) — mémoire : champ `type` du frontmatter — absent, contredisant le préfixe de fichier, valeurs, mentions SUPERSEDE.
// Usage : node scripts/ops/sondes/audit-2026-09-01/p10-artefacts.mjs

import fs from 'fs';
import path from 'path';
import { RACINE } from './_socle.mjs';

const memdir=RACINE + '/.claude/memory';
const files=fs.readdirSync(memdir).filter(f=>f.endsWith('.md')&&f!=='MEMORY.md');
let contra=0,noType=0;const vals={};
for(const f of files){const t=fs.readFileSync(path.join(memdir,f),'utf8');
 const m=t.match(/^\s*type:\s*(\S+)/m);if(!m){noType++;continue;}
 vals[m[1]]=(vals[m[1]]||0)+1;
 const pref=f.split('-')[0];
 const map={feedback:'feedback',game:'game',user:'user',env:'env',project:'project',credo:'feedback',index:'project'};
 if((map[pref]||pref)!==m[1])contra++;}
console.log('fiches',files.length,'sans champ type',noType,'type != prefixe',contra,'=',(100*contra/files.length).toFixed(0)+'%');
console.log('valeurs de type:',JSON.stringify(vals));
// SUPERSEDE deja present ?
let sup=0;for(const f of files){if(/SUPERS[EÉ]D/i.test(fs.readFileSync(path.join(memdir,f),'utf8')))sup++;}
console.log('fiches contenant SUPERSEDE:',sup);
