// SONDE (lecture seule) — tickets créés depuis le 31/08 : décompte par label et titres.
// Usage : node scripts/ops/sondes/audit-2026-09-01/brutes/a4.mjs <dossier-de-données>
// Dossier de données (hors dépôt) — lus et/ou produits : created.json.
// Recettes de (re)fabrication des dumps : README.md du même dossier.

import fs from 'fs';
import { join } from 'node:path';
import { donnees } from '../_socle.mjs';
const DONNEES = donnees("Attendus : created.json.");

const c = JSON.parse(fs.readFileSync(join(DONNEES,'created.json')));
const sel = c.filter(i => i.createdAt >= '2026-08-31T00:00:00Z').sort((a,b)=>a.number-b.number);
const cnt = {};
for (const i of sel) for (const l of i.labels) cnt[l.name] = (cnt[l.name]||0)+1;
console.log(Object.entries(cnt).sort((a,b)=>b[1]-a[1]).map(([k,v])=>k+'='+v).join(' | '));
console.log('--- titres ---');
for (const i of sel) console.log(i.number, i.createdAt.slice(8,10), '[' + i.labels.map(l=>l.name).filter(n=>/^(audit|chantier|type|sev):/.test(n)).join(' ') + ']', i.title.slice(0,150));
