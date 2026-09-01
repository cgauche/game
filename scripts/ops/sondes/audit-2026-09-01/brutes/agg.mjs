// SONDE (lecture seule) — tickets ouverts : labels, âge, muets, longueurs de titre/corps, épiques et leurs enfants ouverts.
// Usage : node scripts/ops/sondes/audit-2026-09-01/brutes/agg.mjs <dossier-de-données>
// Dossier de données (hors dépôt) — lus et/ou produits : open.json.
// Recettes de (re)fabrication des dumps : README.md du même dossier.

import fs from 'fs';
import { donnees } from '../_socle.mjs';
const DONNEES = donnees("Attendus : open.json.");

const S=DONNEES;
const iss=JSON.parse(fs.readFileSync(S+'/open.json','utf8'));
console.log('TOTAL_OUVERTS', iss.length);
// labels
const lab=new Map(); let sans=0;
for(const i of iss){ if(!i.labels||i.labels.length===0) sans++; for(const l of (i.labels||[])) lab.set(l.name,(lab.get(l.name)||0)+1); }
console.log('SANS_LABEL', sans, (100*sans/iss.length).toFixed(1)+'%');
const ls=[...lab.entries()].sort((a,b)=>b[1]-a[1]);
console.log('NB_LABELS_DISTINCTS', ls.length);
console.log('TOP15', JSON.stringify(ls.slice(0,15)));
console.log('LABELS_1_USAGE', ls.filter(x=>x[1]===1).length, JSON.stringify(ls.filter(x=>x[1]===1).map(x=>x[0])));
// age
const now=new Date('2026-09-01T23:00:00Z');
const days=i=>(now-new Date(i.createdAt))/86400000;
const b={ '<7':0,'7-30':0,'30-60':0,'>60':0};
for(const i of iss){const d=days(i); if(d<7)b['<7']++; else if(d<30)b['7-30']++; else if(d<60)b['30-60']++; else b['>60']++;}
console.log('AGE', JSON.stringify(b));
const upd=i=>(now-new Date(i.updatedAt))/86400000;
console.log('MUETS_>14j_updated', iss.filter(i=>upd(i)>14).length, 'MUETS_>30j', iss.filter(i=>upd(i)>30).length);
// titles/bodies
const med=a=>{const s=[...a].sort((x,y)=>x-y);return s[Math.floor(s.length/2)];};
const tl=iss.map(i=>i.title.length), bl=iss.map(i=>(i.body||'').length), cm=iss.map(i=>(i.comments||[]).length);
console.log('TITRE med',med(tl),'max',Math.max(...tl),'>150:',tl.filter(x=>x>150).length,'>100:',tl.filter(x=>x>100).length);
console.log('CORPS med',med(bl),'max',Math.max(...bl),'vides:',bl.filter(x=>x===0).length,'>5000:',bl.filter(x=>x>5000).length,'>10000:',bl.filter(x=>x>10000).length);
console.log('TOTAL_CORPS_OCTETS', bl.reduce((a,b)=>a+b,0));
console.log('COMMENTAIRES total',cm.reduce((a,b)=>a+b,0),'0 comm:',cm.filter(x=>x===0).length, 'med',med(cm));
// epics
const rxE=/(ÉPIQUE|EPIQUE|CHANTIER|Programme|PROGRAMME|épique|epic)/;
const ep=iss.filter(i=>rxE.test(i.title)||(i.labels||[]).some(l=>rxE.test(l.name)));
console.log('EPIQUES_TITRE_OU_LABEL', ep.length);
for(const e of ep.slice(0,40)){
  const last=(e.comments||[]).slice(-1)[0];
  console.log('E#'+e.number, '|age', days(e).toFixed(0)+'j', '|upd', upd(e).toFixed(0)+'j', '|comm', (e.comments||[]).length, '|lastComm', last? ((now-new Date(last.createdAt))/86400000).toFixed(0)+'j':'AUCUN', '|', e.title.slice(0,110));
}
// references to children: count "#N" in bodies of epics that are open
const openSet=new Set(iss.map(i=>i.number));
for(const e of ep){
  const refs=new Set([...((e.body||'')+(e.comments||[]).map(c=>c.body).join('\n')).matchAll(/#(\d{3,5})/g)].map(m=>+m[1]));
  const openChild=[...refs].filter(n=>openSet.has(n)&&n!==e.number);
  console.log('EPIC_REFS #'+e.number,'refs',refs.size,'ouverts',openChild.length);
}
