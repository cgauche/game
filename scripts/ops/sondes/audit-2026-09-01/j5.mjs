// SONDE (lecture seule) — #1463 : localisation du commentaire de pilotage et somme des octets de commentaires.
// Usage : node scripts/ops/sondes/audit-2026-09-01/j5.mjs <dossier-de-données>
// Dossier de données (hors dépôt) — lus et/ou produits : i1463.json.
// Recettes de (re)fabrication des dumps : README.md du même dossier.

import fs from 'fs';
import { join } from 'node:path';
import { donnees } from './_socle.mjs';
const DONNEES = donnees("Attendus : i1463.json.");

const j = JSON.parse(fs.readFileSync(join(DONNEES,'i1463.json'),'utf8'));
const c = j.comments.find(x=>x.url.includes('5481350492'));
console.log('5481350492 trouvé ?', !!c, c? c.createdAt+' '+c.body.length+' c':'');
j.comments.forEach((x,i)=>{ if(/PILOTAGE|Pilotage/.test(x.body.slice(0,200))) console.log('pilotage idx',i,x.createdAt.slice(0,16),x.body.length,x.url.split('#')[1]); });
console.log('--- somme des commentaires:', j.comments.reduce((a,b)=>a+b.body.length,0), 'c');
