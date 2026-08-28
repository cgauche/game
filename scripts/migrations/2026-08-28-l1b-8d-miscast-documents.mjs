/**
 * Migration #1467 L1b V-FLIP-TABLE — `miscast.json` devient un DATASET-LISTE de 5 documents de
 * famille `table`.
 *
 * AVANT : une racine-objet portant une méta `tables[]` (5 déclarations `{id, rows, label,
 * codexCategory?, source}`) et 5 conteneurs FRÈRES de rangées (`minor`, `major`, `minorVdm`,
 * `majorVdm`, `wrath`) — l'identité d'une table et sa charge vivaient à deux endroits, reliées par
 * le pointeur `rows`.
 * APRÈS : 5 documents `{id, type:'miscast', label, source, codexCategory?, entries}`. Le pointeur
 * `rows` MEURT (l'identité et la charge sont le même objet), les ids sont ceux DÉJÀ authorés dans
 * `tables[]`, et les rangées ne bougent pas d'un octet.
 *
 * Les deux paires de `label` HOMONYMES (LDB ⇄ VDM, Mineures et Majeures) sont VOULUES : le jeu de
 * tables en vigueur est une RÈGLE (règle optionnelle `magic-vdm-incantation`), pas une information
 * d'écran — `src/engine/miscast.ts`.
 *
 * ENTRÉES : `src/data/miscast.json` (la seule donnée lue et écrite).
 *
 * IDEMPOTENT : une racine déjà en TABLEAU de documents `type:'miscast'` est reconnue migrée (exit 0).
 * FAIL-FAST : conteneur déclaré par `tables[].rows` absent, conteneur FRÈRE non déclaré, clé de
 * racine inattendue → rien n'est écrit, exit 1.
 * FORMATAGE PRÉSERVÉ : `JSON.stringify(doc, null, 2)` vérifié AVANT toute écriture.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const CIBLE = path.join(ROOT, 'src/data/miscast.json');

const brut = fs.readFileSync(CIBLE, 'utf8');
const data = JSON.parse(brut);

if (JSON.stringify(data, null, 2) !== brut) {
  console.error('miscast.json : FORME NON CANONIQUE (pas `JSON.stringify(doc, null, 2)`)');
  process.exit(1);
}

if (Array.isArray(data)) {
  const mauvais = data.filter((d) => !d || d.type !== 'miscast' || !Array.isArray(d.entries));
  if (mauvais.length) {
    console.error(`miscast.json : racine en tableau, mais ${mauvais.length} entrée(s) hors forme \`{type:'miscast', entries:[…]}\``);
    process.exit(1);
  }
  console.log(`no-op miscast.json — déjà ${data.length} document(s) de famille table`);
  process.exit(0);
}

if (data === null || typeof data !== 'object' || !Array.isArray(data.tables)) {
  console.error('miscast.json : racine de forme inattendue (objet à `tables[]` attendu)');
  process.exit(1);
}

const echecs = [];
const declares = data.tables.map((t) => t.rows);
const freres = Object.keys(data).filter((k) => k !== 'tables');
for (const k of freres) if (!declares.includes(k)) echecs.push(`conteneur frère \`${k}\` non déclaré par \`tables[].rows\``);
for (const r of declares) if (!Array.isArray(data[r])) echecs.push(`\`tables[].rows\` = « ${r} » sans conteneur tableau correspondant`);
if (new Set(data.tables.map((t) => t.id)).size !== data.tables.length) echecs.push('ids en COLLISION dans `tables[]`');

if (echecs.length) {
  console.error(`ARBITRAGE REQUIS — ${echecs.length} anomalie(s) :`);
  for (const m of echecs) console.error(`  ${m}`);
  process.exit(1);
}

const sortie = data.tables.map((t) => ({
  id: t.id,
  type: 'miscast',
  label: t.label,
  source: t.source,
  ...(t.codexCategory === undefined ? {} : { codexCategory: t.codexCategory }),
  entries: data[t.rows],
}));

const out = JSON.stringify(sortie, null, 2);
fs.writeFileSync(CIBLE, out, 'utf8');

// PREUVE post-écriture : 5 documents, rangées identiques à l'octet, aucun conteneur perdu.
const apres = JSON.parse(out);
if (apres.length !== data.tables.length) echecs.push(`POST — ${apres.length} document(s) ≠ ${data.tables.length} déclaration(s)`);
for (const [i, t] of data.tables.entries()) {
  if (JSON.stringify(apres[i].entries) !== JSON.stringify(data[t.rows])) echecs.push(`POST — les rangées de « ${t.id} » ont été ALTÉRÉES`);
  if (apres[i].id !== t.id || apres[i].label !== t.label) echecs.push(`POST — identité de « ${t.id} » non conforme`);
  if (JSON.stringify(apres[i].source) !== JSON.stringify(t.source)) echecs.push(`POST — source de « ${t.id} » altérée`);
  if ('rows' in apres[i]) echecs.push(`POST — pointeur \`rows\` survivant sur « ${t.id} »`);
}
if (echecs.length) {
  console.error(`POST-ÉCRITURE ROUGE — ${echecs.length} anomalie(s) :`);
  for (const m of echecs) console.error(`  ${m}`);
  process.exit(1);
}

console.log(`miscast.json — ${sortie.length} document(s) de famille table :`);
for (const d of sortie) console.log(`  ${d.id} — ${d.entries.length} rangée(s) — ${d.label}`);
