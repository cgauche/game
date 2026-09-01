// SONDE (lecture seule) — tickets fermés : âge à la fermeture, durée de vie, cadence création/fermeture sur quatorze jours.
// Usage : node scripts/ops/sondes/audit-2026-09-01/brutes/cl.mjs <dossier-de-données>
// Dossier de données (hors dépôt) — lus et/ou produits : closed.json, open.json.
// Recettes de (re)fabrication des dumps : README.md du même dossier.

import fs from 'fs';
import { donnees } from '../_socle.mjs';
const DONNEES = donnees("Attendus : closed.json, open.json.");

const S=DONNEES;
const c=JSON.parse(fs.readFileSync(S+'/closed.json','utf8'));
console.log('FERMES',c.length);
const now=new Date('2026-09-01T23:00:00Z');
const d=x=>(now-new Date(x))/86400000;
const b={'<7':0,'7-30':0,'30-60':0,'>60':0};for(const i of c){const a=d(i.createdAt);if(a<7)b['<7']++;else if(a<30)b['7-30']++;else if(a<60)b['30-60']++;else b['>60']++;}
console.log('FERMES_par_age_creation',JSON.stringify(b));
const life=c.filter(i=>i.closedAt).map(i=>(new Date(i.closedAt)-new Date(i.createdAt))/86400000).sort((a,b)=>a-b);
console.log('DUREE_VIE_med',life[Math.floor(life.length/2)].toFixed(2),'j p90',life[Math.floor(life.length*0.9)].toFixed(1),'min',life[0].toFixed(3));
console.log('FERMES_7j',c.filter(i=>d(i.closedAt)<7).length,'FERMES_2j',c.filter(i=>d(i.closedAt)<2).length);
const o=JSON.parse(fs.readFileSync(S+'/open.json','utf8'));
const all=[...c.map(x=>x.number),...o.map(x=>x.number)];
console.log('MAX_NUM',Math.max(...all),'TOTAL',all.length,'RATIO_OUVERT',(o.length/all.length*100).toFixed(1)+'%');
// creation per day last 14 days
const per=new Map();for(const i of [...c,...o]){const k=i.createdAt.slice(0,10);per.set(k,(per.get(k)||0)+1);}
console.log('CREATION_PAR_JOUR',[...per.entries()].sort().slice(-14));
const perC=new Map();for(const i of c){if(!i.closedAt)continue;const k=i.closedAt.slice(0,10);perC.set(k,(perC.get(k)||0)+1);}
console.log('FERMETURE_PAR_JOUR',[...perC.entries()].sort().slice(-14));
