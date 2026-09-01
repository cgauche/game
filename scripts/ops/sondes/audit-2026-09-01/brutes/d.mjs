// SONDE (lecture seule) — téléchargement des journaux `--log-failed` des runs rouges de `failsteps.json`.
// Usage : node scripts/ops/sondes/audit-2026-09-01/brutes/d.mjs <dossier-de-données>
// Dossier de données (hors dépôt) — lus et/ou produits : failsteps.json, logs/.
// Recettes de (re)fabrication des dumps : README.md du même dossier.

import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
import { donnees } from '../_socle.mjs';
const DONNEES = donnees("Attendus : failsteps.json, logs/.");

const SP=DONNEES;
const fails=JSON.parse(fs.readFileSync(SP+'/failsteps.json'));
fs.mkdirSync(SP+'/logs',{recursive:true});
for(const f of fails){
  const p=SP+'/logs/'+f.id+'.txt';
  if(fs.existsSync(p))continue;
  try{const t=execFileSync('gh',['run','view',String(f.id),'--log-failed'],{encoding:'utf8',maxBuffer:5e8});fs.writeFileSync(p,t);}
  catch(e){fs.writeFileSync(p,'ERR '+String(e).slice(0,300));}
  console.log('ok',f.id,fs.statSync(p).size);
}
