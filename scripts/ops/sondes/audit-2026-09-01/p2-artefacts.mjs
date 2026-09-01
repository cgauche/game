// SONDE (lecture seule) — mémoire `.claude/memory` : fiches atteignables depuis MEMORY.md (fermeture transitive) et inatteignables.
// Usage : node scripts/ops/sondes/audit-2026-09-01/p2-artefacts.mjs

import fs from 'fs';
import path from 'path';
import { RACINE } from './_socle.mjs';

const root=RACINE;
const memdir=path.join(root,'.claude/memory');
const files=fs.readdirSync(memdir).filter(f=>f.endsWith('.md'));
console.log('fiches racine', files.length);
const idx=fs.readFileSync(path.join(memdir,'MEMORY.md'),'utf8');
const linked=new Set([...idx.matchAll(/\(([a-z0-9-]+)\.md\)/g)].map(m=>m[1]));
console.log('liens directs depuis MEMORY.md', linked.size);
// atteignabilite transitive
const graph={};
for(const f of files){const t=fs.readFileSync(path.join(memdir,f),'utf8');graph[f.replace(/\.md$/,'')]=[...t.matchAll(/\[\[([^\]]+)\]\]|\(([a-z0-9-]+)\.md\)/g)].map(m=>m[1]||m[2]);}
const seen=new Set(),q=[...linked];
while(q.length){const n=q.pop();if(seen.has(n))continue;seen.add(n);for(const c of (graph[n]||[]))if(!seen.has(c))q.push(c);}
const unreach=files.map(f=>f.replace(/\.md$/,'')).filter(n=>!seen.has(n));
console.log('inatteignables', unreach.length);
console.log(unreach.join('\n'));
