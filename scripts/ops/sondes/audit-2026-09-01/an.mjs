// SONDE (lecture seule) — ancienneté des tickets ouverts (> 30 j, sans commentaire, sans mise à jour) et échantillon déterministe de 20.
// Usage : node scripts/ops/sondes/audit-2026-09-01/an.mjs <dossier-de-données>
// Dossier de données (hors dépôt) — lus et/ou produits : open.json, pick.json.
// Recettes de (re)fabrication des dumps : README.md du même dossier.

import fs from 'node:fs'
import { donnees } from './_socle.mjs';
const DONNEES = donnees("Attendus : open.json, pick.json.");

const S=DONNEES + '/'
const a=JSON.parse(fs.readFileSync(S+'open.json','utf8'))
const now=Date.now(), D=86400e3
console.log('open total', a.length)
const old30=a.filter(i=>(now-Date.parse(i.createdAt))/D>30)
const oldNoC=old30.filter(i=>i.comments.length===0)
console.log('>30j', old30.length, 'dont 0 commentaire', oldNoC.length)
const silent30=a.filter(i=>(now-Date.parse(i.updatedAt))/D>30)
console.log('sans MAJ >30j', silent30.length)
// echantillon deterministe: 20 repartis
const pick=[]; const step=Math.max(1,Math.floor(oldNoC.length/20))
for(let k=0;k<oldNoC.length&&pick.length<20;k+=step) pick.push(oldNoC[k])
fs.writeFileSync(S+'pick.json', JSON.stringify(pick.map(i=>i.number)))
for(const i of pick) console.log(i.number, Math.round((now-Date.parse(i.createdAt))/D)+'j', (i.labels||[]).map(l=>l.name).join(','), '|', i.title.slice(0,90))
