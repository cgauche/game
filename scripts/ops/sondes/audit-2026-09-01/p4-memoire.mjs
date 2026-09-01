// SONDE (lecture seule) — mémoire : clés et valeurs du frontmatter YAML, fiches sans frontmatter.
// Usage : node scripts/ops/sondes/audit-2026-09-01/p4-memoire.mjs

import fs from 'fs';
import { RACINE } from './_socle.mjs';

const dir=RACINE + '/.claude/memory';
const files=fs.readdirSync(dir).filter(f=>f.endsWith('.md')&&f!=='MEMORY.md');
const keys={}, types={}, noType=[];
for(const f of files){
  const t=fs.readFileSync(dir+'/'+f,'utf8');
  const m=t.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if(!m){noType.push(f);continue;}
  for(const line of m[1].split(/\r?\n/)){
    const k=line.split(':')[0].trim(); if(k) keys[k]=(keys[k]||0)+1;
    if(/^type\s*:/.test(line)){const v=line.split(':').slice(1).join(':').trim(); types[v]=(types[v]||0)+1;}
  }
}
console.log('CLES frontmatter:',JSON.stringify(keys));
console.log('VALEURS type:',JSON.stringify(types));
console.log('sans frontmatter:',noType.join(','));
console.log('--- exemple ---');
console.log(fs.readFileSync(dir+'/feedback-jamais-de-constat-silencieux.md','utf8').split(/\r?\n/).slice(0,12).join('\n'));
