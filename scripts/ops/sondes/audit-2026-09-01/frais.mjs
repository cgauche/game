// SONDE (lecture seule) — tests de `src/**` citant un `docs/*.md`, et part d'entre eux porteurs d'un cliquet/plafond/stock.
// Usage : node scripts/ops/sondes/audit-2026-09-01/frais.mjs

import fs from 'node:fs'; import path from 'node:path';
import { RACINE } from './_socle.mjs';

const REPO=RACINE + '/src';
const out=[];
const walk=(d)=>{for(const e of fs.readdirSync(d,{withFileTypes:true})){const p=path.join(d,e.name);if(e.isDirectory())walk(p);else if(e.name.endsWith('.test.ts')||e.name.endsWith('.test.tsx'))out.push(p.split(path.sep).join('/'));}};
walk(REPO);
const docsRe=/docs\/[A-Za-z0-9_/-]+\.md/;
const ratchetRe=/(PLAFOND|plafond|_MAX\b|toBeLessThanOrEqual|Stock\.mjs|cliquet)/;
let docTests=0,mixtes=0;const listeMixte=[];
for(const f of out){const t=fs.readFileSync(f,'utf8');
  if(!docsRe.test(t))continue; docTests++;
  if(ratchetRe.test(t)){mixtes++;listeMixte.push(f.replace(RACINE + '/',''));}}
console.log('tests src citant un docs/*.md :',docTests);
console.log('dont porteurs d un cliquet/plafond/stock :',mixtes);
console.log(listeMixte.slice(0,40).join('\n'));
