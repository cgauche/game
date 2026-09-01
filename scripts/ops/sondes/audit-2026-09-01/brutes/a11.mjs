// SONDE (lecture seule) — section « Restes » du dernier commentaire de #1457, #1553 et #1580.
// Usage : node scripts/ops/sondes/audit-2026-09-01/brutes/a11.mjs <dossier-de-données>
// Dossier de données (hors dépôt) — lus et/ou produits : iss_1457.json, iss_1553.json, iss_1580.json.
// Recettes de (re)fabrication des dumps : README.md du même dossier.

import fs from 'fs';
import { join } from 'node:path';
import { donnees } from '../_socle.mjs';
const DONNEES = donnees("Attendus : iss_1457.json, iss_1553.json, iss_1580.json.");

for (const f of ['iss_1457.json','iss_1553.json','iss_1580.json']) {
  const i = JSON.parse(fs.readFileSync(join(DONNEES,f)));
  const last = i.comments.slice(-1)[0];
  const m = (last.body.match(/## Restes[\s\S]{0,1600}/) || [last.body.slice(0,600)])[0];
  console.log('=== #'+i.number, 'fermé', i.closedAt.slice(0,10), '===');
  console.log(m.slice(0, 1400));
}
