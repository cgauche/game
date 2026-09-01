// SONDE (lecture seule) — mémoire : fiches mentionnant une RÉCIDIVE, fiches citant une porte exécutable, wikilinks morts.
// Usage : node scripts/ops/sondes/audit-2026-09-01/p8-memoire.mjs

import fs from 'fs';
import { RACINE } from './_socle.mjs';

const dir=RACINE + '/.claude/memory/';
const files=fs.readdirSync(dir).filter(f=>f.endsWith('.md')&&f!=='MEMORY.md');
let n=0; const hits=[];
for(const f of files){
  const t=fs.readFileSync(dir+f,'utf8');
  const m=[...t.matchAll(/r[ée]cidiv\w*/gi)];
  if(m.length){n++;hits.push([f,m.length]);}
}
hits.sort((a,b)=>b[1]-a[1]);
console.log('fiches mentionnant une RÉCIDIVE:',n,'/',files.length);
hits.slice(0,15).forEach(([f,c])=>console.log(' ',c,f));
// fiches citant un test/garde executable
let g=0; const nog=[];
for(const f of files){
  const t=fs.readFileSync(dir+f,'utf8');
  if(/\.test\.tsx?|scripts\/guards\/|pre-commit|npm run test/i.test(t)) g++; else nog.push(f);
}
console.log('fiches citant un test/garde/hook:',g,'| sans:',nog.length);
// feedback only
const fb=files.filter(f=>/\n\s*type:\s*feedback/.test(fs.readFileSync(dir+f,'utf8')));
let gf=0; for(const f of fb){const t=fs.readFileSync(dir+f,'utf8'); if(/\.test\.tsx?|scripts\/guards\/|pre-commit/i.test(t)) gf++;}
console.log('fiches type=feedback:',fb.length,'| dont citant une porte executable:',gf);
// verbatim user marker
let v=0; for(const f of files){const t=fs.readFileSync(dir+f,'utf8'); if(/verbatim/i.test(t)) v++;}
console.log('fiches contenant "verbatim":',v);
// wikilinks
let wl=0,wlDead=0; const dead=[];
for(const f of files){for(const m of fs.readFileSync(dir+f,'utf8').matchAll(/\[\[([^\]]+)\]\]/g)){wl++; if(!fs.existsSync(dir+m[1]+'.md')){wlDead++;dead.push(f+' -> '+m[1]);}}}
console.log('wikilinks:',wl,'| morts:',wlDead); dead.slice(0,10).forEach(d=>console.log('  ',d));
