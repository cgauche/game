// SONDE (lecture seule) — doublons de tickets ouverts par similarité cosinus-idf des titres (> 0,42).
// Usage : node scripts/ops/sondes/audit-2026-09-01/dup2.mjs <dossier-de-données>
// Dossier de données (hors dépôt) — lus et/ou produits : open.json.
// Recettes de (re)fabrication des dumps : README.md du même dossier.

import fs from 'fs';
import { donnees } from './_socle.mjs';
const DONNEES = donnees("Attendus : open.json.");

const S=DONNEES;
const iss=JSON.parse(fs.readFileSync(S+'/open.json','utf8'));
const stop=new Set('le la les de des du un une et ou a au aux en dans par pour sur son sa ses est sont ne pas plus que qui quoi il elle on se ce cet cette d l n s y jamais tout toute tous jet jets'.split(' '));
const tok=t=>new Set(t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[^a-z0-9]+/g,' ').split(' ').filter(w=>w.length>3&&!stop.has(w)));
// IDF
const docs=iss.map(i=>({n:i.number,t:i.title,s:tok(i.title)}));
const df=new Map();for(const d of docs)for(const w of d.s)df.set(w,(df.get(w)||0)+1);
const N=docs.length;
const sim=(a,b)=>{let num=0,da=0,db=0;const idf=w=>Math.log(N/(1+(df.get(w)||1)));
 for(const w of a.s){const v=idf(w);da+=v*v;if(b.s.has(w))num+=v*v;}
 for(const w of b.s){const v=idf(w);db+=v*v;}
 return num/Math.sqrt(da*db||1);};
const P=[];
for(let i=0;i<docs.length;i++)for(let j=i+1;j<docs.length;j++){const s=sim(docs[i],docs[j]);if(s>0.42)P.push([s,docs[i],docs[j]]);}
P.sort((x,y)=>y[0]-x[0]);
console.log('PAIRES cos-idf>0.42 :',P.length);
for(const [s,a,b] of P.slice(0,12))console.log(s.toFixed(3),'#'+a.n,a.t.slice(0,88),'\n        #'+b.n,b.t.slice(0,88));
