// SONDE (lecture seule) — CI de `main` : conclusions sur 200 runs, durée médiane, part des pushes qu'un garde « run précédent vert » refuserait.
// Usage : node scripts/ops/sondes/audit-2026-09-01/ci.mjs

import {spawnSync} from 'node:child_process';
import { RACINE } from './_socle.mjs';

const REPO=RACINE;
const j=JSON.parse(spawnSync('gh',['run','list','--branch','main','--workflow','CI','--limit','200','--json','conclusion,createdAt,updatedAt,headSha'],{cwd:REPO,encoding:'utf8',shell:true,maxBuffer:1e9}).stdout);
console.log('runs',j.length,'du',j[j.length-1].createdAt,'au',j[0].createdAt);
const c={};for(const r of j)c[r.conclusion]=(c[r.conclusion]||0)+1;console.log(c);
const dur=j.map(r=>(new Date(r.updatedAt)-new Date(r.createdAt))/1000).sort((a,b)=>a-b);
console.log('duree CI mediane s',dur[Math.floor(dur.length/2)],'max',dur[dur.length-1]);
// ordre chronologique
const chrono=[...j].reverse();
let bloques=0,total=0;
for(let i=1;i<chrono.length;i++){total++;if(chrono[i-1].conclusion!=='success')bloques++;}
console.log('pushes qui seraient REFUSES par (b) [run precedent non-vert]:',bloques,'/',total, (100*bloques/total).toFixed(0)+'%');
