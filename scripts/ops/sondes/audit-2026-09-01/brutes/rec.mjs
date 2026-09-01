// SONDE (lecture seule) — tickets ouverts (98 derniers / 98 plus vieux / tous) : conformité de labels et marqueurs de rédaction.
// Usage : node scripts/ops/sondes/audit-2026-09-01/brutes/rec.mjs <dossier-de-données>
// Dossier de données (hors dépôt) — lus et/ou produits : open.json.
// Recettes de (re)fabrication des dumps : README.md du même dossier.

import fs from 'fs';
import { donnees } from '../_socle.mjs';
const DONNEES = donnees("Attendus : open.json.");

const S=DONNEES;
const iss=JSON.parse(fs.readFileSync(S+'/open.json','utf8')).sort((a,b)=>a.number-b.number);
const last=iss.slice(-98);
const B=i=>(i.title+' '+(i.body||''));
const f=(rx,set)=>set.filter(i=>rx.test(B(i))).length;
const show=(nom,set)=>{
 const n=set.length;
 const L=i=>(i.labels||[]).map(l=>l.name);
 console.log(`\n[${nom}] n=${n}`);
 console.log(' sans aucun label', set.filter(i=>L(i).length===0).length);
 console.log(' sans sev:', set.filter(i=>!L(i).some(x=>x.startsWith('sev:'))).length,
   '| sans type:', set.filter(i=>!L(i).some(x=>x.startsWith('type:'))).length,
   '| sans domaine:', set.filter(i=>!L(i).some(x=>x.startsWith('domaine:'))).length);
 console.log(' conformes credo l.33 (sev+type+domaine)', set.filter(i=>['sev:','type:','domaine:'].every(p=>L(i).some(x=>x.startsWith(p)))).length);
 console.log(' cite un lot/vague', f(/\b(lot|vague)\b/i,set), '| cite un juge', f(/\bjuge\b/i,set), '| ## Invariant', f(/## Invariant/,set), '| RESTE/solde', f(/\b(reste|solde|résidu)\b/i,set));
 console.log(' titre median', [...set.map(i=>i.title.length)].sort((a,b)=>a-b)[Math.floor(n/2)], '| corps median', [...set.map(i=>(i.body||'').length)].sort((a,b)=>a-b)[Math.floor(n/2)]);
};
show('98 DERNIERS OUVERTS', last);
show('98 PREMIERS OUVERTS (les plus vieux)', iss.slice(0,98));
show('TOUS', iss);
