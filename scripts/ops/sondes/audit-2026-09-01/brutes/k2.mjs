// SONDE (lecture seule) — chaque run rouge : tests déclarés vs comptés, fichiers, signatures « wedge », étapes.
// Usage : node scripts/ops/sondes/audit-2026-09-01/brutes/k2.mjs <dossier-de-données>
// Dossier de données (hors dépôt) — lus et/ou produits : failsteps.json, logs, logs/.
// Recettes de (re)fabrication des dumps : README.md du même dossier.

import fs from 'node:fs';
import { join } from 'node:path';
import { donnees } from '../_socle.mjs';
const DONNEES = donnees("Attendus : failsteps.json, logs, logs/.");

const fails=JSON.parse(fs.readFileSync(join(DONNEES,'failsteps.json')));
const WEDGE=/expected '' to contain|expected "" to contain|expected null not to be null|expected undefined to be|Unable to find|Test timed out|to be truthy|expected false to be true/;
const rows=[];
for(const f of fails){
  const p=join(DONNEES,'logs') + '/'+f.id+'.txt'; if(!fs.existsSync(p)){rows.push([f.at,f.sha,'NO-LOG']);continue;}
  const t=fs.readFileSync(p,'utf8').split('\n');
  const hdr=(t.find(l=>/Failed Tests \d+/.test(l))||'').match(/Failed Tests (\d+)/);
  let n=0,wedge=0;const files=new Set();
  for(let i=0;i<t.length;i++){
    const m=t[i].match(/\bFAIL\s+(src\/\S+\.(?:test|spec)\.[tj]sx?)\s*>/); if(!m)continue;
    n++;files.add(m[1]);
    const blob=t.slice(i+1,i+7).join(' ');
    if(WEDGE.test(blob))wedge++;
  }
  rows.push([f.at,f.sha,'declares='+(hdr?hdr[1]:'-'),'tests='+n,'fichiers='+files.size,'wedge='+wedge,'steps='+f.steps.map(s=>s.replace('build/Run npm ','')).join(';')]);
}
for(const r of rows)console.log(r.join(' | '));
