// SONDE (lecture seule) — reconstitution du stock de tickets ouverts à la fin du 30/08 et du 29/08.
// Usage : node scripts/ops/sondes/audit-2026-09-01/brutes/a2.mjs <dossier-de-données>
// Dossier de données (hors dépôt) — lus et/ou produits : closed.json, created.json, open.json.
// Recettes de (re)fabrication des dumps : README.md du même dossier.

import fs from 'fs';
import { join } from 'node:path';
import { donnees } from '../_socle.mjs';
const DONNEES = donnees("Attendus : closed.json, created.json, open.json.");

const R = p => JSON.parse(fs.readFileSync(p));
const c = R(join(DONNEES,'created.json')), cl = R(join(DONNEES,'closed.json')), op = R(join(DONNEES,'open.json'));
const T = '2026-08-30T23:59:59Z';
const openNow = new Set(op.map(x => x.number));
const createdAfterOpen = c.filter(i => i.createdAt > T && openNow.has(i.number));
const closedAfterWasOpen = cl.filter(i => i.closedAt > T && i.createdAt <= T);
console.log('open now', op.length);
console.log('- créés après 08-30 encore ouverts:', createdAfterOpen.length);
console.log('+ fermés après 08-30 créés avant:', closedAfterWasOpen.length);
console.log('=> ouverts à la fin du 08-30 :', op.length - createdAfterOpen.length + closedAfterWasOpen.length);
// fin du 08-29 aussi
const T2 = '2026-08-29T23:59:59Z';
const ca2 = c.filter(i => i.createdAt > T2 && openNow.has(i.number)).length;
const cl2 = cl.filter(i => i.closedAt > T2 && i.createdAt <= T2).length;
console.log('=> ouverts fin 08-29 :', op.length - ca2 + cl2);
