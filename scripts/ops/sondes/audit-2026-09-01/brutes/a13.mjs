// SONDE (lecture seule) — historique du stock `structuresStock.mjs` : cardinal de chaque liste par commit depuis le 28/08.
// Usage : node scripts/ops/sondes/audit-2026-09-01/brutes/a13.mjs

import { execFileSync } from 'child_process';
import { RACINE } from '../_socle.mjs';

const repo=RACINE;
const shas = execFileSync('git',['log','--since=2026-08-28','--format=%h %ad','--date=short','--','scripts/guards/lib/structuresStock.mjs'],{cwd:repo,encoding:'utf8'}).trim().split('\n');
console.log('commits touchant le stock depuis 08-28:', shas.length);
for (const line of shas.slice(0, 40)) {
  const sha = line.split(' ')[0];
  let txt; try { txt = execFileSync('git',['show',`${sha}:scripts/guards/lib/structuresStock.mjs`],{cwd:repo,encoding:'utf8',maxBuffer:1e8}); } catch { continue; }
  const seg = (name) => { const i = txt.indexOf('export const '+name); if (i<0) return '-'; const j = txt.indexOf('\n];', i); return (txt.slice(i,j).match(/\n {2}\{/g)||[]).length; };
  console.log(line, '| REDECL', seg('STRUCTURES_REDECLARATIONS'), '| FORMES', seg('STRUCTURES_FORMES'), '| ORPHELINES', seg('STRUCTURES_ORPHELINES'), '| DEFAUT', seg('STRUCTURES_DEFAUT'));
}
