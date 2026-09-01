// SONDE (lecture seule) — tickets ouverts nommés dans le script : labels, corps et références croisées.
// Usage : node scripts/ops/sondes/audit-2026-09-01/brutes/pairs.mjs <dossier-de-données>
// Dossier de données (hors dépôt) — lus et/ou produits : open.json.
// Recettes de (re)fabrication des dumps : README.md du même dossier.

import fs from 'fs';
import { donnees } from '../_socle.mjs';
const DONNEES = donnees("Attendus : open.json.");

const S=DONNEES;
const iss=JSON.parse(fs.readFileSync(S+'/open.json','utf8'));
const g=n=>iss.find(i=>i.number===n);
for(const n of [1614,1493,1483,1244,1269,996,1636,1637,1638,1639]){
 const i=g(n); if(!i){console.log('#'+n,'ABSENT des ouverts');continue;}
 console.log('\n#'+n,'|',i.createdAt.slice(0,10),'| labels:',(i.labels||[]).map(l=>l.name).join(',')||'AUCUN','| corps',(i.body||'').length,'| comm',(i.comments||[]).length);
 console.log('T:',i.title);
 console.log('B:',(i.body||'').replace(/\s+/g,' ').slice(0,340));
 const refs=[...new Set([...(i.body||'').matchAll(/#(\d{3,4})/g)].map(m=>m[1]))];
 console.log('refs:',refs.join(','));
}
