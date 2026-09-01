// SONDE (lecture seule) — tickets créés depuis le 30/08 : rattachement (vague nommée / enfant / commit) et rattachement NUL.
// Usage : node scripts/ops/sondes/audit-2026-09-01/brutes/a12.mjs <dossier-de-données>
// Dossier de données (hors dépôt) — lus et/ou produits : created.json, iss_<N>.json.
// Recettes de (re)fabrication des dumps : README.md du même dossier.

import fs from 'fs';
import { execFileSync } from 'child_process';
import { join } from 'node:path';
import { RACINE, donnees } from '../_socle.mjs';
const DONNEES = donnees("Attendus : created.json, iss_<N>.json.");

const dir = DONNEES;
const c = JSON.parse(fs.readFileSync(join(DONNEES,'created.json')));
const since30 = c.filter(i => i.createdAt >= '2026-08-30T00:00:00Z').sort((a,b)=>a.number-b.number);
const S = new Set(since30.map(i=>i.number));
// enfants déclarés
const child = new Set();
for (const f of fs.readdirSync(dir).filter(f=>/^iss_\d+\.json$/.test(f))) {
  const i = JSON.parse(fs.readFileSync(join(DONNEES,f)));
  const t=(i.comments||[]).map(x=>x.body).join('\n');
  for (const m of t.matchAll(/#(\d{3,4})/g)) if (S.has(+m[1])) child.add(+m[1]);
}
const log = execFileSync('git',['log','--since=2026-08-29','--format=%B%x00'],{cwd:RACINE,encoding:'utf8',maxBuffer:1e8});
const commitCited = new Set(); for (const m of log.matchAll(/#(\d{3,4})/g)) if (S.has(+m[1])) commitCited.add(+m[1]);
const vagueNommee = /(?:vague|lot)\s+[«"'`]?[A-ZL0-9][^\s,.;]{0,20}|famille\s+#\d+|#1463|#1553|#1457|#1343|#1388|chantier\s+\S+/i;
let vn=0; const orphelins=[];
for (const i of since30) {
  const body = (i.title||'')+' '+(i.body||'');
  const hasVague = vagueNommee.test(body);
  if (hasVague) vn++;
  if (!hasVague && !child.has(i.number) && !commitCited.has(i.number)) orphelins.push(i.number);
}
console.log('N depuis 08-30 =', since30.length);
console.log('portent une VAGUE NOMMÉE dans titre/corps :', vn, `(${(100*vn/since30.length).toFixed(0)}%)`);
console.log('enfants déclarés d\'une fermeture :', [...child].filter(n=>S.has(n)).length);
console.log('cités par un COMMIT :', commitCited.size);
console.log('rattachement NUL (ni vague nommée, ni enfant, ni commit) :', orphelins.length, orphelins.join(','));
// salve #1662-#1676
const salve = c.filter(i=>i.number>=1662&&i.number<=1676).sort((a,b)=>a.createdAt<b.createdAt?-1:1);
console.log('--- salve 1662-1676 ---', salve.length);
for (const i of salve) console.log(i.number, i.createdAt);
