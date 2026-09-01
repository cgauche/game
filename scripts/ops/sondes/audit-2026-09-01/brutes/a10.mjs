// SONDE (lecture seule) — tickets « Canari rouge » créés depuis le 20/08 et dernier commentaire de #1548.
// Usage : node scripts/ops/sondes/audit-2026-09-01/brutes/a10.mjs <dossier-de-données>
// Dossier de données (hors dépôt) — lus et/ou produits : created.json, iss_1548.json.
// Recettes de (re)fabrication des dumps : README.md du même dossier.

import fs from 'fs';
import { join } from 'node:path';
import { donnees } from '../_socle.mjs';
const DONNEES = donnees("Attendus : created.json, iss_1548.json.");

const c = JSON.parse(fs.readFileSync(join(DONNEES,'created.json')));
const canari = c.filter(i=>/Canari rouge/i.test(i.title));
console.log('canari créés depuis 08-20:', canari.length, canari.map(i=>i.number+':'+i.createdAt.slice(0,10)+':'+i.state).join(' '));
const i1548 = JSON.parse(fs.readFileSync(join(DONNEES,'iss_1548.json')));
const last = i1548.comments.slice(-1)[0];
console.log('--- #1548 dernier commentaire', last.createdAt, '---');
console.log(last.body.slice(0, 2500));
