// SONDE (lecture seule) — portes du pre-commit (`offenders.push`) et consommateurs de `node_type`/`metadata.type` hors mémoire.
// Usage : node scripts/ops/sondes/audit-2026-09-01/p9-artefacts.mjs

import fs from 'fs';
import path from 'path';
import { RACINE } from './_socle.mjs';

const root=RACINE;
const pc=fs.readFileSync(path.join(root,'scripts/git-hooks/pre-commit.mjs'),'utf8');
const gates=[...pc.matchAll(/offenders\.push\(([^\n]{0,110})/g)].map(m=>m[1]);
console.log('gates pre-commit:',gates.length);console.log(gates.join('\n'));
// consommateurs de metadata.type / node_type hors memoire
function walk(d,acc){for(const e of fs.readdirSync(d,{withFileTypes:true})){
 if(e.name==='node_modules'||e.name==='.git'||e.name==='memory'||e.name==='Source'||e.name==='dist')continue;
 const p=path.join(d,e.name);if(e.isDirectory())walk(p,acc);else if(/\.(mjs|mts|ts|tsx|json|md)$/.test(e.name))acc.push(p);}return acc;}
const files=walk(path.join(root,'scripts'),[]).concat(walk(path.join(root,'.claude'),[]),walk(path.join(root,'src/data'),[]));
const hits=[];for(const f of files){const t=fs.readFileSync(f,'utf8');if(/node_type|metadata\.type/.test(t))hits.push(f.replace(root,''));}
console.log('fichiers hors .claude/memory citant node_type/metadata.type:',hits.length);console.log(hits.slice(0,15).join('\n'));
