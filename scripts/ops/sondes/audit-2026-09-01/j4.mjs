// SONDE (lecture seule) — tickets citant #1463 dans leur corps : cadence de création, ouverts/fermés, liste.
// Usage : node scripts/ops/sondes/audit-2026-09-01/j4.mjs <dossier-de-données>
// Dossier de données (hors dépôt) — lus et/ou produits : issues-all.json.
// Recettes de (re)fabrication des dumps : README.md du même dossier.

import fs from 'fs';
import { join } from 'node:path';
import { donnees } from './_socle.mjs';
const DONNEES = donnees("Attendus : issues-all.json.");

const all = JSON.parse(fs.readFileSync(join(DONNEES,'issues-all.json'),'utf8'));
const g1 = all.filter(i=>/#1463\b/.test(i.body||'')).sort((a,b)=>a.number-b.number);
console.log('G1 (toute mention #1463 dans le body):', g1.length);
const byDay={}; for(const i of g1){const d=i.createdAt.slice(0,10); byDay[d]=(byDay[d]||0)+1;}
console.log('créés par jour:', JSON.stringify(byDay));
console.log('ouverts:', g1.filter(i=>i.state==='OPEN').length, '| fermés:', g1.filter(i=>i.state!=='OPEN').length);
for(const i of g1) console.log(i.number, i.state==='OPEN'?'O':'F', i.createdAt.slice(5,10), (i.title||'').replace(/\s+/g,' ').slice(0,95));
