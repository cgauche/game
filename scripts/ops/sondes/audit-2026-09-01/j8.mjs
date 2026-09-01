// SONDE (lecture seule) — état (créé/fermé) des tickets nommés de la vague #1463.
// Usage : node scripts/ops/sondes/audit-2026-09-01/j8.mjs <dossier-de-données>
// Dossier de données (hors dépôt) — lus et/ou produits : issues-all.json.
// Recettes de (re)fabrication des dumps : README.md du même dossier.

import fs from 'fs';
import { join } from 'node:path';
import { donnees } from './_socle.mjs';
const DONNEES = donnees("Attendus : issues-all.json.");

const all = JSON.parse(fs.readFileSync(join(DONNEES,'issues-all.json'),'utf8'));
for (const n of [1465,1466,1467,1468,1469,1472,1473,1474,1475,1548,1633,1654,1620,1657,1659,1673]) {
  const i = all.find(x=>x.number===n); if(!i){console.log(n,'ABSENT du dump');continue;}
  console.log('#'+n, i.state, 'créé', i.createdAt.slice(5,16), 'fermé', i.closedAt? i.closedAt.slice(5,16):'—', '|', (i.title||'').slice(0,70));
}
