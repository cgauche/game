// SONDE (lecture seule) — mémoire : inventaire (préfixes, fiches non liées, liens morts, dates git de création et de dernier touche, octets).
// Usage : node scripts/ops/sondes/audit-2026-09-01/p1-memoire.mjs <dossier-de-données>
// Dossier de données (hors dépôt) — lus et/ou produits : ages.json.
// Recettes de (re)fabrication des dumps : README.md du même dossier.

import fs from 'fs'; import path from 'path'; import {execSync} from 'child_process';
import { join } from 'node:path';
import { RACINE, donnees } from './_socle.mjs';
const DONNEES = donnees("Attendus : ages.json.");

const root=RACINE;
const dir=path.join(root,'.claude/memory');
const files=fs.readdirSync(dir).filter(f=>f.endsWith('.md')&&f!=='MEMORY.md');
const idx=fs.readFileSync(path.join(dir,'MEMORY.md'),'utf8');
const linked=new Set([...idx.matchAll(/\(([a-z0-9._-]+\.md)\)/g)].map(m=>m[1]));
// prefix classes
const cls={}; for(const f of files){const p=f.split('-')[0]; cls[p]=(cls[p]||0)+1;}
console.log('TOTAL fiches racine:',files.length);
console.log('PREFIXES:',JSON.stringify(cls));
const orphans=files.filter(f=>!linked.has(f));
console.log('LIENS dans MEMORY.md:',linked.size,'| fiches NON liees:',orphans.length);
console.log('ORPHELINES:'); orphans.forEach(f=>console.log('  ',f));
const dangling=[...linked].filter(f=>!fs.existsSync(path.join(dir,f)));
console.log('LIENS MORTS (cible absente):',dangling.length,dangling.join(','));
// ages via git log
const ages=[];
for(const f of files){
  let d='';
  try{d=execSync(`git log -1 --format=%ad --date=short -- ".claude/memory/${f}"`,{cwd:root}).toString().trim();}catch{}
  ages.push({f,d:d||'UNTRACKED'});
}
const bym={}; for(const a of ages){const m=a.d.slice(0,7); bym[m]=(bym[m]||0)+1;}
console.log('DERNIER TOUCHE par mois:',JSON.stringify(bym));
// creation date
const cre=[];
for(const f of files){let d='';try{d=execSync(`git log --diff-filter=A --format=%ad --date=short -- ".claude/memory/${f}"`,{cwd:root}).toString().trim().split('\n').pop();}catch{}cre.push({f,d:d||'UNTRACKED'});}
const bym2={}; for(const a of cre){const m=(a.d||'?').slice(0,7); bym2[m]=(bym2[m]||0)+1;}
console.log('CREATION par mois:',JSON.stringify(bym2));
fs.writeFileSync(join(DONNEES,'ages.json'),JSON.stringify({ages,cre},null,0));
// bytes
let tot=0; for(const f of files) tot+=fs.statSync(path.join(dir,f)).size;
console.log('OCTETS fiches racine:',tot,'| MEMORY.md:',fs.statSync(path.join(dir,'MEMORY.md')).size);
const arch=fs.existsSync(path.join(dir,'_archive'))?fs.readdirSync(path.join(dir,'_archive')):[];
let ta=0; for(const f of arch){const p=path.join(dir,'_archive',f); if(fs.statSync(p).isFile()) ta+=fs.statSync(p).size;}
console.log('_archive:',arch.length,'fichiers,',ta,'octets');
