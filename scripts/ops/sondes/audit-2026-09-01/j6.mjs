// SONDE (lecture seule) — #1463 : corps intégral des commentaires 28, 36 et 37.
// Usage : node scripts/ops/sondes/audit-2026-09-01/j6.mjs <dossier-de-données>
// Dossier de données (hors dépôt) — lus et/ou produits : i1463.json.
// Recettes de (re)fabrication des dumps : README.md du même dossier.

import fs from 'fs';
import { join } from 'node:path';
import { donnees } from './_socle.mjs';
const DONNEES = donnees("Attendus : i1463.json.");

const j = JSON.parse(fs.readFileSync(join(DONNEES,'i1463.json'),'utf8'));
for (const i of [28,36,37]) { console.log('=== idx'+i, j.comments[i].createdAt); console.log(j.comments[i].body); console.log(); }
