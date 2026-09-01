// SONDE (lecture seule) — tickets OUVERTS cités quelque part dans l'arbre suivi, par zone.
// Usage : node scripts/ops/sondes/audit-2026-09-01/refs.mjs <dossier-de-données>
// Dossier de données (hors dépôt) — lus et/ou produits : open.json.
// Recettes de (re)fabrication des dumps : README.md du même dossier.

import fs from 'node:fs'
import { execSync } from 'node:child_process'
import { RACINE, donnees } from './_socle.mjs';
const DONNEES = donnees("Attendus : open.json.");

const ROOT=RACINE
const S=DONNEES + '/'
const open=new Set(JSON.parse(fs.readFileSync(S+'open.json','utf8')).map(i=>i.number))
const files=execSync('git ls-files',{cwd:ROOT,maxBuffer:1e8}).toString().split('\n').filter(Boolean)
const cible=files.filter(f=>/^(src|scripts|docs|\.claude)\//.test(f)&&/\.(ts|tsx|mjs|js|json|md)$/.test(f))
const hit=new Map()
for(const f of cible){
  let t; try{t=fs.readFileSync(ROOT+'/'+f,'utf8')}catch{continue}
  for(const m of t.matchAll(/#(\d{3,4})\b/g)){
    const n=Number(m[1]); if(!open.has(n))continue
    if(!hit.has(n))hit.set(n,new Set()); hit.get(n).add(f)
  }
}
console.log('fichiers scannés',cible.length)
console.log('tickets OUVERTS cités quelque part dans l\'arbre :',hit.size)
const zones=(pref)=>[...hit].filter(([, s])=>[...s].some(f=>f.startsWith(pref))).length
for(const p of ['src/','scripts/','docs/','docs/raw/','.claude/']) console.log('  cités sous',p,zones(p))
const rm=JSON.parse(fs.readFileSync(ROOT+'/src/data/raw.manifest.json','utf8'))
const txt=JSON.stringify(rm); const inRm=[...open].filter(n=>new RegExp('#'+n+'\b').test(txt))
console.log('tickets ouverts cités par src/data/raw.manifest.json :',inRm.length)
