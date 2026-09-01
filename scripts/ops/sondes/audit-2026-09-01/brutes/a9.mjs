// SONDE (lecture seule) — tickets récents cités par un message de COMMIT depuis le 30/08, et commits par jour.
// Usage : node scripts/ops/sondes/audit-2026-09-01/brutes/a9.mjs <dossier-de-données>
// Dossier de données (hors dépôt) — lus et/ou produits : created.json.
// Recettes de (re)fabrication des dumps : README.md du même dossier.

import { execFileSync } from 'child_process';
import fs from 'fs';
import { join } from 'node:path';
import { RACINE, donnees } from '../_socle.mjs';
const DONNEES = donnees("Attendus : created.json.");

const log = execFileSync('git', ['log','--since=2026-08-30','--format=%h|%ad|%B%x00','--date=short'], {cwd:RACINE, encoding:'utf8', maxBuffer:1e8});
const commits = log.split('\0').filter(s=>s.trim());
console.log('commits depuis 08-30:', commits.length);
const created = JSON.parse(fs.readFileSync(join(DONNEES,'created.json')));
const sel = new Set(created.filter(i=>i.createdAt>='2026-08-31T00:00:00Z').map(i=>i.number));
const cited = new Set();
for (const c of commits) for (const m of c.matchAll(/#(\d{3,4})/g)) if (sel.has(+m[1])) cited.add(+m[1]);
console.log('parmi les 82, cités dans un message de COMMIT depuis 08-30:', cited.size, [...cited].sort((a,b)=>a-b).join(','));
// combien de commits par jour
const perDay={}; for (const c of commits){const d=c.split('|')[1]; perDay[d]=(perDay[d]||0)+1;}
console.log('commits/jour', JSON.stringify(perDay));
