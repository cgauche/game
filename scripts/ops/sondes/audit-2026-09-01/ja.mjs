// SONDE (lecture seule) — #1463 : le commentaire de pilotage v8 nomme-t-il encore chaque lot L0..L6 et chaque ticket.
// Usage : node scripts/ops/sondes/audit-2026-09-01/ja.mjs <dossier-de-données>
// Dossier de données (hors dépôt) — lus et/ou produits : i1463.json.
// Recettes de (re)fabrication des dumps : README.md du même dossier.

import fs from 'fs';
import { join } from 'node:path';
import { donnees } from './_socle.mjs';
const DONNEES = donnees("Attendus : i1463.json.");

const j=JSON.parse(fs.readFileSync(join(DONNEES,'i1463.json'),'utf8'));
const v8=j.comments[28].body;
for (const t of ['L0','L1a','L1b','L1c','L1d','L2','L3','L4','L5','L6','#1468','#1469','#1473','#1474','#1475','DoD'])
  console.log(t.padEnd(6), v8.includes(t)?'présent':'ABSENT de v8');
console.log('renvois à un autre commentaire:', (v8.match(/v[0-9]/g)||[]).join(','));
