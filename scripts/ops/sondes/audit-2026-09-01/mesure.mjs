// SONDE (lecture seule) — coût d'un export intégral de l'index git (`git checkout-index -a`) : durée, fichiers, octets.
// Usage : node scripts/ops/sondes/audit-2026-09-01/mesure.mjs <dossier-de-données>
// Dossier de données (hors dépôt) — lus et/ou produits : (voir le corps).
// Recettes de (re)fabrication des dumps : README.md du même dossier.

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import { RACINE, donnees } from './_socle.mjs';
const DONNEES = donnees("Attendus : voir le corps de la sonde.");

const SP=DONNEES + '/';
const REPO=RACINE;
function run(label,cmd,args,opts={}){const t=Date.now();const r=spawnSync(cmd,args,{cwd:REPO,encoding:'utf8',...opts});console.log(`[${label}] exit=${r.status} ms=${Date.now()-t}`);if(r.stderr)console.log('  err:',r.stderr.slice(0,400).replace(/\n/g,' | '));if(r.stdout)console.log('  out:',r.stdout.slice(0,400).replace(/\n/g,' | '));return r;}
// 1. checkout-index total
fs.rmSync(SP+'idx1',{recursive:true,force:true});
run('checkout-index -a','git',['checkout-index','-a','-f','--prefix='+SP+'idx1/']);
let n=0,b=0;const walk=(d)=>{for(const e of fs.readdirSync(d,{withFileTypes:true})){const p=d+'/'+e.name;if(e.isDirectory())walk(p);else{n++;b+=fs.statSync(p).size;}}};
try{walk(SP+'idx1');}catch{}
console.log('fichiers exportés:',n,'octets:',b);
