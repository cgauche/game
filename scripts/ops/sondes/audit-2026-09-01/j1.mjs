// SONDE (lecture seule) — #1463 : taille du corps, nombre et cadence des commentaires, index des commentaires.
// Usage : node scripts/ops/sondes/audit-2026-09-01/j1.mjs <dossier-de-données>
// Dossier de données (hors dépôt) — lus et/ou produits : i1463.json.
// Recettes de (re)fabrication des dumps : README.md du même dossier.

import fs from 'fs';
import { join } from 'node:path';
import { donnees } from './_socle.mjs';
const DONNEES = donnees("Attendus : i1463.json.");

const j = JSON.parse(fs.readFileSync(join(DONNEES,'i1463.json'),'utf8'));
console.log('TITRE:', j.title);
console.log('CREE:', j.createdAt, '| body', j.body.length, 'c | comments', j.comments.length);
const byDay = {};
for (const c of j.comments) { const d=c.createdAt.slice(0,10); byDay[d]=(byDay[d]||0)+1; }
console.log('par jour:', JSON.stringify(byDay));
j.comments.forEach((c,i)=>console.log(String(i).padStart(2), c.createdAt.slice(0,16), String(c.body.length).padStart(6), (c.body.replace(/\s+/g,' ').slice(0,120))));
