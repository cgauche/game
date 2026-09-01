// SONDE (lecture seule) — commits depuis le 23/08 : citent-ils la liste JOUR 1 de #1463, un enfant DÉCOUVERT après, ou ni l'un ni l'autre.
// Usage : node scripts/ops/sondes/audit-2026-09-01/j7.mjs <dossier-de-données>
// Dossier de données (hors dépôt) — lus et/ou produits : issues-all.json, log1463.txt.
// Recettes de (re)fabrication des dumps : README.md du même dossier.

import fs from 'fs';
import { join } from 'node:path';
import { donnees } from './_socle.mjs';
const DONNEES = donnees("Attendus : issues-all.json, log1463.txt.");

const lines = fs.readFileSync(join(DONNEES,'log1463.txt'),'utf8').trim().split('\n');
const jour1 = new Set([1465,1466,1467,1468,1469,1472,1473,1474,1475]); // liste du jour 1 (commentaire 12 + 13)
const all = JSON.parse(fs.readFileSync(join(DONNEES,'issues-all.json'),'utf8'));
const g1 = new Set(all.filter(i=>/#1463\b/.test(i.body||'')).map(i=>i.number));
let cJ1=0,cDec=0,cAutre=0; const decNums=new Map();
for (const l of lines){ const nums=[...l.matchAll(/#(\d+)/g)].map(m=>+m[1]);
  if(nums.some(n=>jour1.has(n))) cJ1++;
  else if(nums.some(n=>g1.has(n))) { cDec++; for(const n of nums) if(g1.has(n)) decNums.set(n,(decNums.get(n)||0)+1); }
  else cAutre++; }
console.log('commits depuis 08-23:', lines.length, '| citant un ticket de la LISTE JOUR 1:', cJ1, '| citant un enfant #1463 DÉCOUVERT après:', cDec, '| autres:', cAutre);
console.log('top enfants découverts par commits:', [...decNums.entries()].sort((a,b)=>b[1]-a[1]).slice(0,12).map(([n,c])=>`#${n}:${c}`).join(' '));
// tickets fermés G1 avec date de création
const closed = all.filter(i=>g1.has(i.number)&&i.state!=='OPEN');
console.log('G1 FERMÉS:', closed.map(i=>`#${i.number}(créé ${i.createdAt.slice(5,10)}, ${jour1.has(i.number)?'LISTE J1':'DÉCOUVERT'})`).join(' '));
