// SONDE (lecture seule) — tickets ouverts : part née d'un reste/juge/recette, jours à vingt ouvertures ou plus, tickets muets.
// Usage : node scripts/ops/sondes/audit-2026-09-01/brutes/rest.mjs <dossier-de-données>
// Dossier de données (hors dépôt) — lus et/ou produits : open.json.
// Recettes de (re)fabrication des dumps : README.md du même dossier.

import fs from 'fs';
import { donnees } from '../_socle.mjs';
const DONNEES = donnees("Attendus : open.json.");

const S=DONNEES;
const iss=JSON.parse(fs.readFileSync(S+'/open.json','utf8'));
const B=i=>(i.title+' '+(i.body||''));
const rx={
 'RESTE de fermeture':/\b(reste|résidu|residu|solde)\b/i,
 'issu d\'un juge/juge adversarial':/\bjuge\b/i,
 'issu d\'une recette':/recette/i,
 'trouvé "en route"/"au passage"':/(en route|au passage|découvert par|decouvert par|relevé au|releve au)/i,
 'defaut latent/angle mort':/(latent|angle mort|trou de couverture)/i,
 'decision utilisateur en attente':/(en attente (de )?(décision|arbitrage)|à trancher|a trancher|AskUserQuestion|policy-à-trancher)/i,
};
for(const [k,r] of Object.entries(rx)){const c=iss.filter(i=>r.test(B(i))).length;console.log(k, c, (100*c/iss.length).toFixed(1)+'%');}
// tickets ouverts le meme jour qu'ils citent un lot livre
const byDay=new Map();for(const i of iss){const d=i.createdAt.slice(0,10);(byDay.get(d)||byDay.set(d,[]).get(d)).push(i);}
// top jours
console.log('JOURS_>20_OUVERTS',[...byDay.entries()].filter(x=>x[1].length>=20).map(x=>[x[0],x[1].length]));
// tickets avec 0 commentaire ET >14j sans update
const now=new Date('2026-09-01T23:00:00Z');
const q=iss.filter(i=>(i.comments||[]).length===0 && (now-new Date(i.updatedAt))/86400000>14);
console.log('0 COMMENTAIRE ET INTOUCHES >14j', q.length, (100*q.length/iss.length).toFixed(1)+'%');
const q30=iss.filter(i=>(i.comments||[]).length===0 && (now-new Date(i.updatedAt))/86400000>30);
console.log('0 COMMENTAIRE ET INTOUCHES >30j', q30.length);
// auteur
const a=new Map();for(const i of iss)a.set(i.author?.login||'?',(a.get(i.author?.login||'?')||0)+1);
console.log('AUTEURS',[...a.entries()]);
