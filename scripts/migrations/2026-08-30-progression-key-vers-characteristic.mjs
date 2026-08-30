/**
 * Migration L2 #1548 — `progression-schemas.derived.json` : la marque de niveau nomme sa
 * Caractéristique `characteristic`, plus `key`.
 *
 * Le champ est un `charKeySchema` (`src/data/schemas/defs/progression-schemas-derived.ts:27`) :
 * une RÉFÉRENCE à une Caractéristique, pas l'identité de la marque (666 marques pour 10 valeurs
 * distinctes). Il prend donc la graphie de RÉFÉRENCE du lexique.
 *
 * L'artefact étant GÉNÉRÉ, `scripts/data/gen-progression-schemas.py` écrit désormais cette forme —
 * la migration et le générateur convergent, ce que `--check` mesure à l'OCTET.
 *
 * ENTRÉES : `src/data/progression-schemas.derived.json` (la seule donnée lue et écrite).
 *
 * RENAME PUR : aucune valeur ne change, aucune clé ne bouge de position. PREUVE : les deux artefacts
 * (avant, après) ramenés à la graphie `key` sont deep-equal (imprimée à chaque exécution).
 * IDEMPOTENT : rejouée sur l'état final, elle n'écrit rien et sort 0 (0 renommage, preuve verte).
 * FAIL-FAST : une marque portant `key` ET `characteristic`, ou une marque sans ni l'une ni l'autre,
 * ou une forme non canonique → rien n'est écrit, sortie 1.
 * FORMATAGE PRÉSERVÉ : le fichier est EXACTEMENT `JSON.stringify(doc, null, 2)`, vérifié AVANT toute
 * écriture, et réécrit tel quel (LF, aucun `\r`).
 */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const CIBLE = path.join(ROOT, 'src/data/progression-schemas.derived.json');
const REL = 'src/data/progression-schemas.derived.json';

const brut = fs.readFileSync(CIBLE, 'utf8');
const data = JSON.parse(brut);

if (JSON.stringify(data, null, 2) !== brut) {
  console.error(`FORME NON CANONIQUE — ${REL} n’est pas \`JSON.stringify(doc, null, 2)\` ; AUCUNE écriture.`);
  process.exit(1);
}

/** Renomme une clé EN PLACE dans un objet (l'ordre des clés est conservé). */
const renommer = (obj, de, vers) =>
  Object.fromEntries(Object.entries(obj).map(([k, v]) => [k === de ? vers : k, v]));

/** Parcourt les marques de `lv[1..4]` de chaque bande, dans l'ordre de lecture. */
function* marques(doc) {
  for (const s of doc.schemas ?? []) {
    for (const n of ['1', '2', '3', '4']) {
      const liste = s.lv?.[n] ?? [];
      for (let i = 0; i < liste.length; i++) yield { liste, i, m: liste[i], chemin: `schemas.lv.${n}` };
    }
  }
}

const echecs = [];
for (const { m, chemin } of marques(data)) {
  const aKey = Object.hasOwn(m, 'key');
  const aChar = Object.hasOwn(m, 'characteristic');
  if (aKey && aChar) echecs.push(`${chemin} : \`key\` ET \`characteristic\` présents — arbitrage requis`);
  if (!aKey && !aChar) echecs.push(`${chemin} : marque sans Caractéristique — ${JSON.stringify(m)}`);
}
if (echecs.length) {
  console.error(`ARBITRAGE REQUIS — ${echecs.length} anomalie(s), AUCUNE écriture :`);
  for (const e of new Set(echecs)) console.error(`  ${e}`);
  process.exit(1);
}

let renommees = 0;
for (const { liste, i, m } of marques(data)) {
  if (!Object.hasOwn(m, 'key')) continue;
  liste[i] = renommer(m, 'key', 'characteristic');
  renommees++;
}

const out = JSON.stringify(data, null, 2);
if (out !== brut) fs.writeFileSync(CIBLE, out, 'utf8');

// PREUVE post-écriture : plus aucune `key` de marque, et les deux artefacts RAMENÉS à la graphie
// `key` sont deep-equal — donc SEUL le nom du champ a changé. Vraie aussi au rejeu (les deux côtés
// sont déjà migrés, la normalisation est alors l'identité).
const versKey = (texte) => {
  const doc = JSON.parse(texte);
  for (const { liste, i, m } of marques(doc)) liste[i] = renommer(m, 'characteristic', 'key');
  return doc;
};
const apres = JSON.parse(out);
const restantes = [...marques(apres)].filter(({ m }) => Object.hasOwn(m, 'key'));

try {
  assert.equal(restantes.length, 0, `${restantes.length} marque(s) portent encore \`key\``);
  assert.deepEqual(versKey(out), versKey(brut));
  assert.equal(out.includes('\r'), false, 'le fichier réécrit contient un `\\r`');
} catch (e) {
  console.error(`VÉRIFICATION POST-ÉCRITURE ROUGE : ${e.message}`);
  process.exit(1);
}

const total = [...marques(apres)].length;
console.log(`${REL} — \`key\` → \`characteristic\` : ${renommees} renommage(s) sur ${total} marques.`);
console.log(`PREUVE deep-equal : les deux artefacts ramenés à la graphie \`key\` sont IDENTIQUES — OK ; marques portant encore \`key\` : 0 ; \\r : 0.`);
console.log(`Fichier ${out !== brut ? 'réécrit' : 'INCHANGÉ (no-op byte-identique)'} : ${REL}`);
