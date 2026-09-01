// SONDE (lecture seule) — parmi les tickets créés depuis le 31/08, lesquels sont des ENFANTS déclarés d'une fermeture.
// Usage : node scripts/ops/sondes/audit-2026-09-01/brutes/a8.mjs <dossier-de-données>
// Dossier de données (hors dépôt) — lus et/ou produits : created.json, iss_<N>.json.
// Recettes de (re)fabrication des dumps : README.md du même dossier.

import fs from 'fs';
import { join } from 'node:path';
import { donnees } from '../_socle.mjs';
const DONNEES = donnees("Attendus : created.json, iss_<N>.json.");

const dir = DONNEES;
const created = JSON.parse(fs.readFileSync(join(DONNEES,'created.json')));
const sel = created.filter(i => i.createdAt >= '2026-08-31T00:00:00Z').sort((a,b)=>a.number-b.number);
const S = new Set(sel.map(i=>i.number));
const child = new Set();
for (const f of fs.readdirSync(dir).filter(f => /^iss_\d+\.json$/.test(f))) {
  const i = JSON.parse(fs.readFileSync(join(DONNEES,f)));
  const t = (i.comments||[]).filter(cm => cm.createdAt >= new Date(Date.parse(i.closedAt)-36*3600e3).toISOString()).map(c=>c.body).join('\n');
  for (const m of t.matchAll(/#(\d{3,4})/g)) if (S.has(+m[1])) child.add(+m[1]);
}
console.log('parmi les 82, ENFANTS déclarés d\'une fermeture:', child.size);
console.log('NON enfants:', sel.filter(i=>!child.has(i.number)).map(i=>i.number).join(','));
