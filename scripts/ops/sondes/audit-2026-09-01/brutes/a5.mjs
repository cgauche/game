// SONDE (lecture seule) — tickets créés depuis le 30/08 : motifs de rattachement (reste, famille, vague, lot, #1463).
// Usage : node scripts/ops/sondes/audit-2026-09-01/brutes/a5.mjs <dossier-de-données>
// Dossier de données (hors dépôt) — lus et/ou produits : created.json.
// Recettes de (re)fabrication des dumps : README.md du même dossier.

import fs from 'fs';
import { join } from 'node:path';
import { donnees } from '../_socle.mjs';
const DONNEES = donnees("Attendus : created.json.");

const c = JSON.parse(fs.readFileSync(join(DONNEES,'created.json')));
const since30 = c.filter(i => i.createdAt >= '2026-08-30T00:00:00Z').sort((a,b)=>a.number-b.number);
const pats = {
  reste: /\breste[s]?\b|\bsorti de\b|\bhors p[ée]rim[èe]tre\b/i,
  famille: /famille #\d+|\bfamille\b/i,
  vagueMot: /\bvague\b/i,
  lot: /\blot [A-Z]?\d?[a-z]?\b|\bL[0-9][a-c]?\b/,
  epic1463: /#1463/,
  emisPar: /[ée]mis par|ouvert par|sorti (?:de|du) (?:la )?(?:vague|lot|fermeture)|d[ée]tect[ée] (?:par|pendant)/i,
};
function has(i, re) { return re.test(i.title) || re.test(i.body || ''); }
const stat = {};
for (const k in pats) stat[k] = since30.filter(i => has(i, pats[k])).length;
console.log('created>=08-30 N=', since30.length, JSON.stringify(stat));
// rattachement NOMMÉ = cite un ticket-parent ou une vague/lot nommée
const nomme = since30.filter(i => /#\d{3,4}/.test((i.body||'')) );
console.log('citent au moins un #N dans le corps:', nomme.length);
const vagueNommee = since30.filter(i => /(vague|lot|famille|epic|épic|chantier)\s*[«"']?\s*[#A-Za-z0-9-]/i.test(i.body||''));
console.log('citent vague/lot/famille/epic/chantier:', vagueNommee.length);
const parent = since30.filter(i => /(famille|vague|lot|epic|épic|#1463|#1553|#1457|#1343)\s*#?\d/i.test((i.title||'')+' '+(i.body||'')));
console.log('rattachement à un parent numéroté:', parent.length);
console.log('sans aucun #N:', since30.filter(i=>!/#\d{3,4}/.test(i.body||'')).map(i=>i.number).join(','));
