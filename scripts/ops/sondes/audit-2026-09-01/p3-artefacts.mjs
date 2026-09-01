// SONDE (lecture seule) — mémoire : fiches CITÉES par un commit POSTÉRIEUR à leur création.
// Usage : node scripts/ops/sondes/audit-2026-09-01/p3-artefacts.mjs

import {execFileSync} from 'child_process';import fs from 'fs';
import path from 'path';
import { RACINE } from './_socle.mjs';

const root=RACINE;
const g=a=>{try{return execFileSync('git',a,{cwd:root,maxBuffer:1e9}).toString();}catch{return '';}};
const memdir=path.join(root,'.claude/memory');
const files=fs.readdirSync(memdir).filter(f=>f.endsWith('.md')&&f!=='MEMORY.md');
const res=[];
for(const f of files){const slug=f.replace(/\.md$/,'');
 const add=g(['log','--diff-filter=A','--format=%ad','--date=short','--','.claude/memory/'+f]).trim().split('\n').pop();
 const men=g(['log','--format=%ad %h','--date=short','--grep='+slug]).trim();
 if(!men)continue;
 const lines=men.split('\n');
 const later=lines.filter(l=>add&&l.slice(0,10)>add);
 if(later.length)res.push({slug,add,later:later.length,ex:later[0]});
}
res.sort((a,b)=>b.later-a.later);
console.log('fiches citees dans commit POSTERIEUR:',res.length);
for(const r of res.slice(0,25))console.log(r.later+'x '+r.slug+' (creee '+r.add+', ex '+r.ex+')');
