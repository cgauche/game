// SONDE (lecture seule) — mémoire : frontmatter présent, références de chemins et chemins MORTS cités par les fiches.
// Usage : node scripts/ops/sondes/audit-2026-09-01/p3-memoire.mjs <dossier-de-données>
// Dossier de données (hors dépôt) — lus et/ou produits : dead.json.
// Recettes de (re)fabrication des dumps : README.md du même dossier.

import fs from 'fs';
import { RACINE, donnees } from './_socle.mjs';
const DONNEES = donnees("Attendus : dead.json.");

const dir=RACINE + '/.claude/memory';
const root=RACINE + '/';
const files=fs.readdirSync(dir).filter(f=>f.endsWith('.md')&&f!=='MEMORY.md');
let fm=0; const noFm=[];
const re=/(?:^|[\s`(['"|])((?:src|scripts|server|docs|\.claude)\/[A-Za-z0-9_./@-]*[A-Za-z0-9_])/g;
const missing=new Map(); const seen=new Set(); let totalRefs=0; const fichesWithDead=new Set();
for(const f of files){
  const t=fs.readFileSync(dir+'/'+f,'utf8');
  if(t.startsWith('---')) fm++; else noFm.push(f);
  for(const m of t.matchAll(re)){
    const p=m[1].replace(/[.,;:)]+$/,'');
    if(p.endsWith('/')) continue;
    // strip trailing symbol-ish? keep as-is
    totalRefs++;
    seen.add(p);
    if(!fs.existsSync(root+p)){
      if(!missing.has(p)) missing.set(p,[]);
      missing.get(p).push(f); fichesWithDead.add(f);
    }
  }
}
console.log('fiches avec frontmatter YAML (---):',fm,'/',files.length);
console.log('refs chemin brutes:',totalRefs,'| chemins distincts:',seen.size);
console.log('chemins distincts MORTS:',missing.size,'| fiches en citant >=1:',fichesWithDead.size);
const arr=[...missing.entries()].sort((a,b)=>b[1].length-a[1].length);
console.log('--- TOP 30 chemins morts (nb fiches) ---');
arr.slice(0,30).forEach(([p,fs2])=>console.log(fs2.length,p,'::',fs2.slice(0,2).join(',')));
fs.writeFileSync(DONNEES+'/dead.json',JSON.stringify(arr));
