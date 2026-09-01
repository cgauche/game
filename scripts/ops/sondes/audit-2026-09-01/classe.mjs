// SONDE (lecture seule) — densité NARRATIVE du skill `orchestrer-des-agents` : part de caractères en récit daté/vécu, par section.
// Usage : node scripts/ops/sondes/audit-2026-09-01/classe.mjs

import {readFileSync} from 'node:fs';
import { RACINE } from './_socle.mjs';

const p=RACINE + '/.claude/skills/orchestrer-des-agents/SKILL.md';
const txt=readFileSync(p,'utf8');
// unite = phrase (split sur . ; : ) en gardant la position
const NARR=/[Vv]écu|[Mm]esuré[e]?\b|Mesuré|audit 20|20\d\d-\d\d-\d\d|contre-modèle|flag de l|flag user|Audit 20/;
const SELF=/je (ne )?(sais|le sais|retiens|applique)|Mon grounding|ma pratique|je réponds bien/i;
let total=0, narr=0, self=0;
const units=txt.split(/(?<=[.;])\s+/);
for(const u of units){ total+=u.length; if(NARR.test(u)) narr+=u.length; else if(SELF.test(u)) self+=u.length; }
console.log('caracteres total',total,'| narratif(vecu/mesure date)',narr,(100*narr/total).toFixed(1)+'%','| auto-eval',self);
// densite par section
const lines=txt.split('\n');
const secs=[[1,11,'preambule'],[12,221,'Cycle'],[222,266,'Regime'],[267,285,'Calibrage'],[286,308,'Rationalisations'],[309,345,'RedFlags']];
for(const [a,b,n] of secs){ const s=lines.slice(a-1,b).join('\n'); const us=s.split(/(?<=[.;])\s+/); let t=0,v=0; for(const u of us){t+=u.length; if(NARR.test(u)) v+=u.length;} console.log(n,'lignes',b-a+1,'chars',t,'narratif',v,(100*v/t).toFixed(0)+'%'); }
