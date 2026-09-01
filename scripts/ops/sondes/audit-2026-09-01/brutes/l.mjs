// SONDE (lecture seule) — chaque run rouge : jusqu'à cinq couples (test rouge, première ligne d'erreur).
// Usage : node scripts/ops/sondes/audit-2026-09-01/brutes/l.mjs <dossier-de-données>
// Dossier de données (hors dépôt) — lus et/ou produits : failsteps.json, logs, logs/.
// Recettes de (re)fabrication des dumps : README.md du même dossier.

import fs from 'node:fs';
import { join } from 'node:path';
import { donnees } from '../_socle.mjs';
const DONNEES = donnees("Attendus : failsteps.json, logs, logs/.");

const fails=JSON.parse(fs.readFileSync(join(DONNEES,'failsteps.json')));
const strip=l=>l.replace(/.*?\d{4}-\d\d-\d\dT[\d:.]+Z\s?/,'').replace(new RegExp(String.fromCharCode(27)+'\\[[0-9;]*m','g'),'').trimEnd();
for(const f of fails){
  const p=join(DONNEES,'logs') + '/'+f.id+'.txt'; if(!fs.existsSync(p))continue;
  const t=fs.readFileSync(p,'utf8').split('\n');
  const outs=[];
  for(let i=0;i<t.length;i++){
    const m=t[i].match(/\bFAIL\s+(src\/\S+\.(?:test|spec)\.[tj]sx?)\s*>\s*(.*)$/); if(!m)continue;
    let err='';
    for(let j=i+1;j<Math.min(i+8,t.length);j++){const s=strip(t[j]);if(/Error|expected|thrown|timed out/i.test(s)){err=s.trim();break;}}
    outs.push('    '+m[1]+' > '+strip(m[2]).slice(0,70)+'\n        '+err.slice(0,150));
    if(outs.length>=5)break;
  }
  if(outs.length){console.log('###',f.at,f.sha);console.log(outs.join('\n'));}
}
