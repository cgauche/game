// SONDE (lecture seule) — tickets fermés depuis le 30/08 (liste, et dump `closed_nums.txt`).
// Usage : node scripts/ops/sondes/audit-2026-09-01/brutes/a6.mjs <dossier-de-données>
// Dossier de données (hors dépôt) — lus et/ou produits : closed.json, closed_nums.txt.
// Recettes de (re)fabrication des dumps : README.md du même dossier.

import fs from 'fs';
import { join } from 'node:path';
import { donnees } from '../_socle.mjs';
const DONNEES = donnees("Attendus : closed.json, closed_nums.txt.");

const cl = JSON.parse(fs.readFileSync(join(DONNEES,'closed.json')));
const sel = cl.filter(i => i.closedAt >= '2026-08-30T00:00:00Z').sort((a,b)=>a.number-b.number);
console.log('fermés >= 08-30 :', sel.length);
for (const i of sel) console.log(i.number, i.closedAt.slice(0,10), i.title.slice(0,110));
fs.writeFileSync(join(DONNEES,'closed_nums.txt'), sel.map(i=>i.number).join('\n'));
