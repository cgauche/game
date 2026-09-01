// SONDE (lecture seule) — fiches de `.claude/soldes/` : combien déclarent plus d'un reste ROUTANT, combien usent de « -> RAS : <texte libre> ».
// Usage : node scripts/ops/sondes/audit-2026-09-01/soldes.mjs

import fs from 'node:fs'
import { RACINE } from './_socle.mjs';

const dir=RACINE + '/.claude/soldes/'
const f=fs.readdirSync(dir).filter(x=>x.endsWith('.md'))
let over=0, ras=0, tot=0, routTot=0
for(const n of f){
  const c=fs.readFileSync(dir+n,'utf8')
  const m=/##\s*Restes\s*\n([\s\S]*?)(?:\n\s*\n|\n##|$)/i.exec(c)
  if(!m) continue
  tot++
  const lines=m[1].trim().split('\n').map(s=>s.trim()).filter(Boolean)
  const rout=lines.filter(l=>/->\s*#\d+/.test(l)).length
  routTot+=rout
  if(rout>1) over++
  if(lines.some(l=>/->\s*RAS\s*:/i.test(l))) ras++
}
console.log('soldes avec section Restes',tot,'| >1 reste routant',over,`(${Math.round(100*over/tot)}%)`,'| total restes routants',routTot,'| soldes usant "-> RAS : <texte libre>"',ras)
