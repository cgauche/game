// SONDE (lecture seule) — CI `push` sur `main` : vert/rouge par jour et taux de rouge.
// Usage : node scripts/ops/sondes/audit-2026-09-01/brutes/b.mjs <dossier-de-données>
// Dossier de données (hors dépôt) — lus et/ou produits : runs300.json.
// Recettes de (re)fabrication des dumps : README.md du même dossier.

import fs from 'node:fs';
import { join } from 'node:path';
import { donnees } from '../_socle.mjs';
const DONNEES = donnees("Attendus : runs300.json.");

const r=JSON.parse(fs.readFileSync(join(DONNEES,'runs300.json')));
const ci=r.filter(x=>x.name==='CI'&&x.event==='push'&&x.headBranch==='main');
console.log('CI push main runs',ci.length,'from',ci[ci.length-1].createdAt,'to',ci[0].createdAt);
const by={};
for(const x of ci){const d=x.createdAt.slice(0,10);(by[d]??={ok:0,ko:0,autre:0});
 if(x.conclusion==='success')by[d].ok++;else if(x.conclusion==='failure')by[d].ko++;else by[d].autre++;}
for(const d of Object.keys(by).sort())console.log(d, 'vert',by[d].ok,'rouge',by[d].ko,'autre',by[d].autre, 'tauxRouge', (by[d].ko/(by[d].ok+by[d].ko+by[d].autre)*100).toFixed(0)+'%');
