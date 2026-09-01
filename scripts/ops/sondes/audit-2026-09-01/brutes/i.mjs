// SONDE (lecture seule) — journaux de runs donnés en argument : tests rouges groupés par TYPE d'erreur.
// Usage : node scripts/ops/sondes/audit-2026-09-01/brutes/i.mjs <dossier-de-données>
// Dossier de données (hors dépôt) — lus et/ou produits : logs, logs/.
// Recettes de (re)fabrication des dumps : README.md du même dossier.

import fs from 'node:fs';
import { join } from 'node:path';
import { donnees } from '../_socle.mjs';
const DONNEES = donnees("Attendus : logs, logs/.");

const clean=l=>l.replace(/^[^\t]*\t/,'').replace(/^\uFEFF?\d{4}-\d\d-\d\dT[\d:.]+Z /,'').replace(new RegExp(String.fromCharCode(27)+'\\[[0-9;]*m','g'),'').trimEnd();
for(const id of process.argv.slice(3)){
  const t=fs.readFileSync(join(DONNEES,'logs') + '/'+id+'.txt','utf8').split('\n').map(clean);
  console.log('=====',id);
  const kinds={};
  for(let i=0;i<t.length;i++){
    const m=t[i].match(/^\s*(?:FAIL|❯)\s+(src\/\S+\.(?:test|spec)\.[tj]sx?)\s*>\s*(.*)$/);
    if(!m)continue;
    // look ahead for error line
    let err='';
    for(let j=i+1;j<Math.min(i+12,t.length);j++){const e=t[j].match(/(TestingLibraryElementError|AssertionError|Error: .*|Test timed out.*|thrown: .*)/);if(e){err=e[1].slice(0,110);break;}}
    (kinds[err||'(?)']??=[]).push(m[1]);
  }
  for(const [k,v] of Object.entries(kinds))console.log('  ',v.length,'×',k,'::',[...new Set(v)].slice(0,4).join(','));
}
