// SONDE (lecture seule) — commits depuis le 09/08 : part des sujets de RÉPARATION et marqueurs cross-session.
// Usage : node scripts/ops/sondes/audit-2026-09-01/brutes/n.mjs

import {execFileSync} from 'node:child_process';
import { RACINE } from '../_socle.mjs';

const SEP='~~';
const raw=execFileSync('git',['log','--since=2026-08-09','--format=%h'+SEP+'%ad'+SEP+'%s','--date=format:%m-%d'],{cwd:RACINE,encoding:'utf8',maxBuffer:1e9}).trim().split('\n');
const REP=/sillage|COMPL[EÉ]MENT|OUBLI|AVAL[EÉ]|demi-train|redevient vert|corrige la CI|DERNIER rouge|post-merge|r[ée]g[ée]n[ée]r[ée] apr[eè]s|r[ée]paration|re-pose/i;
const CROSS=/staging|AVAL[EÉ]|OUBLI|apr[eè]s le merge|apr[eè]s merge|post-merge|d.origin|origin\/main|train voisin|arbre partag|worktree|session voisine/i;
const by={};const reps=[];
for(const l of raw){const [h,d,s]=l.split(SEP);(by[d]??={n:0,r:0});by[d].n++;if(REP.test(s)){by[d].r++;reps.push([d,h,CROSS.test(s)?'CROIS':'PROPRE',s.slice(0,120)]);}}
for(const d of Object.keys(by).sort())console.log(d,'commits',by[d].n,'reparation',by[d].r,(by[d].r/by[d].n*100).toFixed(0)+'%');
console.log('--- total commits',raw.length,'reparation',reps.length);
console.log('--- dont marqueur cross-session:',reps.filter(r=>r[2]==='CROIS').length);
for(const r of reps)console.log(r.join(' | '));
