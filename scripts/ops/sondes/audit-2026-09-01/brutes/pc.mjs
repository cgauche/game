// SONDE (lecture seule) — mémoire : octets et tokens estimés de MEMORY.md et des fiches, paires de NOMS de fiches proches.
// Usage : node scripts/ops/sondes/audit-2026-09-01/brutes/pc.mjs

import fs from 'fs';
import { RACINE } from '../_socle.mjs';

const dir=RACINE + '/.claude/memory/';
const idx=fs.readFileSync(dir+'MEMORY.md','utf8');
const b=Buffer.byteLength(idx,'utf8');
console.log('MEMORY.md octets:',b,'| caracteres:',idx.length,'| mots:',idx.split(/\s+/).length,'| lignes:',idx.split('\n').length);
console.log('estimation tokens (car/2.6 .. car/3.2):',Math.round(idx.length/3.2),'..',Math.round(idx.length/2.6));
const files=fs.readdirSync(dir).filter(f=>f.endsWith('.md')&&f!=='MEMORY.md');
let ch=0; for(const f of files) ch+=fs.readFileSync(dir+f,'utf8').length;
console.log('fiches: caracteres',ch,'| tokens estimes',Math.round(ch/3.2),'..',Math.round(ch/2.6));
// doublons de theme : tokens du nom
const words=f=>new Set(f.replace(/\.md$/,'').split('-').filter(w=>w.length>4));
const pairs=[];
for(let i=0;i<files.length;i++)for(let j=i+1;j<files.length;j++){
  const a=words(files[i]),c=words(files[j]);
  const inter=[...a].filter(x=>c.has(x));
  const jac=inter.length/new Set([...a,...c]).size;
  if(jac>=0.34) pairs.push([jac.toFixed(2),files[i],files[j]]);
}
pairs.sort((x,y)=>y[0]-x[0]);
console.log('PAIRES de noms proches (Jaccard>=0.34):',pairs.length);
pairs.slice(0,25).forEach(p=>console.log(' ',p.join('  ~  ')));
