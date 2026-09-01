// SONDE (lecture seule) — #1463 : corps intégral des commentaires 12, 13, 14 et 6.
// Usage : node scripts/ops/sondes/audit-2026-09-01/j2.mjs <dossier-de-données>
// Dossier de données (hors dépôt) — lus et/ou produits : i1463.json.
// Recettes de (re)fabrication des dumps : README.md du même dossier.

import fs from 'fs';
import { join } from 'node:path';
import { donnees } from './_socle.mjs';
const DONNEES = donnees("Attendus : i1463.json.");

const j = JSON.parse(fs.readFileSync(join(DONNEES,'i1463.json'),'utf8'));
for (const i of [12,13,14,6]) { console.log('=== #'+i, j.comments[i].createdAt, j.comments[i].url); console.log(j.comments[i].body); }
