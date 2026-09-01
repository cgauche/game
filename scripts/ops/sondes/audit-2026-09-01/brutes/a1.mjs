// SONDE (lecture seule) — tickets créés/fermés par jour depuis le 20/08.
// Usage : node scripts/ops/sondes/audit-2026-09-01/brutes/a1.mjs <dossier-de-données>
// Dossier de données (hors dépôt) — lus et/ou produits : closed.json, created.json, open.json.
// Recettes de (re)fabrication des dumps : README.md du même dossier.

import fs from 'fs';
import { join } from 'node:path';
import { donnees } from '../_socle.mjs';
const DONNEES = donnees("Attendus : closed.json, created.json, open.json.");

const R = p => JSON.parse(fs.readFileSync(p));
const c = R(join(DONNEES,'created.json')), cl = R(join(DONNEES,'closed.json')), op = R(join(DONNEES,'open.json'));
console.log('created>=0820:', c.length, 'closed>=0820:', cl.length, 'open total:', op.length);
console.log('max#', Math.max(...c.map(x => x.number)), 'min#', Math.min(...c.map(x => x.number)));
const d = {};
for (const i of c) { const k = i.createdAt.slice(0,10); (d[k] ??= {cr:0,cl:0}).cr++; }
for (const i of cl) { const k = i.closedAt.slice(0,10); (d[k] ??= {cr:0,cl:0}).cl++; }
for (const k of Object.keys(d).sort()) console.log(k, 'créés', d[k].cr, 'fermés', d[k].cl, 'net', d[k].cr - d[k].cl);
