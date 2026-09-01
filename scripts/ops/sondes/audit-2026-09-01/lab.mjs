// SONDE (lecture seule) — labels des tickets ouverts : top 20, `sev:majeur`/`audit:contenu-manquant`, tickets sans aucun label.
// Usage : node scripts/ops/sondes/audit-2026-09-01/lab.mjs <dossier-de-données>
// Dossier de données (hors dépôt) — lus et/ou produits : open.json.
// Recettes de (re)fabrication des dumps : README.md du même dossier.

import fs from 'node:fs'
import { donnees } from './_socle.mjs';
const DONNEES = donnees("Attendus : open.json.");

const S=DONNEES + '/'
const a=JSON.parse(fs.readFileSync(S+'open.json','utf8'))
const c={}
for(const i of a) for(const l of i.labels||[]) c[l.name]=(c[l.name]||0)+1
const top=Object.entries(c).sort((x,y)=>y[1]-x[1])
console.log('labels open (top 20):'); for(const [n,v] of top.slice(0,20)) console.log(' ',v,n)
const cm=a.filter(i=>(i.labels||[]).some(l=>l.name==='audit:contenu-manquant')).length
const sev=a.filter(i=>(i.labels||[]).some(l=>l.name==='sev:majeur')).length
const now=Date.now(),D=86400e3
const old=a.filter(i=>(now-Date.parse(i.createdAt))/D>30)
const oldMaj=old.filter(i=>(i.labels||[]).some(l=>l.name==='sev:majeur')).length
const oldCm=old.filter(i=>(i.labels||[]).some(l=>l.name==='audit:contenu-manquant')).length
console.log('contenu-manquant open',cm,'| sev:majeur open',sev,'| >30j sev:majeur',oldMaj,'| >30j contenu-manquant',oldCm)
console.log('sans label du tout', a.filter(i=>(i.labels||[]).length===0).length)
