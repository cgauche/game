// SONDE (lecture seule) — table des primitives de CLAUDE.md ⇄ manifeste : rangées, « réflexe avant », rangées sans équivalent au manifeste.
// Usage : node scripts/ops/sondes/audit-2026-09-01/p1-artefacts.mjs

import fs from 'fs';
import { RACINE } from './_socle.mjs';

process.chdir(RACINE);
const m=JSON.parse(fs.readFileSync('src/data/primitives.manifest.json','utf8'));
console.log('manifest entries', m.length, 'champs:', Object.keys(m[0]).join(','));
const cl=fs.readFileSync('CLAUDE.md','utf8');
const start=cl.indexOf('## Primitives partagées');
const end=cl.indexOf('> **Frontière orchestrateur', start);
const seg=cl.slice(start,end);
const prim=seg.split(/\r?\n/).filter(l=>/^\|/.test(l));
console.log('lignes table primitives', prim.length, 'octets segment', seg.length);
console.log('lignes avec "reflexe avant"', prim.filter(l=>/réflexe avant/i.test(l)).length);
console.log('lignes avec "jamais"', prim.filter(l=>/jamais/i.test(l)).length);
const labels=m.map(x=>x.label);
const absents=[];
for(const l of prim.slice(2)){const cells=l.split('|');const p=(cells[2]||'').trim();
 const has=labels.some(lab=>lab.split(/[/ ]/).some(t=>t.length>3&&p.includes(t)));
 if(!has)absents.push(p.slice(0,70));}
console.log('rangees table SANS equivalent manifest:', absents.length, '/', prim.length-2);
console.log(absents.join('\n'));
