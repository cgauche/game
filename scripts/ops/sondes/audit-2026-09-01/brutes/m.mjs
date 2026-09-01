// SONDE (lecture seule) — runs CI rouges ANTÉRIEURS au 31/08 10 h : deux par jour, étapes en échec.
// Usage : node scripts/ops/sondes/audit-2026-09-01/brutes/m.mjs <dossier-de-données>
// Dossier de données (hors dépôt) — lus et/ou produits : runs300.json.
// Recettes de (re)fabrication des dumps : README.md du même dossier.

import fs from 'node:fs';import {execFileSync} from 'node:child_process';
import { donnees } from '../_socle.mjs';
const DONNEES = donnees("Attendus : runs300.json.");

const SP=DONNEES;
const r=JSON.parse(fs.readFileSync(SP+'/runs300.json'));
const ci=r.filter(x=>x.name==='CI'&&x.event==='push'&&x.headBranch==='main'&&x.conclusion==='failure'&&x.createdAt<'2026-08-31T10:00:00Z');
// echantillon: 2 par jour
const byDay={};for(const x of ci){const d=x.createdAt.slice(0,10);(byDay[d]??=[]).push(x);}
for(const d of Object.keys(byDay).sort()){
 for(const x of byDay[d].slice(0,2)){
  let s=[];
  try{const j=JSON.parse(execFileSync('gh',['run','view',String(x.databaseId),'--json','jobs'],{encoding:'utf8',maxBuffer:1e8}));
   for(const job of j.jobs)for(const st of job.steps)if(st.conclusion==='failure')s.push(job.name+'/'+st.name);}catch{s=['ERR'];}
  console.log(d,x.databaseId,x.headSha.slice(0,9),s.join(' | '));
 }
}
