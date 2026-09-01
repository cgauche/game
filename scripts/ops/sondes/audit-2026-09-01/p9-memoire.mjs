// SONDE (lecture seule) — mémoire : fermeture transitive depuis MEMORY.md par profondeur, octets, fiches INATTEIGNABLES.
// Usage : node scripts/ops/sondes/audit-2026-09-01/p9-memoire.mjs

import fs from 'fs';
import { RACINE } from './_socle.mjs';

const dir=RACINE + '/.claude/memory/';
const ex=f=>fs.existsSync(dir+f);
const norm=s=>{s=s.split('|')[0].trim(); return s.endsWith('.md')?s:s+'.md';};
const outl=f=>{const t=fs.readFileSync(dir+f,'utf8');const s=new Set();
 for(const m of t.matchAll(/\[\[([^\]]+)\]\]/g)){const n=norm(m[1]); if(ex(n))s.add(n);}
 for(const m of t.matchAll(/\(([a-z0-9._-]+\.md)\)/g)){if(ex(m[1]))s.add(m[1]);}
 return [...s];};
// dead wikilinks recount
let wl=0; const dead=[];
for(const f of fs.readdirSync(dir).filter(x=>x.endsWith('.md'))){
 for(const m of fs.readFileSync(dir+f,'utf8').matchAll(/\[\[([^\]]+)\]\]/g)){wl++;const n=norm(m[1]); if(!ex(n))dead.push(f+' -> '+m[1]);}}
console.log('wikilinks:',wl,'| MORTS reels:',dead.length,dead.join(' ; '));
const d1=outl('MEMORY.md');
const seen=new Set(d1); let front=d1;
const levels=[d1.length];
for(let i=0;i<3;i++){const nx=[];for(const f of front)for(const g of outl(f))if(!seen.has(g)){seen.add(g);nx.push(g);}front=nx;levels.push(nx.length);}
const size=a=>a.reduce((s,f)=>s+fs.statSync(dir+f).size,0);
console.log('depth1:',levels[0],size(d1),'octets');
console.log('nouveaux par profondeur 2/3/4:',levels.slice(1).join('/'));
console.log('cloture totale:',seen.size,'fiches,',size([...seen]),'octets');
const all=fs.readdirSync(dir).filter(x=>x.endsWith('.md')&&x!=='MEMORY.md');
const unreach=all.filter(f=>!seen.has(f));
console.log('INATTEIGNABLES depuis MEMORY.md (tout lien confondu, profondeur 4):',unreach.length,size(unreach),'octets');
console.log(unreach.slice(0,40).join('\n'));
