// SONDE (lecture seule) — échantillon déterministe de tickets ouverts (numéro multiple de 23) avec corps.
// Usage : node scripts/ops/sondes/audit-2026-09-01/brutes/samp.mjs <dossier-de-données>
// Dossier de données (hors dépôt) — lus et/ou produits : open.json.
// Recettes de (re)fabrication des dumps : README.md du même dossier.

import fs from 'fs';
import { donnees } from '../_socle.mjs';
const DONNEES = donnees("Attendus : open.json.");

const S=DONNEES;
const iss=JSON.parse(fs.readFileSync(S+'/open.json','utf8'));
const sel=iss.filter(i=>i.number%23===0).sort((a,b)=>a.number-b.number);
console.log('ECHANTILLON multiples de 23 :',sel.length);
for(const i of sel){
  const b=(i.body||'').replace(/\r/g,'').replace(/\n+/g,' ⏎ ');
  console.log('\n=== #'+i.number+' ['+(i.labels||[]).map(l=>l.name).join(',')+'] corps='+(i.body||'').length+' comm='+(i.comments||[]).length);
  console.log('T: '+i.title);
  console.log('B: '+b.slice(0,700));
}
