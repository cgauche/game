// SONDE (lecture seule) — mémoire : dates de création reconstruites depuis `adds.txt`, octets par préfixe, fiches liées vs orphelines.
// Usage : node scripts/ops/sondes/audit-2026-09-01/p2-memoire.mjs <dossier-de-données>
// Dossier de données (hors dépôt) — lus et/ou produits : adds.txt, cre.json.
// Recettes de (re)fabrication des dumps : README.md du même dossier.

import fs from 'fs';
import { RACINE, donnees } from './_socle.mjs';
const DONNEES = donnees("Attendus : adds.txt, cre.json.");

const S=DONNEES;
const lines=fs.readFileSync(S+'/adds.txt','utf8').split(/\r?\n/);
let d=null; const cre={};
for(const l of lines){ if(l.startsWith('D=')){d=l.slice(2);continue;} if(l.startsWith('.claude/memory/')&&l.endsWith('.md')){ const f=l.split('/').pop(); if(!cre[f]) cre[f]=d; else cre[f]= (cre[f]<d?cre[f]:d);} }
const dir=RACINE + '/.claude/memory';
const files=fs.readdirSync(dir).filter(f=>f.endsWith('.md')&&f!=='MEMORY.md');
const bym={}; let unk=0;
for(const f of files){const c=cre[f]; if(!c){unk++;continue;} const m=c.slice(0,7); bym[m]=(bym[m]||0)+1;}
console.log('CREATION par mois:',JSON.stringify(bym),'inconnues:',unk);
// bytes total + per class
let tot=0; const bycls={};
for(const f of files){const s=fs.statSync(dir+'/'+f).size; tot+=s; const p=f.split('-')[0]; bycls[p]=(bycls[p]||0)+s;}
console.log('OCTETS total fiches:',tot,'moyenne:',Math.round(tot/files.length));
console.log('OCTETS par prefixe:',JSON.stringify(bycls));
// linked set bytes
const idx=fs.readFileSync(dir+'/MEMORY.md','utf8');
const linked=[...new Set([...idx.matchAll(/\(([a-z0-9._-]+\.md)\)/g)].map(m=>m[1]))];
let lb=0; for(const f of linked) if(fs.existsSync(dir+'/'+f)) lb+=fs.statSync(dir+'/'+f).size;
console.log('MEMORY.md octets:',fs.statSync(dir+'/MEMORY.md').size,'| fiches liees:',linked.length,'octets:',lb);
// archive
const a=dir+'/_archive'; let ta=0,ca=0;
for(const f of fs.readdirSync(a)){const st=fs.statSync(a+'/'+f); if(st.isFile()){ta+=st.size;ca++;}}
console.log('_archive:',ca,'fichiers',ta,'octets');
// creation dates of orphans
const orph=files.filter(f=>!linked.includes(f));
const ob={}; for(const f of orph){const c=cre[f]||'?'; ob[c.slice(0,7)]=(ob[c.slice(0,7)]||0)+1;}
console.log('ORPHELINES creation par mois:',JSON.stringify(ob));
fs.writeFileSync(S+'/cre.json',JSON.stringify(cre));
