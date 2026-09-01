// SONDE (lecture seule) — tickets ouverts : mentions doc générée/stock/plafond, labels particuliers, part outillage vs surface joueur.
// Usage : node scripts/ops/sondes/audit-2026-09-01/brutes/misc.mjs <dossier-de-données>
// Dossier de données (hors dépôt) — lus et/ou produits : open.json.
// Recettes de (re)fabrication des dumps : README.md du même dossier.

import fs from 'fs';
import { donnees } from '../_socle.mjs';
const DONNEES = donnees("Attendus : open.json.");

const S=DONNEES;
const iss=JSON.parse(fs.readFileSync(S+'/open.json','utf8'));
const B=i=>(i.title+' '+(i.body||''));
const c=(nom,rx)=>{const s=iss.filter(i=>rx.test(B(i)));console.log(nom,s.length,'ex:',s.slice(0,4).map(i=>'#'+i.number).join(' '));return s;};
c('adossés à un DOC GÉNÉRÉ / stock / plafond', /(doc généré|doc genere|stock |plafond décroissant|plafond decroissant|cliquet)/i);
c('label gelée', /^$/);
console.log('label gelée n=', iss.filter(i=>(i.labels||[]).some(l=>l.name==='gelée')).map(i=>'#'+i.number).join(' '));
console.log('label policy-à-trancher n=', iss.filter(i=>(i.labels||[]).some(l=>l.name==='policy-à-trancher')).map(i=>'#'+i.number).join(' '));
console.log('label documentation n=', iss.filter(i=>(i.labels||[]).some(l=>l.name==='documentation')).length);
console.log('label bug n=', iss.filter(i=>(i.labels||[]).some(l=>l.name==='bug')).length, ' enhancement n=', iss.filter(i=>(i.labels||[]).some(l=>l.name==='enhancement')).length);
// tickets purement outillage (garde/CI/script) vs produit
const outil=iss.filter(i=>/(scripts\/guards|\.test\.ts|cliquet|CI |garde |détecteur|generateur|générateur|docs\/)/i.test(B(i)));
console.log('OUTILLAGE/DOC/GARDE mentionné', outil.length, (100*outil.length/iss.length).toFixed(1)+'%');
const joueurVisible=iss.filter(i=>/(à l'écran|a l ecran|le joueur (voit|ne voit)|recette|affich)/i.test(B(i)));
console.log('surface JOUEUR mentionnée', joueurVisible.length, (100*joueurVisible.length/iss.length).toFixed(1)+'%');
// EDO family
console.log('campagne:EDO n=', iss.filter(i=>(i.labels||[]).some(l=>l.name==='campagne:EDO')).length);
console.log('titres commencant par [campagne:EDO]', iss.filter(i=>/^\[campagne:EDO\]/.test(i.title)).length);
