// SONDE (lecture seule) — #1463 jour 1 : commentaires citant un verbatim utilisateur.
// Usage : node scripts/ops/sondes/audit-2026-09-01/j9.mjs <dossier-de-données>
// Dossier de données (hors dépôt) — lus et/ou produits : i1463.json.
// Recettes de (re)fabrication des dumps : README.md du même dossier.

import fs from 'fs';
import { join } from 'node:path';
import { donnees } from './_socle.mjs';
const DONNEES = donnees("Attendus : i1463.json.");

const j = JSON.parse(fs.readFileSync(join(DONNEES,'i1463.json'),'utf8'));
const d1 = j.comments.filter(c=>c.createdAt.startsWith('2026-08-23'));
const q = d1.filter(c=>/utilisateur[^\n]{0,40}(verbatim|«)|« /.test(c.body));
console.log('commentaires jour 1:', d1.length, '| citant un verbatim utilisateur:', q.length);
for (const c of q) { const m=c.body.match(/«[^»]{10,180}»/); console.log(c.createdAt.slice(11,16), m? m[0].replace(/\s+/g,' ') : ''); }
