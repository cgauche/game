// SONDE (lecture seule) — décomposition d'un run CI vert : durée de chaque étape ≥ 5 s.
// Usage : node scripts/ops/sondes/audit-2026-09-01/steps.mjs

import {spawnSync} from 'node:child_process';
import { RACINE } from './_socle.mjs';

const REPO=RACINE;
const runs=JSON.parse(spawnSync('gh',['run','list','--branch','main','--workflow','CI','--limit','40','--json','databaseId,conclusion'],{cwd:REPO,encoding:'utf8',shell:true,maxBuffer:1e9}).stdout);
const green=runs.find(r=>r.conclusion==='success');
const jobs=JSON.parse(spawnSync('gh',['api','repos/cgauche/game/actions/runs/'+green.databaseId+'/jobs'],{cwd:REPO,encoding:'utf8',shell:true,maxBuffer:1e9}).stdout);
for(const job of jobs.jobs){
  console.log('JOB',job.name,job.conclusion);
  for(const s of job.steps){const d=(new Date(s.completed_at)-new Date(s.started_at))/1000;if(d>=5)console.log('   ',d+'s',s.name);}
}
