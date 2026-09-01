// SONDE (lecture seule) — reproduction des tickets : arbre de descendance de #1463, enfants par ticket fermé, taux de reproduction ≥ #1400.
// Usage : node scripts/ops/sondes/audit-2026-09-01/fanout.mjs <dossier-de-données>
// Dossier de données (hors dépôt) — lus et/ou produits : issues-all.json.
// Recettes de (re)fabrication des dumps : README.md du même dossier.

import fs from 'node:fs';
import { donnees } from './_socle.mjs';
const DONNEES = donnees("Attendus : issues-all.json.");

const S = DONNEES;
const all = JSON.parse(fs.readFileSync(S + '/issues-all.json', 'utf8'));
const byNum = new Map(all.map(i => [i.number, i]));
const cites = i => new Set([...((i.body || '') + ' ' + i.title).matchAll(/#(\d{2,4})\b/g)].map(m => +m[1]).filter(n => n < i.number && byNum.has(n)));
const children = new Map();
for (const b of all) for (const a of cites(b)) { if (!children.has(a)) children.set(a, []); children.get(a).push(b.number); }
const kids = n => children.get(n) || [];
// arbre de #1463
let gen = [1463]; const seen = new Set([1463]); const gens = [];
for (let g = 1; g <= 6; g++) { const next = []; for (const a of gen) for (const c of kids(a)) if (!seen.has(c)) { seen.add(c); next.push(c); } if (!next.length) break; gens.push(next); gen = next; }
const desc = [...seen].filter(n => n !== 1463);
const open = desc.filter(n => byNum.get(n).state === 'OPEN').length;
console.log(`ARBRE #1463 : ${desc.length} descendants (${open} ouverts) sur ${gens.length} générations : ` + gens.map((g, i) => `G${i + 1}=${g.length}`).join(' · '));
console.log('  G1 exemples : ' + gens[0].slice(0, 8).map(n => '#' + n).join(' ') + ' …');
if (gens[1]) console.log('  G2 exemples : ' + gens[1].slice(0, 8).map(n => '#' + n).join(' ') + ' …');
if (gens[2]) console.log('  G3 exemples : ' + gens[2].slice(0, 8).map(n => '#' + n).join(' ') + ' …');
// fan-out des tickets FERMÉS depuis le 20/08 : enfants créés APRÈS leur création
const closed = all.filter(i => i.state === 'CLOSED' && i.closedAt >= '2026-08-20');
const fan = closed.map(i => ({ n: i.number, k: kids(i.number).length })).sort((a, b) => b.k - a.k);
const ks = fan.map(f => f.k).sort((a, b) => a - b);
const mean = ks.reduce((a, b) => a + b, 0) / ks.length, med = ks[Math.floor(ks.length / 2)];
console.log(`\nFERMÉS depuis le 20/08 : ${closed.length} tickets · enfants moyens ${mean.toFixed(2)} · médiane ${med} · max ${ks.at(-1)} · >1 enfant : ${ks.filter(k => k > 1).length} (${(100 * ks.filter(k => k > 1).length / ks.length).toFixed(0)} %) · 0 enfant : ${ks.filter(k => k === 0).length}`);
console.log('  top : ' + fan.slice(0, 8).map(f => `#${f.n}→${f.k}`).join(' '));
// tickets créés depuis le 25/08 : part qui cite un ticket antérieur (né d'un ticket)
const recent = all.filter(i => i.createdAt >= '2026-08-25');
const born = recent.filter(i => cites(i).size > 0).length;
console.log(`\nCRÉÉS depuis le 25/08 : ${recent.length} · citent un ticket antérieur : ${born} (${(100 * born / recent.length).toFixed(0)} %)`);
// taux de reproduction global : enfants par ticket, tous tickets depuis #1400
const pop = all.filter(i => i.number >= 1400);
const R = pop.reduce((a, i) => a + kids(i.number).length, 0) / pop.length;
console.log(`REPRODUCTION (tickets ≥ #1400, ${pop.length}) : ${R.toFixed(2)} enfant par ticket en moyenne, ${pop.filter(i => kids(i.number).length > 0).length} en ont au moins un`);
