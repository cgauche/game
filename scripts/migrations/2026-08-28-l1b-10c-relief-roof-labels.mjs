/**
 * Migration #1467 L1b V-P0d — les `reliefMaterials.json` et les `roofMaterials.json` reçoivent leur
 * `label`.
 *
 * MOTIF : l'enveloppe exige `label` non vide. Contrairement à 10a/10b, ces libellés ne sont
 * DÉRIVABLES d'aucune source mesurée — ils sont ARBITRÉS (#1467 V-P0d). La table ci-dessous EST donc
 * l'arbitrage lui-même, pas la recopie d'une vérité qui vivrait ailleurs. Deux conséquences portées
 * par le lot : les matériaux de couverture prennent le SINGULIER (`Tuile`, et non le `Tuiles` que le
 * doublon codé en dur `ROOF_MATERIALS` affichait).
 *
 * TABLE RECALÉE #1686 lot 1, dans le train qui la fait bouger (même doctrine que le cardinal de
 * `…-11a-entite-type.mjs`) : `ardoise` → `toit-ardoise` (id composé de l'homonyme, le libellé ne bouge
 * pas), et les deux reliefs MORTS purgés du dataset quittent la table — un label arbitré sans entrée
 * fait sortir 1.
 *
 * Entrées : `src/data/reliefMaterials.json` et `src/data/roofMaterials.json` (lus et écrits).
 *
 * POSITION : `label` s'insère juste après `id`, en 2ᵉ clé.
 * IDEMPOTENT / NO-OP : rejouée, elle repose les mêmes labels, n'écrit rien, sort 0.
 * FAIL-FAST : id absent de la table (ou table portant un id absent du fichier), entrée sans `id`,
 * `label` déjà posé et DIVERGENT → rien n'est écrit, sortie 1.
 * FORMATAGE PRÉSERVÉ : chaque fichier est EXACTEMENT `JSON.stringify(doc, null, 2)`, vérifié AVANT écriture.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));

const LOTS = [
  {
    fichier: 'src/data/reliefMaterials.json',
    labels: {
      terre: 'Terre',
      pierre: 'Pierre',
      pilier: 'Pilier',
      plafond: 'Plafond',
    },
  },
  {
    fichier: 'src/data/roofMaterials.json',
    labels: {
      tuile: 'Tuile',
      chaume: 'Chaume',
      'toit-ardoise': 'Ardoise',
      plan: 'Plan (vue de dessus)',
    },
  },
];

const erreurs = [];
const ecrits = [];

for (const lot of LOTS) {
  const cible = path.join(ROOT, lot.fichier);
  const brut = fs.readFileSync(cible, 'utf8');
  const data = JSON.parse(brut);
  if (JSON.stringify(data, null, 2) !== brut) {
    erreurs.push(`${lot.fichier} : FORME NON CANONIQUE (pas \`JSON.stringify(doc, null, 2)\`)`);
    continue;
  }
  if (!Array.isArray(data)) {
    erreurs.push(`${lot.fichier} : racine de forme inattendue (tableau attendu)`);
    continue;
  }
  const vus = new Set();
  const sortie = [];
  let poses = 0;
  let ko = false;
  for (const [i, entree] of data.entries()) {
    if (!entree || typeof entree !== 'object' || typeof entree.id !== 'string' || entree.id === '') {
      erreurs.push(`${lot.fichier} entrée #${i} : \`id\` absent ou non-chaîne`);
      ko = true;
      continue;
    }
    const label = lot.labels[entree.id];
    if (label === undefined) {
      erreurs.push(`${lot.fichier} : \`${entree.id}\` sans label ARBITRÉ — arbitrage requis`);
      ko = true;
      continue;
    }
    if (entree.label !== undefined && entree.label !== label) {
      erreurs.push(`${lot.fichier} : \`${entree.id}\`.label = ${JSON.stringify(entree.label)} ≠ ${JSON.stringify(label)} — arbitrage requis`);
      ko = true;
      continue;
    }
    vus.add(entree.id);
    if (entree.label === undefined) poses++;
    const { id, label: _mort, ...reste } = entree;
    sortie.push({ id, label, ...reste });
  }
  const orphelins = Object.keys(lot.labels).filter((id) => !vus.has(id));
  if (orphelins.length) {
    erreurs.push(`${lot.fichier} : label(s) arbitré(s) SANS entrée — ${orphelins.join(', ')}`);
    ko = true;
  }
  if (ko) continue;
  ecrits.push({ lot, cible, brut, out: JSON.stringify(sortie, null, 2), n: sortie.length, poses });
}

if (erreurs.length) {
  console.error(`relief/roof labels : ${erreurs.length} anomalie(s) — RIEN n'est écrit :`);
  for (const m of erreurs) console.error(`  ${m}`);
  process.exit(1);
}

const echecs = [];
for (const { lot, cible, out, n, poses } of ecrits) {
  // NO-OP SÉMANTIQUE : ce script ne possède que la POSE du `label` arbitré — les labels déjà
  // présents sont vérifiés égaux à l'arbitrage par la porte ci-dessus. Aucun à poser = rien à écrire,
  // quel que soit l'ordre des clés : l'insertion de `label` en 2ᵉ clé est une normalisation
  // d'enveloppe, et une égalité à l'octet en ferait une réécriture à elle seule.
  if (poses > 0) fs.writeFileSync(cible, out, 'utf8');
  // PREUVE post-écriture : cardinal conservé, `id` en tête, `label` non vide égal à l'arbitrage.
  const apres = JSON.parse(fs.readFileSync(cible, 'utf8'));
  if (apres.length !== n) echecs.push(`POST — ${lot.fichier} : ${apres.length} entrée(s) ≠ ${n}`);
  for (const e of apres) {
    if (e.label !== lot.labels[e.id] || !e.label) echecs.push(`POST — ${lot.fichier} : ${e.id} label ${JSON.stringify(e.label)} ≠ arbitrage`);
    if (Object.keys(e)[0] !== 'id') echecs.push(`POST — ${lot.fichier} : ${e.id} première clé ${Object.keys(e)[0]} ≠ id`);
  }
  console.log(`${poses === 0 ? 'no-op' : 'migré'} ${path.basename(lot.fichier)} — ${poses} label(s) posé(s), ${apres.length} arbitré(s)`);
}

if (echecs.length) {
  console.error(`ÉCHEC POST-ÉCRITURE — ${echecs.length} anomalie(s) :`);
  for (const m of echecs) console.error(`  ${m}`);
  process.exit(1);
}
