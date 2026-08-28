/**
 * Migration #1467 L1b V-P0d — les 6 `reliefMaterials.json` et les 4 `roofMaterials.json` reçoivent
 * leur `label`.
 *
 * MOTIF : l'enveloppe exige `label` non vide. Contrairement à 10a/10b, ces 10 libellés ne sont
 * DÉRIVABLES d'aucune source mesurée — ils sont ARBITRÉS (#1467 V-P0d). La table ci-dessous EST donc
 * l'arbitrage lui-même, pas la recopie d'une vérité qui vivrait ailleurs. Deux conséquences portées
 * par le lot : les matériaux de couverture prennent le SINGULIER (`Tuile`, et non le `Tuiles` que le
 * doublon codé en dur `ROOF_MATERIALS` affichait), et `riser` reçoit `Contremarche` sous réserve
 * — aucun site n'assigne ce matériau aujourd'hui, la convention de famille reste à confirmer à
 * l'usage (#1540).
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
      riser: 'Contremarche',
      plafond: 'Plafond',
      'sol-inconnu': 'Sol inconnu',
    },
  },
  {
    fichier: 'src/data/roofMaterials.json',
    labels: {
      tuile: 'Tuile',
      chaume: 'Chaume',
      ardoise: 'Ardoise',
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
    const { id, label: _mort, ...reste } = entree;
    sortie.push({ id, label, ...reste });
  }
  const orphelins = Object.keys(lot.labels).filter((id) => !vus.has(id));
  if (orphelins.length) {
    erreurs.push(`${lot.fichier} : label(s) arbitré(s) SANS entrée — ${orphelins.join(', ')}`);
    ko = true;
  }
  if (ko) continue;
  ecrits.push({ lot, cible, brut, out: JSON.stringify(sortie, null, 2), n: sortie.length });
}

if (erreurs.length) {
  console.error(`relief/roof labels : ${erreurs.length} anomalie(s) — RIEN n'est écrit :`);
  for (const m of erreurs) console.error(`  ${m}`);
  process.exit(1);
}

const echecs = [];
for (const { lot, cible, brut, out, n } of ecrits) {
  if (out !== brut) fs.writeFileSync(cible, out, 'utf8');
  // PREUVE post-écriture : cardinal conservé, `label` non vide en 2ᵉ clé, égal à l'arbitrage.
  const apres = JSON.parse(fs.readFileSync(cible, 'utf8'));
  if (apres.length !== n) echecs.push(`POST — ${lot.fichier} : ${apres.length} entrée(s) ≠ ${n}`);
  for (const e of apres) {
    if (e.label !== lot.labels[e.id] || !e.label) echecs.push(`POST — ${lot.fichier} : ${e.id} label ${JSON.stringify(e.label)} ≠ arbitrage`);
    if (Object.keys(e).slice(0, 2).join(',') !== 'id,label') echecs.push(`POST — ${lot.fichier} : ${e.id} clés de tête ${Object.keys(e).slice(0, 2).join(',')} ≠ id,label`);
  }
  console.log(`${out === brut ? 'no-op' : 'migré'} ${path.basename(lot.fichier)} — ${apres.length} label(s) arbitré(s)`);
}

if (echecs.length) {
  console.error(`ÉCHEC POST-ÉCRITURE — ${echecs.length} anomalie(s) :`);
  for (const m of echecs) console.error(`  ${m}`);
  process.exit(1);
}
