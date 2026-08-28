/**
 * Migration #1467 L1b V-P0d — les 8 entrées de `raw.manifest.json` reçoivent leur `label`.
 *
 * MOTIF : l'enveloppe exige `label` non vide. Le libellé d'un topic de manifeste existe DÉJÀ : c'est
 * le TITRE de la section d'Atlas qu'il adresse. La migration le DÉRIVE par `headingForTopic`
 * (`scripts/raw/build-implemente.mjs`) — la propre dérivation de topic du générateur, donc le même
 * `slugify` et la même disambiguation `-N` : aucune table en dur, aucun second slugify parallèle.
 *
 * Entrées : `src/data/raw.manifest.json` (lu et écrit) ; `docs/raw/*.md` (lus seuls).
 *
 * POSITION : `label` s'insère juste après `id`, en 2ᵉ clé.
 * IDEMPOTENT / NO-OP : rejouée, elle re-résout les mêmes titres, n'écrit rien, sort 0.
 * FAIL-FAST : topic introuvable ou ambigu dans sa fiche, entrée sans `id`, `label` déjà posé et
 * DIVERGENT du titre résolu → rien n'est écrit, sortie 1.
 * FORMATAGE PRÉSERVÉ : le fichier est EXACTEMENT `JSON.stringify(doc, null, 2)`, vérifié AVANT écriture.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { headingForTopic } from '../raw/build-implemente.mjs';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const CIBLE = path.join(ROOT, 'src/data/raw.manifest.json');
const RAWDIR = path.join(ROOT, 'docs/raw');

const brut = fs.readFileSync(CIBLE, 'utf8');
const data = JSON.parse(brut);

if (JSON.stringify(data, null, 2) !== brut) {
  console.error('raw.manifest.json : FORME NON CANONIQUE (pas `JSON.stringify(doc, null, 2)`)');
  process.exit(1);
}
if (!Array.isArray(data)) {
  console.error('raw.manifest.json : racine de forme inattendue (tableau attendu)');
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
    label = headingForTopic(entree.id, RAWDIR);
  } catch (e) {
    erreurs.push(e.message);
    continue;
  }
  if (entree.label !== undefined && entree.label !== label) {
    erreurs.push(`${entree.id} : \`label\` = ${JSON.stringify(entree.label)} ≠ ${JSON.stringify(label)} (titre d'Atlas) — arbitrage requis`);
    continue;
  }
  const { id, label: _mort, ...reste } = entree;
  sortie.push({ id, label, ...reste });
}

if (erreurs.length) {
  console.error(`raw.manifest.json : ${erreurs.length} anomalie(s) — RIEN n'est écrit :`);
  for (const m of erreurs) console.error(`  ${m}`);
  process.exit(1);
}

const out = JSON.stringify(sortie, null, 2);
if (out !== brut) fs.writeFileSync(CIBLE, out, 'utf8');

// PREUVE post-écriture : autant d'entrées, `label` non vide en 2ᵉ clé, ACCORDÉ au titre d'Atlas.
const apres = JSON.parse(fs.readFileSync(CIBLE, 'utf8'));
const echecs = [];
if (apres.length !== data.length) echecs.push(`POST — ${apres.length} entrée(s) ≠ ${data.length}`);
for (const e of apres) {
  if (typeof e.label !== 'string' || e.label === '') echecs.push(`POST — ${e.id} : label vide/absent`);
  else if (e.label !== headingForTopic(e.id, RAWDIR)) echecs.push(`POST — ${e.id} : label DÉSACCORDÉ du titre d'Atlas`);
  if (Object.keys(e).slice(0, 2).join(',') !== 'id,label') echecs.push(`POST — ${e.id} : clés de tête ${Object.keys(e).slice(0, 2).join(',')} ≠ id,label`);
}

if (echecs.length) {
  console.error(`ÉCHEC POST-ÉCRITURE — ${echecs.length} anomalie(s) :`);
  for (const m of echecs) console.error(`  ${m}`);
  process.exit(1);
}

console.log(`${out === brut ? 'no-op' : 'migré'} raw.manifest.json — ${apres.length} label(s) dérivé(s) des titres de l'Atlas`);
