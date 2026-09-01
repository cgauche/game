// SONDE (lecture seule) — pour chaque ticket fermé dumpé : tickets NEUFS cités au voisinage de la fermeture.
// Usage : node scripts/ops/sondes/audit-2026-09-01/brutes/a7.mjs <dossier-de-données>
// Dossier de données (hors dépôt) — lus et/ou produits : created.json, iss_<N>.json.
// Recettes de (re)fabrication des dumps : README.md du même dossier.

import fs from 'fs';
import { join } from 'node:path';
import { donnees } from '../_socle.mjs';
const DONNEES = donnees("Attendus : created.json, iss_<N>.json.");

const dir = DONNEES;
const created = JSON.parse(fs.readFileSync(join(DONNEES,'created.json')));
const newSince30 = new Map(created.filter(i => i.createdAt >= '2026-08-30T00:00:00Z').map(i => [i.number, i]));
const nums = fs.readdirSync(dir).filter(f => /^iss_\d+\.json$/.test(f));
let total = 0;
for (const f of nums) {
  const i = JSON.parse(fs.readFileSync(join(DONNEES,f)));
  const closedAt = i.closedAt;
  // ne considérer que les commentaires postés le jour de fermeture ou après-1j
  const texts = (i.comments||[]).filter(cm => cm.createdAt >= new Date(Date.parse(closedAt) - 36*3600e3).toISOString()).map(cm => cm.body).join('\n');
  const refs = new Set();
  for (const m of texts.matchAll(/#(\d{3,4})/g)) { const n = +m[1]; if (newSince30.has(n) && n !== i.number) refs.add(n); }
  const arrow = new Set();
  for (const m of texts.matchAll(/(?:->|→|reste[s]?\s*:?|sorti[e]?s?\s+(?:en|vers)|ouvre|émis?)\s*#(\d{3,4})/gi)) { const n=+m[1]; if (newSince30.has(n)) arrow.add(n); }
  console.log(i.number, 'fermé', closedAt.slice(0,10), '| tickets NEUFS cités près de la fermeture:', refs.size, [...refs].join(','), '| motif reste/->:', arrow.size, [...arrow].join(','));
  total += refs.size;
}
console.log('TOTAL renvois vers tickets neufs:', total);
