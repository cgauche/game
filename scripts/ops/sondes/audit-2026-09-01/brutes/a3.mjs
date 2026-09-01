// SONDE (lecture seule) — tickets créés depuis le 31/08 : labels, état et début de corps.
// Usage : node scripts/ops/sondes/audit-2026-09-01/brutes/a3.mjs <dossier-de-données>
// Dossier de données (hors dépôt) — lus et/ou produits : created.json.
// Recettes de (re)fabrication des dumps : README.md du même dossier.

import fs from 'fs';
import { join } from 'node:path';
import { donnees } from '../_socle.mjs';
const DONNEES = donnees("Attendus : created.json.");

const c = JSON.parse(fs.readFileSync(join(DONNEES,'created.json')));
const sel = c.filter(i => i.createdAt >= '2026-08-31T00:00:00Z').sort((a,b)=>a.number-b.number);
console.log('N =', sel.length);
for (const i of sel) {
  const b = (i.body||'').replace(/\s+/g,' ');
  const labs = i.labels.map(l=>l.name).join(',');
  console.log('---', i.number, '|', i.createdAt.slice(0,10), '|', i.state, '|', labs, '|', i.title);
  console.log('    ', b.slice(0, 420));
}
