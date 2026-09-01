// SONDE (lecture seule) — MEMORY.md : lignes, liens, échantillon déterministe de quinze liens `feedback-*`.
// Usage : node scripts/ops/sondes/audit-2026-09-01/p6-memoire.mjs

import fs from 'fs';
import { RACINE } from './_socle.mjs';

const dir=RACINE + '/.claude/memory';
const t=fs.readFileSync(dir+'/MEMORY.md','utf8').split(/\r?\n/);
console.log('lignes MEMORY.md:',t.length);
const links=[];t.forEach((l,i)=>{for(const m of l.matchAll(/\[([^\]]+)\]\(([a-z0-9._-]+\.md)\)/g)) links.push({line:i+1,label:m[1],f:m[2]});});
const fb=links.filter(x=>x.f.startsWith('feedback-'));
console.log('liens total',links.length,'| feedback',fb.length);
const step=Math.floor(fb.length/15);
const pick=[];for(let i=step-1;i<fb.length&&pick.length<15;i+=step)pick.push(fb[i]);
pick.forEach(p=>console.log(p.line+' | '+p.f));
