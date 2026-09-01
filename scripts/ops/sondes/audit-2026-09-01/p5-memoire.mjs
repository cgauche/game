// SONDE (lecture seule) — mémoire : `type` déclaré vs préfixe du nom de fichier, type × mois de création, orphelines par type.
// Usage : node scripts/ops/sondes/audit-2026-09-01/p5-memoire.mjs <dossier-de-données>
// Dossier de données (hors dépôt) — lus et/ou produits : cre.json.
// Recettes de (re)fabrication des dumps : README.md du même dossier.

import fs from 'fs';
import { RACINE, donnees } from './_socle.mjs';
const DONNEES = donnees("Attendus : cre.json.");

const dir=RACINE + '/.claude/memory';
const cre=JSON.parse(fs.readFileSync(DONNEES+'/cre.json','utf8'));
const files=fs.readdirSync(dir).filter(f=>f.endsWith('.md')&&f!=='MEMORY.md');
const idx=fs.readFileSync(dir+'/MEMORY.md','utf8');
const linked=new Set([...idx.matchAll(/\(([a-z0-9._-]+\.md)\)/g)].map(m=>m[1]));
const types={}, mismatch=[]; const byTypeMonth={};
for(const f of files){
  const t=fs.readFileSync(dir+'/'+f,'utf8');
  const m=t.match(/\n\s*type:\s*(\w+)/);
  const v=m?m[1]:'AUCUN';
  types[v]=(types[v]||0)+1;
  const pref=f.split('-')[0];
  if(v!=='AUCUN'&&v!==pref) mismatch.push(f+' prefixe='+pref+' type='+v);
  const mo=(cre[f]||'?').slice(0,7);
  byTypeMonth[v]=byTypeMonth[v]||{}; byTypeMonth[v][mo]=(byTypeMonth[v][mo]||0)+1;
}
console.log('TYPE (metadata.type):',JSON.stringify(types));
console.log('type != prefixe fichier:',mismatch.length); mismatch.slice(0,20).forEach(x=>console.log('  ',x));
console.log('type x mois de creation:',JSON.stringify(byTypeMonth));
// orphelines par type
const ot={}; for(const f of files){ if(linked.has(f))continue; const t=fs.readFileSync(dir+'/'+f,'utf8').match(/\n\s*type:\s*(\w+)/); ot[t?t[1]:'AUCUN']=(ot[t?t[1]:'AUCUN']||0)+1;}
console.log('ORPHELINES par type:',JSON.stringify(ot));
