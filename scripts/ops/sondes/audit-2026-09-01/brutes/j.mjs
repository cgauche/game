// SONDE (lecture seule) — journal d'un run donné en argument : fenêtre de 120 lignes autour de « Failed Tests ».
// Usage : node scripts/ops/sondes/audit-2026-09-01/brutes/j.mjs <dossier-de-données>
// Dossier de données (hors dépôt) — lus et/ou produits : logs, logs/.
// Recettes de (re)fabrication des dumps : README.md du même dossier.

import fs from 'node:fs';
import { join } from 'node:path';
import { donnees } from '../_socle.mjs';
const DONNEES = donnees("Attendus : logs, logs/.");

const clean=l=>l.replace(/^[^\t]*\t/,'').replace(/^\uFEFF?\d{4}-\d\d-\d\dT[\d:.]+Z /,'').replace(new RegExp(String.fromCharCode(27)+'\\[[0-9;]*m','g'),'').trimEnd();
const t=fs.readFileSync(join(DONNEES,'logs') + '/'+process.argv[3]+'.txt','utf8').split('\n').map(clean);
const start=t.findIndex(l=>/Failed Tests/.test(l));
console.log('start',start,'len',t.length);
for(let i=Math.max(0,start-5);i<Math.min(t.length,start+120);i++)console.log(i,t[i].slice(0,180));
