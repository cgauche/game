// SONDE (lecture seule) — CI de `main` : durée médiane vert vs rouge, cadence de runs par jour.
// Usage : node scripts/ops/sondes/audit-2026-09-01/ci2.mjs

import {spawnSync} from 'node:child_process';
import { RACINE } from './_socle.mjs';

const REPO=RACINE;
const j=JSON.parse(spawnSync('gh',['run','list','--branch','main','--workflow','CI','--limit','200','--json','conclusion,createdAt,updatedAt'],{cwd:REPO,encoding:'utf8',shell:true,maxBuffer:1e9}).stdout);
const med=(a)=>a.sort((x,y)=>x-y)[Math.floor(a.length/2)];
for(const k of ['success','failure']){
  const d=j.filter(r=>r.conclusion===k).map(r=>(new Date(r.updatedAt)-new Date(r.createdAt))/1000);
  console.log(k,'n=',d.length,'mediane s',med(d),'max',Math.max(...d));
}
const byDay={};for(const r of j)byDay[r.createdAt.slice(0,10)]=(byDay[r.createdAt.slice(0,10)]||0)+1;
console.log(Object.entries(byDay).sort().map(([d,n])=>d.slice(5)+':'+n).join(' '));
const jours=Object.keys(byDay).length;console.log('jours',jours,'moyenne runs/j',(j.length/jours).toFixed(1));
