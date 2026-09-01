// SONDE (lecture seule) — suite chronologique des runs rouges : le rouge est-il HÉRITÉ du run précédent ou NEUF.
// Usage : node scripts/ops/sondes/audit-2026-09-01/brutes/o.mjs <dossier-de-données>
// Dossier de données (hors dépôt) — lus et/ou produits : failsteps.json, logs, logs/.
// Recettes de (re)fabrication des dumps : README.md du même dossier.

import fs from 'node:fs';
import { join } from 'node:path';
import { donnees } from '../_socle.mjs';
const DONNEES = donnees("Attendus : failsteps.json, logs, logs/.");

const fails=JSON.parse(fs.readFileSync(join(DONNEES,'failsteps.json')));
const seq=[...fails].reverse(); // chrono
const sets=seq.map(f=>{
  const p=join(DONNEES,'logs') + '/'+f.id+'.txt';const s=new Set();
  if(fs.existsSync(p))for(const l of fs.readFileSync(p,'utf8').split('\n')){const m=l.match(/\bFAIL\s+(src\/\S+\.(?:test|spec)\.[tj]sx?)\s*>/);if(m)s.add(m[1]);}
  if(!s.size)s.add('STEP:'+f.steps.map(x=>x.replace('build/Run npm ','')).join(';'));
  return {f,s};
});
let herite=0,neuf=0;
for(let i=0;i<sets.length;i++){
  const prev=i>0?sets[i-1].s:new Set();
  const inter=[...sets[i].s].filter(x=>prev.has(x));
  const isH=inter.length>0;
  if(isH)herite++;else neuf++;
  console.log(sets[i].f.at,sets[i].f.sha,isH?'HERITE':'NEUF  ',[...sets[i].s].slice(0,3).join(','));
}
console.log('=== rouges herites du run precedent:',herite,'/ neufs:',neuf);
