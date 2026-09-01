// SONDE (lecture seule) — cadence hebdomadaire créés/fermés sur 8 semaines et quota restant d'une règle « 3 de plus que fermés ».
// Usage : node scripts/ops/sondes/audit-2026-09-01/wk.mjs <dossier-de-données>
// Dossier de données (hors dépôt) — lus et/ou produits : all.json.
// Recettes de (re)fabrication des dumps : README.md du même dossier.

import fs from 'node:fs'
import { donnees } from './_socle.mjs';
const DONNEES = donnees("Attendus : all.json.");

const S=DONNEES + '/'
const a=JSON.parse(fs.readFileSync(S+'all.json','utf8'))
console.log('total issues', a.length, 'closed', a.filter(i=>i.closedAt).length)
const now=Date.now(), D=86400e3
for(let w=0;w<8;w++){
  const hi=now-w*7*D, lo=hi-7*D
  const c=a.filter(i=>{const t=Date.parse(i.createdAt);return t>lo&&t<=hi}).length
  const f=a.filter(i=>i.closedAt&&(()=>{const t=Date.parse(i.closedAt);return t>lo&&t<=hi})()).length
  console.log(`S-${w}`, new Date(lo).toISOString().slice(0,10), 'crees', c, 'fermes', f, 'quota_K3_restant', Math.max(0, f+3-c))
}
