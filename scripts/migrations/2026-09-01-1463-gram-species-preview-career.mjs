/**
 * Migration L-gram-2 (#1463) — l'habillage d'aperçu d'une espèce cesse de nommer sa carrière par une
 * CHAÎNE sous une enveloppe à un seul champ : `preview: { career: 'X' }` devient
 * `previewCareer: { id: 'X' }`, la référence que `ref('career')` refine au parse
 * (`src/data/schemas/grammaire/ref.ts`, `careers.json`). L'enveloppe `preview` ne portait qu'un
 * champ, et ce champ était une clé étrangère qu'aucune porte ne validait.
 *
 * ENTRÉES : `src/data/species.json` — les seules entrées portant la clé `preview` (RACINE) ;
 * `src/data/schemas/_ids.generated.ts` est LU (jamais écrit) pour vérifier que chaque id produit
 * existe dans `careers.json`. Cardinal ASSERTÉ 27 SUR LE RÉSULTAT : après écriture, 27 entrées
 * portent `previewCareer`, ZÉRO porte encore `preview`.
 * EXHAUSTIVITÉ : une entrée dont `preview` porterait une AUTRE clé que `career`, ou un `career`
 * absent de `careers.json`, arrête la migration AVANT toute écriture (sortie 1).
 * IDEMPOTENT : rejouée sur l'état final, elle ne trouve plus aucun porteur de `preview` et sort 0.
 * FORMATAGE PRÉSERVÉ : `JSON.stringify(doc, null, 2)` exact (LF), constaté AVANT toute écriture.
 */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const FICHIER = 'src/data/species.json';
const CARDINAL = 27;

/** Ids de `careers.json` tels que `idDe('career')` les refine — le registre généré lui-même
 *  (`src/data/schemas/grammaire/ref.ts` › `idsDe`, `cibleDe('career') === 'careers.json'`). */
const registre = fs.readFileSync(path.join(ROOT, 'src/data/schemas/_ids.generated.ts'), 'utf8');
const ligneRegistre = /'careers\.json':\s*\[([^\]]*)\]/.exec(registre);
if (!ligneRegistre) {
  console.error("REGISTRE ILLISIBLE — `IDS_PAR_DATASET['careers.json']` introuvable ; AUCUNE écriture.");
  process.exit(1);
}
const IDS_CARRIERE = new Set([...ligneRegistre[1].matchAll(/'([^']*)'/g)].map((m) => m[1]));
assert.ok(IDS_CARRIERE.size > 100, `registre des ids de carrière suspect (${IDS_CARRIERE.size} ids)`);

const abs = path.join(ROOT, FICHIER);
const brut = fs.readFileSync(abs, 'utf8');
const data = JSON.parse(brut);
if (JSON.stringify(data, null, 2) !== brut) {
  console.error(`FORME NON CANONIQUE — ${FICHIER} n'est pas un JSON indenté à 2 ; AUCUNE écriture.`);
  process.exit(1);
}

const porteurs = data.filter((e) => e && typeof e === 'object' && e.preview !== undefined);
if (porteurs.length === 0) {
  console.log('RIEN À FAIRE — aucune espèce ne porte encore l’enveloppe `preview`.');
  process.exit(0);
}

/** ANOMALIES relevées AVANT toute écriture : clé inattendue sous `preview`, ou id hors catalogue. */
const anomalies = [];
for (const e of porteurs) {
  const cles = Object.keys(e.preview ?? {});
  if (cles.length !== 1 || cles[0] !== 'career') {
    anomalies.push(`${e.id} : \`preview\` porte ${JSON.stringify(cles)} — la migration ne sait déplacer que \`career\``);
    continue;
  }
  const id = e.preview.career;
  if (typeof id !== 'string' || !IDS_CARRIERE.has(id)) {
    anomalies.push(`${e.id} : « ${String(id)} » absent de careers.json`);
  }
  if (e.previewCareer !== undefined) anomalies.push(`${e.id} : porte DÉJÀ \`previewCareer\` en plus de \`preview\``);
}
if (anomalies.length) {
  console.error(`ANOMALIES (${anomalies.length}) — AUCUNE écriture :`);
  for (const a of anomalies) console.error(`  - ${a}`);
  process.exit(1);
}

/** L'ORDRE des clés est conservé : `previewCareer` prend la place exacte de `preview`. */
const migree = data.map((e) => {
  if (!e || typeof e !== 'object' || e.preview === undefined) return e;
  return Object.fromEntries(
    Object.entries(e).map(([k, v]) => (k === 'preview' ? ['previewCareer', { id: v.career }] : [k, v])),
  );
});

// SEULE la clé relevée a changé : le document, privé de `preview`/`previewCareer`, est inchangé.
const sansApercu = (liste) => liste.map((e) => {
  if (!e || typeof e !== 'object') return e;
  const { preview: _p, previewCareer: _pc, ...reste } = e;
  return reste;
});
assert.deepEqual(sansApercu(migree), sansApercu(data), `${FICHIER} : la migration a changé autre chose que l’aperçu`);

// CARDINAL sur le RÉSULTAT — jamais sur le delta.
const finaux = migree.filter((e) => e && typeof e === 'object' && e.previewCareer !== undefined);
assert.equal(finaux.length, CARDINAL, `cardinal attendu ${CARDINAL} espèces porteuses de previewCareer, vu ${finaux.length}`);
assert.equal(
  migree.filter((e) => e && typeof e === 'object' && e.preview !== undefined).length,
  0,
  'une enveloppe `preview` a survécu',
);
for (const e of finaux) assert.ok(IDS_CARRIERE.has(e.previewCareer.id), `${e.id} : id de carrière hors catalogue après écriture`);

fs.writeFileSync(abs, JSON.stringify(migree, null, 2));
console.log(`${CARDINAL} espèces : \`preview.career\` → \`previewCareer.id\` (référence résolue contre careers.json).`);
