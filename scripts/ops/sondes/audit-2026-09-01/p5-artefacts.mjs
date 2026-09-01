// SONDE (lecture seule) — mémoire : vingt vécus de l'audit cherchés dans le corpus — couverts ou ABSENTS, indexés ou non.
// Usage : node scripts/ops/sondes/audit-2026-09-01/p5-artefacts.mjs

import fs from 'fs';
import path from 'path';
import { RACINE } from './_socle.mjs';

const memdir=RACINE + '/.claude/memory';
const files=fs.readdirSync(memdir).filter(f=>f.endsWith('.md'));
const idx=fs.readFileSync(path.join(memdir,'MEMORY.md'),'utf8');
const linked=new Set([...idx.matchAll(/\(([a-z0-9\-_]+)\.md\)/g)].map(m=>m[1]));
const corpus=files.map(f=>({f:f.replace(/\.md$/,''),t:fs.readFileSync(path.join(memdir,f),'utf8')}));
const probes=[
 ['V1 todo de vague / restes recetteurs #1426-#1500',/(#1500|todo de vague|TODO-vague)/i],
 ['V2 file de vague dans le chat -> 3 derives 08-31',/file de vague|derives « annonc/i],
 ['V3 audit DoD avant vague (#733 bloque #734)',/#733|audit de DoD|DoD D.ABORD/i],
 ['V4 5 lectures Source = 5 resultats decisifs',/lectures? (directes? )?du Source|5 r.sultats d.cisifs/i],
 ['V5 « OFF = silence » etire (#939 seam monde)',/OFF = silence/i],
 ['V6 Rituel != SpellData / VDM 02 l.379',/Rituel n.est pas un|VDM 02 l\.379/i],
 ['V7 MDG 14 l.39 citation etiree (#1595)',/MDG 14 l\.39|citation.*R.POND/i],
 ['V8 affirmations d absence (78 resolutions, 13% JSDoc)',/78 r.solutions|13 % de couverture JSDoc|affirmation d.ABSENCE/i],
 ['V9 « c est de la folie » feuilles a la main #373',/c.est de la folie|#373/i],
 ['V10 recetteur -> recetteur infini (disallowedTools)',/disallowedTools|re-d.l.gue|recetteur . recetteur/i],
 ['V11 tail && git push, 245 rouges',/245 rouges|tail .* git push/i],
 ['V12 #341 attackEnv seul seam',/#341|attackEnv/i],
 ['V13 #665 34 enfants en 26 s',/#665|34 enfants/i],
 ['V14 #1457 C1 source.page 4 regressions',/#1457 C1|multi-folios/i],
 ['V15 worldTris uprightWidthM/montantWidthM',/uprightWidthM|montantWidthM|worldTris/i],
 ['V16 33% temps runner / sortie en fichier',/33 % du temps|sortie compl.te dans un fichier|rejou. 19/i],
 ['V17 « le pire orchestrator que je connaisse » 06-29',/pire orchestrator/i],
 ['V18 « modifications trop basiques » 07-29',/trop basiques/i],
 ['V19 n arrete jamais tant qu il a des tickets',/n.arrete jamais tant qu|arrête jamais tant qu/i],
 ['V20 lot de 10-12 tickets / ceremonie 5-6h',/10-12|c.r.monie de vague/i]];
for(const [name,rx] of probes){
 const hits=corpus.filter(c=>rx.test(c.t)).map(c=>c.f);
 const inIdx=hits.filter(h=>linked.has(h)||h==='MEMORY');
 console.log((hits.length?'':'ABSENT ')+name+' -> fiches='+hits.length+' [ '+hits.slice(0,4).join(', ')+' ] indexees='+inIdx.length);
}
