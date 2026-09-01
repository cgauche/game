// SONDE (lecture seule) — mémoire : approximation de la règle « verbatim ou sonde ET porte exécutable » sur chaque fiche.
// Usage : node scripts/ops/sondes/audit-2026-09-01/p4-artefacts.mjs

import fs from 'fs';
import path from 'path';
import { RACINE } from './_socle.mjs';

const memdir=RACINE + '/.claude/memory';
const files=fs.readdirSync(memdir).filter(f=>f.endsWith('.md')&&f!=='MEMORY.md');
const rx={verb:/[«"][^»"]{15,}[»"]/,date:/20\d\d-\d\d-\d\d/,user:/(user|utilisateur|verbatim)/i,
 sonde:/(npm run|npx |node scripts|git log|git show|mesur[ée]|sonde)/i,
 porte:/(\.test\.ts|\.test\.tsx|scripts\/guards|pre-commit|hook|#\d{2,4}|garde )/i};
let pass=0,fail=0;const failed=[];
for(const f of files){const t=fs.readFileSync(path.join(memdir,f),'utf8');
 const a=(rx.verb.test(t)&&rx.date.test(t)&&rx.user.test(t))||rx.sonde.test(t);
 const b=rx.porte.test(t);
 if(a&&b)pass++;else{fail++;failed.push(f.replace(/\.md$/,'')+(a?' [sans porte]':b?' [sans verbatim/sonde]':' [ni l un ni l autre]'));}}
console.log('fiches',files.length,'PASSENT la regle (b) approx:',pass,'REFUSEES:',fail);
const cites=['game-arbitrage-hud-console-rt-2026-08-16','game-socle-possessions-programme','env-use-powershell-not-bash','feedback-preuve-mesuree-sur-le-chemin-reel','feedback-verifier-les-claims-architecturaux-des-agents','game-doc-derivee-jamais-ecrite-a-la-main','git-commits-propres-wip-parallele','index-systemes-livres','game-swarm-data-driven-grounding','game-campagne-edo-programme','feedback-jamais-de-constat-silencieux','feedback-bug-existant-trouve-se-traite-pas-juste-ticketise','feedback-epic-ne-se-ferme-jamais-sur-tickets-ouverts','feedback-une-seule-session-orchestratrice','feedback-avancer-en-autonomie-jamais-serialiser'];
console.log('--- verdict sur fiches citees/arbitrages ---');
for(const c of cites){const p=path.join(memdir,c+'.md');if(!fs.existsSync(p)){console.log(c+' ABSENTE');continue;}
 const t=fs.readFileSync(p,'utf8');
 const a1=rx.verb.test(t)&&rx.date.test(t)&&rx.user.test(t),a2=rx.sonde.test(t),b=rx.porte.test(t);
 console.log((((a1||a2)&&b)?'PASSE ':'REFUSEE ')+c+'  verbatim='+a1+' sonde='+a2+' porte='+b+' ('+t.length+'o)');}
console.log('--- echantillon des refusees ---');
console.log(failed.slice(0,25).join('\n'));
