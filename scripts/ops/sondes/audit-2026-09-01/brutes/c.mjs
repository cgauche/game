// SONDE (lecture seule) — runs CI rouges depuis le 31/08 10 h : étapes en échec (produit `failsteps.json`).
// Usage : node scripts/ops/sondes/audit-2026-09-01/brutes/c.mjs <dossier-de-données>
// Dossier de données (hors dépôt) — lus et/ou produits : failsteps.json, runs300.json.
// Recettes de (re)fabrication des dumps : README.md du même dossier.

import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
import { donnees } from '../_socle.mjs';
const DONNEES = donnees("Attendus : failsteps.json, runs300.json.");

const SP=DONNEES;
const r=JSON.parse(fs.readFileSync(SP+'/runs300.json'));
const ci=r.filter(x=>x.name==='CI'&&x.event==='push'&&x.headBranch==='main'&&x.conclusion==='failure'&&x.createdAt>='2026-08-31T10:00:00Z');
const out=[];
for(const x of ci){
  let steps=[];
  try{
    const j=JSON.parse(execFileSync('gh',['run','view',String(x.databaseId),'--json','jobs'],{encoding:'utf8',maxBuffer:1e8}));
    for(const job of j.jobs) for(const s of job.steps) if(s.conclusion==='failure') steps.push(job.name+'/'+s.name);
  }catch{steps=['ERR'];}
  out.push({id:x.databaseId,sha:x.headSha.slice(0,9),at:x.createdAt.slice(5,16),steps});
  console.log(x.createdAt.slice(5,16),x.databaseId,x.headSha.slice(0,9),steps.join(' | '));
}
fs.writeFileSync(SP+'/failsteps.json',JSON.stringify(out,null,1));
