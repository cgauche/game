// SONDE (lecture seule) — signature d'échec de chaque run rouge : tests FAIL, erreurs TS, commande en cause.
// Usage : node scripts/ops/sondes/audit-2026-09-01/brutes/e.mjs <dossier-de-données>
// Dossier de données (hors dépôt) — lus et/ou produits : failsteps.json, logs, logs/.
// Recettes de (re)fabrication des dumps : README.md du même dossier.

import fs from 'node:fs';
import { join } from 'node:path';
import { donnees } from '../_socle.mjs';
const DONNEES = donnees("Attendus : failsteps.json, logs, logs/.");

const fails=JSON.parse(fs.readFileSync(join(DONNEES,'failsteps.json')));
for(const f of fails){
  const p=join(DONNEES,'logs') + '/'+f.id+'.txt';
  if(!fs.existsSync(p)){console.log(f.at,f.id,f.sha,'NO-LOG');continue;}
  const t=fs.readFileSync(p,'utf8').split('\n');
  const sig=new Set();
  for(const l of t){
    let m=l.match(/(FAIL|❯|×)\s+(src\/[^\s>]+\.(test|spec)\.[tj]sx?)/); if(m){sig.add('FAIL '+m[2]);continue;}
    m=l.match(/^\S*\s*(error TS\d+)/); if(m){sig.add(m[1]);continue;}
    m=l.match(/(Test Files\s+\d+ failed)/); if(m)sig.add(m[1]);
    m=l.match(/(docs:check|deps:unused|test:hooks|test:runner)[^\n]{0,80}/); if(m)sig.add('cmd:'+m[0].slice(0,60));
  }
  const arr=[...sig].filter(s=>s.startsWith('FAIL')).slice(0,6);
  const other=[...sig].filter(s=>!s.startsWith('FAIL')).slice(0,3);
  console.log(f.at,f.id,f.sha,'['+f.steps.map(s=>s.replace('build/Run npm ','')).join(';')+']',arr.join(' ; ')||other.join(' ; '));
}
