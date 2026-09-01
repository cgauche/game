// SONDE (lecture seule) — journaux de runs donnés en argument : lignes d'erreur dédupliquées.
// Usage : node scripts/ops/sondes/audit-2026-09-01/brutes/f.mjs <dossier-de-données>
// Dossier de données (hors dépôt) — lus et/ou produits : logs, logs/.
// Recettes de (re)fabrication des dumps : README.md du même dossier.

import fs from 'node:fs';
import { join } from 'node:path';
import { donnees } from '../_socle.mjs';
const DONNEES = donnees("Attendus : logs, logs/.");

const ids=process.argv.slice(3);
for(const id of ids){
  const t=fs.readFileSync(join(DONNEES,'logs') + '/'+id+'.txt','utf8').split('\n').map(l=>l.replace(/^[^\t]*\t/,'').replace(new RegExp(String.fromCharCode(27)+'\\[[0-9;]*m','g'),''));
  const idx=[];
  t.forEach((l,i)=>{if(/Failed Tests|FAIL\s+src\/|AssertionError|Error: |expected /.test(l))idx.push(i)});
  console.log('=========',id);
  const seen=new Set();let n=0;
  for(const i of idx){const l=t[i].trim();if(!l||seen.has(l))continue;seen.add(l);console.log(l.slice(0,220));if(++n>25)break;}
}
