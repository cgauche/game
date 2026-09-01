// SONDE (lecture seule) — chaque run rouge : sujet du commit, fichiers touchés, tests rouges, et le commit touche-t-il ces tests.
// Usage : node scripts/ops/sondes/audit-2026-09-01/brutes/h.mjs <dossier-de-données>
// Dossier de données (hors dépôt) — lus et/ou produits : failsteps.json, logs/.
// Recettes de (re)fabrication des dumps : README.md du même dossier.

import fs from 'node:fs';import {execFileSync} from 'node:child_process';
import { RACINE, donnees } from '../_socle.mjs';
const DONNEES = donnees("Attendus : failsteps.json, logs/.");

const SP=DONNEES;
const fails=JSON.parse(fs.readFileSync(SP+'/failsteps.json'));
const clean=l=>l.replace(/^[^\t]*\t/,'').replace(/^\uFEFF?\d{4}-\d\d-\d\dT[\d:.]+Z /,'').replace(new RegExp(String.fromCharCode(27)+'\\[[0-9;]*m','g'),'');
for(const f of fails){
  let subj='?',files=[];
  try{subj=execFileSync('git',['log','-1','--format=%s',f.sha],{cwd:RACINE,encoding:'utf8'}).trim().slice(0,110);}catch{}
  try{files=execFileSync('git',['show','--name-only','--format=','-m','--first-parent',f.sha],{cwd:RACINE,encoding:'utf8'}).trim().split('\n').filter(Boolean);}catch{}
  const ftests=new Set();
  const p=SP+'/logs/'+f.id+'.txt';
  if(fs.existsSync(p))for(const l of fs.readFileSync(p,'utf8').split('\n').map(clean)){const m=l.match(/(?:FAIL|❯)\s+(src\/\S+\.(?:test|spec)\.[tj]sx?)/);if(m)ftests.add(m[1]);}
  console.log('###',f.at,f.sha,'|',f.steps.map(s=>s.replace('build/Run npm ','')).join(';'));
  console.log('  subj:',subj);
  console.log('  nfiles:',files.length,'| tests rouges:',[...ftests].join(' , ')||'(hors vitest)');
  console.log('  touche-t-il ces tests ?', [...ftests].filter(t=>files.includes(t)).join(',')||'NON');
}
