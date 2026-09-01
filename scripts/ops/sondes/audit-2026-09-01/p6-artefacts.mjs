// SONDE (lecture seule) — skill `orchestrer-des-agents` : octets, part des segments à marqueur de vécu, taille de la table Rationalisations.
// Usage : node scripts/ops/sondes/audit-2026-09-01/p6-artefacts.mjs

import fs from 'fs';
import { RACINE } from './_socle.mjs';

const t=fs.readFileSync(RACINE + '/.claude/skills/orchestrer-des-agents/SKILL.md','utf8');
console.log('octets total',t.length,'lignes',t.split(/\r?\n/).length);
const sent=t.split(/(?<=[.!?»])\s+/);
const rx=/([Vv]écu|[MmÉé]esuré|[Aa]udit 20|#\d{2,4}|20\d\d-\d\d-\d\d)/;
let v=0,n=0;for(const s of sent){if(rx.test(s)){v+=s.length;n++;}}
console.log('segments a marqueur de vecu',n,'octets',v,'=',(100*v/t.length).toFixed(1)+'%');
// table Rationalisations
const a=t.indexOf('## Rationalisations');const b=t.indexOf('## Red flags');
console.log('table Rationalisations octets',b-a,'lignes',t.slice(a,b).split(/\r?\n/).filter(l=>/^\|/.test(l)).length-2);
// procede pur : lignes sans marqueur
let pure=0;for(const l of t.split(/\r?\n/))if(!rx.test(l))pure++;
console.log('lignes sans marqueur de vecu',pure);
