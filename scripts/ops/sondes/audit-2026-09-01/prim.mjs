// SONDE (lecture seule) — table « Primitives partagées » de CLAUDE.md ⇄ `src/data/primitives.manifest.json` : fichiers cités, fichiers absents du manifeste.
// Usage : node scripts/ops/sondes/audit-2026-09-01/prim.mjs

import { readFileSync } from 'node:fs'
import { RACINE } from './_socle.mjs';

const R=RACINE + '/'
const md=readFileSync(R+'CLAUDE.md','utf8').split('\n')
const a=md.findIndex(l=>l.startsWith('## Primitives partagées'))
const b=md.findIndex((l,i)=>i>a&&l.startsWith('## Workflows'))
const files=new Set()
for(const l of md.slice(a,b)) for(const m of l.matchAll(/`(src\/[\w/.-]+\.tsx?)`/g)) files.add(m[1])
const man=JSON.parse(readFileSync(R+'src/data/primitives.manifest.json','utf8'))
const arr=Array.isArray(man)?man:(man.primitives??Object.values(man)[0])
const manFiles=new Set()
JSON.stringify(arr).replace(/src\/[\w/.-]+\.tsx?/g,m=>manFiles.add(m))
console.log('fichiers cités table CLAUDE.md:',files.size)
console.log('fichiers dans manifest:',manFiles.size)
const abs=[...files].filter(f=>!manFiles.has(f))
console.log('cités par la table MAIS absents du manifest:',abs.length)
console.log(abs.slice(0,40).join('\n'))
