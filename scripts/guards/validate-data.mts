/**
 * Valide un ou plusieurs `src/data/*.json` contre leur schéma zod (`src/data/schemas/`, contrat de
 * donnée Lot 1). Un fichier SANS schéma enregistré (`SCHEMA_DEFS`) est ignoré SILENCIEUSEMENT tant
 * que la migration n'est pas terminée (cf. `PENDING` dans `src/data/schema-contract.test.ts`).
 * Destiné au hook pre-commit (branché par l'orchestrateur) : reçoit des chemins en arguments.
 *
 *   npx tsx scripts/guards/validate-data.mts src/data/characteristics.json [...]
 *
 * Exit 0 si tous les fichiers passés valident (ou sont ignorés) ; exit 1 + rapport lisible sinon.
 */
import { readFileSync } from 'node:fs';
import { basename, resolve } from 'node:path';
import { SCHEMA_DEFS } from '../../src/data/schemas/_registry.generated';

const SCHEMA_BY_FILE = new Map(SCHEMA_DEFS.map((d) => [d.file, d.schema]));

const paths = process.argv.slice(2);
if (paths.length === 0) {
  console.error('Usage: npx tsx scripts/guards/validate-data.mts <chemin.json> [...]');
  process.exit(1);
}

let bad = 0;
let checked = 0;
for (const p of paths) {
  const file = basename(p);
  const schema = SCHEMA_BY_FILE.get(file);
  if (!schema) continue; // pas encore migré (PENDING) — ignoré silencieusement
  checked++;
  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(resolve(p), 'utf8'));
  } catch (err) {
    bad++;
    console.error(`KO ${file} — JSON illisible : ${(err as Error).message}`);
    continue;
  }
  const result = schema.safeParse(raw);
  if (!result.success) {
    bad++;
    console.error(`KO ${file} — invalide contre son schéma :`);
    for (const iss of result.error.issues) console.error(`  - ${iss.path.join('.') || '(racine)'}: ${iss.message}`);
  }
}

if (bad > 0) {
  console.error(`\n${bad}/${checked} fichier(s) schématisé(s) invalide(s).`);
  process.exit(1);
}
console.log(`OK: ${checked} fichier(s) schématisé(s) validé(s) (${paths.length - checked} ignoré(s), pas de schéma).`);
