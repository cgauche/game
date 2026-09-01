// SONDE (lecture seule) — runs GitHub Actions du dump `runs.json` : liste des runs de `main` (id, sha, conclusion, événement).
// Usage : node scripts/ops/sondes/audit-2026-09-01/brutes/a.mjs <dossier-de-données>
// Dossier de données (hors dépôt) — lus et/ou produits : runs.json.
// Recettes de (re)fabrication des dumps : README.md du même dossier.

import fs from 'node:fs';
import { join } from 'node:path';
import { donnees } from '../_socle.mjs';
const DONNEES = donnees("Attendus : runs.json.");

const r=JSON.parse(fs.readFileSync(join(DONNEES,'runs.json')));
console.log('total',r.length,'range',r[r.length-1].createdAt,'->',r[0].createdAt);
const f=r.filter(x=>x.headBranch==='main');
console.log('main runs',f.length);
for(const x of f) console.log(x.createdAt.slice(5,16), x.databaseId, x.headSha.slice(0,9), (x.conclusion||x.status).padEnd(11), x.event, '|', x.name);
