// SONDE (lecture seule) — chaque run rouge : les huit premières lignes `FAIL <fichier> > <test>`.
// Usage : node scripts/ops/sondes/audit-2026-09-01/brutes/g.mjs <dossier-de-données>
// Dossier de données (hors dépôt) — lus et/ou produits : failsteps.json, logs, logs/.
// Recettes de (re)fabrication des dumps : README.md du même dossier.

import fs from 'node:fs';
import { join } from 'node:path';
import { donnees } from '../_socle.mjs';
const DONNEES = donnees("Attendus : failsteps.json, logs, logs/.");

const clean=l=>l.replace(/^[^\t]*\t/,'').replace(/^\uFEFF?\d{4}-\d\d-\d\dT[\d:.]+Z /,'').replace(new RegExp(String.fromCharCode(27)+'\\[[0-9;]*m','g'),'').trimEnd();
const fails=JSON.parse(fs.readFileSync(join(DONNEES,'failsteps.json')));
for(const f of fails){
  const p=join(DONNEES,'logs') + '/'+f.id+'.txt'; if(!fs.existsSync(p)){console.log(f.at,f.id,f.sha,'NO-LOG');continue;}
  const t=fs.readFileSync(p,'utf8').split('\n').map(clean);
  const start=t.findIndex(l=>/Failed Tests \d+/.test(l));
  const out=[];
  if(start>=0){
    for(let i=start;i<t.length&&out.length<8;i++){
      const l=t[i];
      const m=l.match(/^\s*FAIL\s+(\S+)\s*>\s*(.*)$/);
      if(m){out.push(m[1]+' > '+m[2].slice(0,90));}
    }
  }
  if(!out.length){ // non-test steps: last non-empty meaningful lines
    const tail=t.filter(l=>l&&!/^##\[/.test(l)).slice(-6).map(l=>l.slice(0,140));
    out.push(...tail);
  }
  console.log('---',f.at,f.id,f.sha,'['+f.steps.map(s=>s.replace('build/Run npm ','')).join(';')+']');
  for(const o of out)console.log('   ',o);
}
