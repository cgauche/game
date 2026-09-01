// SONDE (lecture seule) — rayon de la suite : pour les 60 derniers commits, nombre de tests que `vitest --changed` réveillerait.
// Usage : node scripts/ops/sondes/audit-2026-09-01/graph3.mjs

import fs from 'node:fs'; import path from 'node:path'; import {spawnSync} from 'node:child_process';
import { RACINE } from './_socle.mjs';

const REPO=RACINE;
const SEP=path.sep; const norm=(p)=>p.split(SEP).join('/');
const isTest=(f)=>f.endsWith('.test.ts')||f.endsWith('.test.tsx');
const EXTS=['.ts','.tsx','.mts','.mjs','.js','.jsx'];
const files=[];
const walk=(d)=>{for(const e of fs.readdirSync(d,{withFileTypes:true})){const p=path.join(d,e.name);if(e.isDirectory()){if(e.name==='node_modules')continue;walk(p);}else if(EXTS.some(x=>e.name.endsWith(x)))files.push(norm(p));}};
walk(REPO+'/src'); walk(REPO+'/scripts');
const specsOf=(text)=>{const out=[];for(const line of text.split(String.fromCharCode(10))){if(!(line.includes('import')||line.includes('from')))continue;for(const q of ['"',String.fromCharCode(39)]){let i=line.indexOf(q);while(i>=0){const j=line.indexOf(q,i+1);if(j<0)break;const s=line.slice(i+1,j);if(s.startsWith('./')||s.startsWith('../'))out.push(s);i=line.indexOf(q,j+1);}}}return out;};
const resolve1=(from,spec)=>{const base=norm(path.resolve(path.dirname(from),spec));const cands=[base,...EXTS.map(e=>base+e),base+'.json',base+'/index.ts',base+'/index.tsx'];
  const alt=base.endsWith('.mjs')||base.endsWith('.mts')?base.slice(0,-4):null; if(alt)cands.push(alt+'.mts',alt+'.ts',alt+'.mjs');
  for(const c of cands){try{if(fs.statSync(c).isFile())return norm(c);}catch{}}return null;};
const rev=new Map();
for(const f of files){let t;try{t=fs.readFileSync(f,'utf8');}catch{continue;}
  for(const s of specsOf(t)){const r=resolve1(f,s);if(r){if(!rev.has(r))rev.set(r,[]);rev.get(r).push(f);}}}
const reach=(seeds)=>{const seen=new Set(seeds);const st=[...seeds];while(st.length){const c=st.pop();for(const p of rev.get(c)||[])if(!seen.has(p)){seen.add(p);st.push(p);}}return [...seen].filter(isTest).length;};
const log=spawnSync('git',['log','--format=%H','-60'],{cwd:REPO,encoding:'utf8'}).stdout.trim().split(String.fromCharCode(10));
const res=[];
for(const sha of log){
  const ch=spawnSync('git',['show','--name-only','--format=','-m','--first-parent',sha],{cwd:REPO,encoding:'utf8',maxBuffer:1e9}).stdout.split(String.fromCharCode(10)).filter(Boolean);
  const seeds=ch.map(f=>REPO+'/'+f).filter(f=>{try{return fs.statSync(f).isFile();}catch{return false;}});
  res.push({sha:sha.slice(0,8),n:ch.length,tests:reach(seeds)});
}
const tot=files.filter(isTest).length;
console.log('total tests',tot);
const gros=res.filter(r=>r.tests>tot*0.5).length;
console.log('commits sur 60 dont --changed toucherait >50% de la suite:',gros);
console.log('mediane tests reliés:',res.map(r=>r.tests).sort((a,b)=>a-b)[Math.floor(res.length/2)]);
console.log(res.slice(0,15).map(r=>r.sha+':'+r.n+'f/'+r.tests+'t').join(' '));
