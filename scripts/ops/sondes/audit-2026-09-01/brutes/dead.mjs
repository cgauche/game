// SONDE (lecture seule) — tickets ouverts citant un chemin disparu (variante initiale de `dead2.mjs`, sans le volet `docs/plans/`).
// Usage : node scripts/ops/sondes/audit-2026-09-01/brutes/dead.mjs <dossier-de-données>
// Dossier de données (hors dépôt) — lus et/ou produits : open.json.
// Recettes de (re)fabrication des dumps : README.md du même dossier.

import fs from 'fs';
import { RACINE, donnees } from '../_socle.mjs';
const DONNEES = donnees("Attendus : open.json.");

const S=DONNEES, R=RACINE + '/';
const iss=JSON.parse(fs.readFileSync(S+'/open.json','utf8'));
let withPath=0, deadCount=0, totalRefs=0, missRefs=0; const dead=[];
for(const i of iss){
  const refs=[...new Set([...(i.body||'').matchAll(/\b((?:src|scripts|docs|server)\/[\w/.-]+\.(?:ts|tsx|mjs|mts|json|css|md))/g)].map(m=>m[1]))];
  if(!refs.length) continue; withPath++;
  const miss=refs.filter(p=>!fs.existsSync(R+p));
  totalRefs+=refs.length; missRefs+=miss.length;
  if(miss.length===refs.length){deadCount++;dead.push({n:i.number,t:i.title.slice(0,80),miss});}
}
console.log('tickets citant >=1 chemin:',withPath,'/',iss.length);
console.log('refs de chemins:',totalRefs,'inexistantes:',missRefs,(100*missRefs/totalRefs).toFixed(1)+'%');
console.log('tickets dont TOUS les chemins cites ont disparu:',deadCount);
for(const d of dead.slice(0,25))console.log(' #'+d.n,d.t,'|',d.miss.slice(0,3).join(','));
