// SONDE (lecture seule) — inventaire des fichiers suivis par zone et coût d'un export git SCOPÉ (`checkout-index --stdin`).
// Usage : node scripts/ops/sondes/audit-2026-09-01/brutes/m2.mjs <dossier-de-données>
// Dossier de données (hors dépôt) — lus et/ou produits : liste.txt.
// Recettes de (re)fabrication des dumps : README.md du même dossier.

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import { RACINE, donnees } from '../_socle.mjs';
const DONNEES = donnees("Attendus : liste.txt.");

const SP=DONNEES + '/';
const REPO=RACINE;
const R=(c,a,o={})=>spawnSync(c,a,{cwd:REPO,encoding:'utf8',maxBuffer:1e9,...o});
const files=R('git',['ls-files']).stdout.split('\n').filter(Boolean);
console.log('fichiers suivis:',files.length);
const grp={};
for(const f of files){const top=f.split('/')[0];grp[top]=(grp[top]||0)+1;}
console.log(Object.entries(grp).sort((a,b)=>b[1]-a[1]).map(([k,v])=>k+':'+v).join(' '));
const scoped=files.filter(f=>/^(src|scripts|docs|server|public)\//.test(f)||!f.includes('/'));
console.log('scope src+scripts+docs+server+public+racine:',scoped.length);
// longueur max avec prefixe repo-local node_modules/.cache/idx/
const pre=RACINE + '/node_modules/.cache/idx/';
const longs=scoped.filter(f=>(pre+f).length>259);
console.log('scoped > 259 chars avec prefixe repo-local:',longs.length, longs.slice(0,3));
const allLongs=files.filter(f=>(pre+f).length>259);
console.log('TOUS suivis > 259:',allLongs.length);
// export scopé
fs.rmSync(SP+'idx2',{recursive:true,force:true});
fs.writeFileSync(SP+'liste.txt',scoped.join('\n'));
const t=Date.now();
const r=R('git',['checkout-index','-f','--prefix='+SP+'idx2/','--stdin'],{input:scoped.join('\n')});
console.log('checkout-index scopé --stdin exit',r.status,'ms',Date.now()-t,(r.stderr||'').slice(0,300));
let n=0,b=0;const walk=(d)=>{for(const e of fs.readdirSync(d,{withFileTypes:true})){const p=d+'/'+e.name;if(e.isDirectory())walk(p);else{n++;b+=fs.statSync(p).size;}}};
try{walk(SP+'idx2');}catch(e){console.log('walk err',e.message);}
console.log('exportés',n,'octets',b);
