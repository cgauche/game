// SONDE (lecture seule) — tickets ouverts citant un chemin `src|scripts|docs|server` disparu de l'arbre.
// Usage : node scripts/ops/sondes/audit-2026-09-01/dead2.mjs <dossier-de-données>
// Dossier de données (hors dépôt) — lus et/ou produits : open.json.
// Recettes de (re)fabrication des dumps : README.md du même dossier.

import fs from 'fs';
import { RACINE, donnees } from './_socle.mjs';
const DONNEES = donnees("Attendus : open.json.");

const S=DONNEES, R=RACINE + '/';
const iss=JSON.parse(fs.readFileSync(S+'/open.json','utf8'));
const RX=/\b((?:src|scripts|docs|server)\/[\w/.-]+\.(?:tsx|mts|mjs|ts|json|css|md))/g;
let withPath=0,total=0,miss=0,plans=0; const dead=[];
for(const i of iss){
  const refs=[...new Set([...(i.body||'').matchAll(RX)].map(m=>m[1]))];
  if(!refs.length)continue;withPath++;
  const m=refs.filter(p=>!fs.existsSync(R+p));
  total+=refs.length;miss+=m.length;
  if(m.some(p=>p.startsWith('docs/plans/')))plans++;
  if(m.length===refs.length)dead.push({n:i.number,t:i.title.slice(0,75),m});
}
console.log('tickets citant un chemin',withPath,'refs',total,'MANQUANTES',miss,(100*miss/total).toFixed(1)+'%');
console.log('tickets citant un docs/plans/ SUPPRIME',plans);
console.log('tickets dont TOUS les chemins ont disparu',dead.length);
for(const d of dead)console.log(' #'+d.n,d.t,'|',d.m.slice(0,2).join(','));
