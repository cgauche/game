// SONDE (lecture seule) — doublons de titres de tickets ouverts par Jaccard de trigrammes (> 0,55) et préfixes de trois mots répétés.
// Usage : node scripts/ops/sondes/audit-2026-09-01/brutes/dup.mjs <dossier-de-données>
// Dossier de données (hors dépôt) — lus et/ou produits : open.json.
// Recettes de (re)fabrication des dumps : README.md du même dossier.

import fs from 'fs';
import { donnees } from '../_socle.mjs';
const DONNEES = donnees("Attendus : open.json.");

const S=DONNEES;
const iss=JSON.parse(fs.readFileSync(S+'/open.json','utf8'));
const norm=t=>t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[^a-z0-9 ]/g,' ').replace(/\s+/g,' ').trim();
const tri=t=>{const s=' '+norm(t)+' ';const S2=new Set();for(let i=0;i+3<=s.length;i++)S2.add(s.slice(i,i+3));return S2;};
const T=iss.map(i=>({n:i.number,t:i.title,g:tri(i.title)}));
const pairs=[];
for(let i=0;i<T.length;i++)for(let j=i+1;j<T.length;j++){
  const a=T[i].g,b=T[j].g;let inter=0;for(const x of a)if(b.has(x))inter++;
  const jac=inter/(a.size+b.size-inter);
  if(jac>0.55)pairs.push({jac,a:T[i],b:T[j]});
}
pairs.sort((x,y)=>y.jac-x.jac);
console.log('PAIRES_JAC>0.55', pairs.length);
for(const p of pairs.slice(0,14))console.log(p.jac.toFixed(3),'#'+p.a.n,'|',p.a.t.slice(0,95),'\n        #'+p.b.n,'|',p.b.t.slice(0,95));
// gros clusters : premier mot-cle
const buckets=new Map();
for(const i of iss){const k=norm(i.title).split(' ').slice(0,3).join(' ');buckets.set(k,(buckets.get(k)||0)+1);}
console.log('PREFIXES_3MOTS_repetes', [...buckets.entries()].filter(x=>x[1]>3).sort((a,b)=>b[1]-a[1]).slice(0,12));
