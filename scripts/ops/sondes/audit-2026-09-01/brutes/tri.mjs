// SONDE (lecture seule) — tickets ouverts : cohortes de triage (vieux et muets, fusionnables en inventaire, `sev:majeur`, sans label ni référence).
// Usage : node scripts/ops/sondes/audit-2026-09-01/brutes/tri.mjs <dossier-de-données>
// Dossier de données (hors dépôt) — lus et/ou produits : open.json.
// Recettes de (re)fabrication des dumps : README.md du même dossier.

import fs from 'fs';
import { donnees } from '../_socle.mjs';
const DONNEES = donnees("Attendus : open.json.");

const S=DONNEES;
const iss=JSON.parse(fs.readFileSync(S+'/open.json','utf8'));
const now=new Date('2026-09-01T23:00:00Z');
const L=i=>(i.labels||[]).map(l=>l.name);
const upd=i=>(now-new Date(i.updatedAt))/86400000;
const B=i=>(i.title+' '+(i.body||''));
const A=iss.filter(i=>upd(i)>30 && (i.comments||[]).length===0 && L(i).some(x=>x==='sev:smell'||x==='sev:mineur'));
console.log('A) >30j, 0 comm, sev:smell|mineur :',A.length);
const A2=iss.filter(i=>upd(i)>30 && (i.comments||[]).length===0);
console.log('A2) >30j, 0 comm (toutes sev) :',A2.length);
const inv=iss.filter(i=>/(famille|stock|plafond|liste nominative|doc généré|doc genere)/i.test(B(i)));
console.log('B) fusionnables en INVENTAIRE (famille/stock/plafond/liste nominative) :',inv.length);
const edo=iss.filter(i=>L(i).includes('campagne:EDO'));console.log('   dont campagne:EDO :',edo.length);
const livre=iss.filter(i=>L(i).some(x=>x.startsWith('livre:')));console.log('   portant un label livre: :',livre.length);
const majeur=iss.filter(i=>L(i).includes('sev:majeur'));console.log('C) sev:majeur :',majeur.length);
const bug=iss.filter(i=>L(i).includes('bug'));console.log('   label bug :',bug.length);
// chevauchement A2 et inv
const setInv=new Set(inv.map(i=>i.number));
console.log('A2 ∩ B :',A2.filter(i=>setInv.has(i.number)).length);
// tickets sans aucune ref croisee et sans label
console.log('D) sans label ET sans #ref :',iss.filter(i=>L(i).length===0 && !/#\d{3,4}/.test(B(i))).length,
  iss.filter(i=>L(i).length===0 && !/#\d{3,4}/.test(B(i))).map(i=>'#'+i.number).slice(0,20).join(' '));
