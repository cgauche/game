// SONDE (lecture seule) — tickets ouverts : taxonomie par marqueurs de rédaction (sha, DoD, fichier:ligne, verbatim…) et couverture des familles de labels.
// Usage : node scripts/ops/sondes/audit-2026-09-01/brutes/tax.mjs <dossier-de-données>
// Dossier de données (hors dépôt) — lus et/ou produits : open.json.
// Recettes de (re)fabrication des dumps : README.md du même dossier.

import fs from 'fs';
import { donnees } from '../_socle.mjs';
const DONNEES = donnees("Attendus : open.json.");

const S=DONNEES;
const iss=JSON.parse(fs.readFileSync(S+'/open.json','utf8'));
const B=i=>((i.body||'')+' '+i.title);
const n=iss.length;
const pct=x=>x+' ('+(100*x/n).toFixed(1)+'%)';
const has=(rx)=>iss.filter(i=>rx.test(B(i))).length;
console.log('N',n);
console.log('cite un sha (7-12 hex isolé)', pct(has(/\b[0-9a-f]{7,12}\b/)));
console.log('mot "juge"', pct(has(/\bjuge\b/i)));
console.log('mot "lot "/"vague"', pct(has(/\b(lot|vague)\b/i)));
console.log('mot "audit"', pct(has(/audit/i)));
console.log('"verbatim"', pct(has(/verbatim/i)));
console.log('"arbitrage utilisateur"/"user"', pct(has(/arbitrage (utilisateur|user)/i)));
console.log('cite fichier:ligne src/…', pct(has(/(src|scripts)\/[\w/.-]+\.(ts|tsx|mjs|mts|json):\d+/)));
console.log('a un DoD', pct(has(/\bDoD\b/)));
console.log('a une case a cocher', pct(has(/- \[ \]/)));
console.log('mentionne "recette"', pct(has(/recette/i)));
console.log('mentionne "garde"/"cliquet"/"test"', pct(has(/\b(garde|cliquet)\b/i)));
console.log('"joueur"', pct(has(/\bjoueur/i)));
console.log('cite un autre ticket #N', pct(has(/#\d{3,4}/)));
// origine agent vs user : ni verbatim user ni "utilisateur"
const userless = iss.filter(i=>!/utilisateur|user\b|verbatim/i.test(B(i)));
console.log('AUCUNE mention utilisateur/verbatim', pct(userless.length));
// mixtes typiques
const guard = iss.filter(i=>/(scripts\/guards|cliquet|garde |détecteur|detecteur|\.test\.ts)/i.test(B(i)));
console.log('mentionne outillage-garde/test', pct(guard.length));
// labels combos : sev
const sev=new Map();for(const i of iss){const s=(i.labels||[]).filter(l=>l.name.startsWith('sev:')).map(l=>l.name).sort().join('+')||'(aucun sev)';sev.set(s,(sev.get(s)||0)+1);}
console.log('SEV',JSON.stringify([...sev.entries()].sort((a,b)=>b[1]-a[1])));
const typ=new Map();for(const i of iss){const s=(i.labels||[]).filter(l=>l.name.startsWith('type:')).map(l=>l.name).sort().join('+')||'(aucun type)';typ.set(s,(typ.get(s)||0)+1);}
console.log('TYPE',JSON.stringify([...typ.entries()].sort((a,b)=>b[1]-a[1])));
console.log('TOUS_LABELS', JSON.stringify([...new Set(iss.flatMap(i=>(i.labels||[]).map(l=>l.name)))].sort()));
// combien portent >=1 label de chaque famille (sev+type+domaine)
const fam=i=>{const L=(i.labels||[]).map(l=>l.name);return ['sev:','type:','domaine:'].filter(p=>L.some(x=>x.startsWith(p))).length;};
const f={0:0,1:0,2:0,3:0};for(const i of iss)f[fam(i)]++;
console.log('FAMILLES_COUVERTES',JSON.stringify(f));
// assignés ?
