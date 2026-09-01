// SONDE (lecture seule) — chaque run rouge : nombre de tests rouges, de fichiers, et de signatures « wedge » (attente vide/introuvable).
// Usage : node scripts/ops/sondes/audit-2026-09-01/brutes/k.mjs <dossier-de-données>
// Dossier de données (hors dépôt) — lus et/ou produits : failsteps.json, logs, logs/.
// Recettes de (re)fabrication des dumps : README.md du même dossier.

import fs from 'node:fs';
import { join } from 'node:path';
import { donnees } from '../_socle.mjs';
const DONNEES = donnees("Attendus : failsteps.json, logs, logs/.");

const clean=l=>l.replace(/^[^\t]*\t/,'').replace(/^\uFEFF?\d{4}-\d\d-\d\dT[\d:.]+Z /,'').replace(new RegExp(String.fromCharCode(27)+'\\[[0-9;]*m','g'),'').trimEnd();
const fails=JSON.parse(fs.readFileSync(join(DONNEES,'failsteps.json')));
const WEDGE=/expected '' to contain|expected null not to be null|expected undefined to be|Unable to find|Test timed out|expected "" to|toBeInTheDocument/;
for(const f of fails){
  const p=join(DONNEES,'logs') + '/'+f.id+'.txt'; if(!fs.existsSync(p)){console.log(f.at,f.sha,'NO-LOG');continue;}
  const t=fs.readFileSync(p,'utf8').split('\n').map(clean);
  const hdr=t.find(l=>/Failed Tests \d+/.test(l));
  let n=0,wedge=0;const files=new Set();
  for(let i=0;i<t.length;i++){
    const m=t[i].match(/^\s*FAIL\s+(src\/\S+\.(?:test|spec)\.[tj]sx?)\s*>/); if(!m)continue;
    n++;files.add(m[1]);
    const blob=t.slice(i+1,i+6).join(' ');
    if(WEDGE.test(blob))wedge++;
  }
  console.log(f.at,f.sha,(hdr||'').replace(/[⎯ ]+/g,' ').trim().padEnd(18),'| tests rouges',n,'| fichiers',files.size,'| signature-wedge',wedge);
}
