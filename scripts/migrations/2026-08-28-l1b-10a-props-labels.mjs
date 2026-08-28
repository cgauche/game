/**
 * Migration #1467 L1b V-P0d — les 78 entrées de `props.json` reçoivent leur `label`.
 *
 * MOTIF : l'enveloppe de document exige `label` non vide sans exception de famille. Un label ne
 * s'INVENTE pas : celui du décor existe DÉJÀ, dans la def d'ART du même id
 * (`src/gameIso/catalog/decor/defs/<id>.ts`, `export const prop: PropViz` — 78/78 couverts). La
 * migration LIT chaque def et en extrait le label par le foyer unique
 * `scripts/guards/lib/propArtLabels.mjs` (le MÊME qu'emploie la garde de parité
 * `src/data/props-label-parite.test.ts`) : aucune table en dur ici, le script EST la preuve de
 * dérivation.
 *
 * Entrées : `src/data/props.json` (lu et écrit) ; `src/gameIso/catalog/decor/defs/*.ts` (lus seuls).
 *
 * POSITION : `label` s'insère juste après `id`, en 2ᵉ clé de chaque entrée.
 * IDEMPOTENT / NO-OP : rejouée sur l'état final, elle recalcule les mêmes labels, n'écrit rien, sort 0.
 * FAIL-FAST : def d'art absente ou `label:` absent/ambigu, entrée sans `id`, label de donnée DIVERGENT
 * d'un label d'art déjà posé → rien n'est écrit, sortie 1.
 * FORMATAGE PRÉSERVÉ : le fichier est EXACTEMENT `JSON.stringify(doc, null, 2)`, vérifié AVANT écriture.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { labelDArt } from '../guards/lib/propArtLabels.mjs';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const CIBLE = path.join(ROOT, 'src/data/props.json');

const brut = fs.readFileSync(CIBLE, 'utf8');
const data = JSON.parse(brut);

if (JSON.stringify(data, null, 2) !== brut) {
  console.error('props.json : FORME NON CANONIQUE (pas `JSON.stringify(doc, null, 2)`)');
  process.exit(1);
}
if (!Array.isArray(data)) {
  console.error('props.json : racine de forme inattendue (tableau attendu)');
  process.exit(1);
}

const erreurs = [];
const sortie = [];
for (const [i, entree] of data.entries()) {
  if (!entree || typeof entree !== 'object' || typeof entree.id !== 'string' || entree.id === '') {
    erreurs.push(`entrée #${i} : \`id\` absent ou non-chaîne`);
    continue;
  }
  let label;
  try {
    label = labelDArt(ROOT, entree.id);
  } catch (e) {
    erreurs.push(e.message);
    continue;
  }
  if (entree.label !== undefined && entree.label !== label) {
    erreurs.push(`${entree.id} : \`label\` = ${JSON.stringify(entree.label)} ≠ ${JSON.stringify(label)} (def d'art) — arbitrage requis`);
    continue;
  }
  const { id, label: _mort, ...reste } = entree;
  sortie.push({ id, label, ...reste });
}

if (erreurs.length) {
  console.error(`props.json : ${erreurs.length} anomalie(s) — RIEN n'est écrit :`);
  for (const m of erreurs) console.error(`  ${m}`);
  process.exit(1);
}

const out = JSON.stringify(sortie, null, 2);
if (out !== brut) fs.writeFileSync(CIBLE, out, 'utf8');

// PREUVE post-écriture : autant d'entrées, `label` non vide partout, en 2ᵉ clé, et ACCORDÉ à l'art.
const apres = JSON.parse(fs.readFileSync(CIBLE, 'utf8'));
const echecs = [];
if (apres.length !== data.length) echecs.push(`POST — ${apres.length} entrée(s) ≠ ${data.length}`);
for (const e of apres) {
  if (typeof e.label !== 'string' || e.label === '') echecs.push(`POST — ${e.id} : label vide/absent`);
  else if (e.label !== labelDArt(ROOT, e.id)) echecs.push(`POST — ${e.id} : label DÉSACCORDÉ de la def d'art`);
  if (Object.keys(e).slice(0, 2).join(',') !== 'id,label') echecs.push(`POST — ${e.id} : clés de tête ${Object.keys(e).slice(0, 2).join(',')} ≠ id,label`);
}

if (echecs.length) {
  console.error(`ÉCHEC POST-ÉCRITURE — ${echecs.length} anomalie(s) :`);
  for (const m of echecs) console.error(`  ${m}`);
  process.exit(1);
}

console.log(`${out === brut ? 'no-op' : 'migré'} props.json — ${apres.length} label(s) dérivé(s) des defs d'art`);
