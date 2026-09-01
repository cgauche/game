// SONDE (lecture seule) — tickets déclarant #1463 comme parent/épic dans leur corps.
// Usage : node scripts/ops/sondes/audit-2026-09-01/j3.mjs <dossier-de-données>
// Dossier de données (hors dépôt) — lus et/ou produits : issues-all.json.
// Recettes de (re)fabrication des dumps : README.md du même dossier.

import fs from 'fs';
import { join } from 'node:path';
import { donnees } from './_socle.mjs';
const DONNEES = donnees("Attendus : issues-all.json.");

const all = JSON.parse(fs.readFileSync(join(DONNEES,'issues-all.json'),'utf8'));
console.log('N=',all.length,'keys=',Object.keys(all[0]).join(','));
const parentOf=new Map();
for(const i of all){ const m=(i.body||'').match(/(?:Parent|Épic|Epic|Rattach\w*|Chantier)\s*:?\s*#(\d+)/i); if(m) parentOf.set(i.number, +m[1]); }
const g1=[...parentOf.entries()].filter(([, v])=>v===1463).map(([k])=>k).sort((a,b)=>a-b);
console.log('G1 (par mention Parent/Épic dans body):', g1.length, g1.join(' '));
