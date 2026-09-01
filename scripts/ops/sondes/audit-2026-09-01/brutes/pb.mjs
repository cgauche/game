// SONDE (lecture seule) — mémoire : fiches créées depuis le 29/08 — indexées ou orphelines — et fiches non suivies par git.
// Usage : node scripts/ops/sondes/audit-2026-09-01/brutes/pb.mjs <dossier-de-données>
// Dossier de données (hors dépôt) — lus et/ou produits : cre.json.
// Recettes de (re)fabrication des dumps : README.md du même dossier.

import fs from 'fs';
import { RACINE, donnees } from '../_socle.mjs';
const DONNEES = donnees("Attendus : cre.json.");

const cre=JSON.parse(fs.readFileSync(DONNEES+'/cre.json','utf8'));
const dir=RACINE + '/.claude/memory/';
const idx=fs.readFileSync(dir+'MEMORY.md','utf8');
const today=Object.entries(cre).filter(([, d])=>d>='2026-08-29').sort((a,b)=>a[1].localeCompare(b[1]));
for(const [f,d] of today){ if(!fs.existsSync(dir+f)) continue; console.log(d, idx.includes(f)?'INDEXE ':'ORPHELIN', fs.statSync(dir+f).size, f); }
const untracked=fs.readdirSync(dir).filter(f=>f.endsWith('.md')&&f!=='MEMORY.md'&&!cre[f]);
console.log('NON SUIVIES (git):',untracked.join(','));
