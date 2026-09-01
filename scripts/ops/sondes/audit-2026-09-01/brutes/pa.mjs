// SONDE (lecture seule) — mémoire : fiches créées après le 05/07 et création jour par jour sur vingt jours.
// Usage : node scripts/ops/sondes/audit-2026-09-01/brutes/pa.mjs <dossier-de-données>
// Dossier de données (hors dépôt) — lus et/ou produits : cre.json.
// Recettes de (re)fabrication des dumps : README.md du même dossier.

import fs from 'fs';
import { RACINE, donnees } from '../_socle.mjs';
const DONNEES = donnees("Attendus : cre.json.");

const cre=JSON.parse(fs.readFileSync(DONNEES+'/cre.json','utf8'));
const dir=RACINE + '/.claude/memory/';
const files=fs.readdirSync(dir).filter(f=>f.endsWith('.md')&&f!=='MEMORY.md');
const by={}; for(const f of files){const d=cre[f]||'?'; by[d]=(by[d]||0)+1;}
const ks=Object.keys(by).sort();
console.log('premieres dates:',ks.slice(0,3).map(k=>k+':'+by[k]).join(' '));
let after=0; for(const k of ks) if(k>'2026-07-05') after+=by[k];
console.log('creees APRES le 2026-07-05 (plan de consolidation):',after);
console.log('--- 20 derniers jours ---');
ks.filter(k=>k>='2026-08-13').forEach(k=>console.log(k,by[k]));
