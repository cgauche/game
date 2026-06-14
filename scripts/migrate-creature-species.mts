/**
 * Migration one-shot (plan P1a) — fige l'espèce d'apparence EXPLICITE sur le bestiaire.
 * Pour chaque créature BIPÈDE (rendue par le rig humanoïde), gèle `species` = résultat actuel du
 * match-par-nom (`bipedSpeciesMatch`), pour que le rig lise cette clé au lieu de re-deviner depuis le
 * nom (POC). Les non-bipèdes (plan quad/ailé/…) sont laissés tels quels (clé de plan = phase suivante).
 * Écrit avec `serializeDataset` (format fidèle, garanti par serialize.test.ts).
 *
 *   npx tsx scripts/migrate-creature-species.mts
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { bipedSpeciesMatch, creaturePlanMatch } from '../src/gameIso/rig/creatures';
import { serializeDataset } from '../src/data/serialize';

const FILE = join(fileURLToPath(new URL('.', import.meta.url)), '../src/data/creatures.json');
const creatures = JSON.parse(readFileSync(FILE, 'utf8')) as Array<Record<string, unknown>>;

let frozen = 0;
for (const c of creatures) {
  const label = String(c.label);
  if (creaturePlanMatch(label)) continue; // non-bipède : plan name-matché → phase suivante
  const species = bipedSpeciesMatch(label) ?? 'Humain';
  if (c.species !== species) {
    c.species = species;
    frozen++;
  }
}

writeFileSync(FILE, serializeDataset(creatures), 'utf8');
console.log(`P1a — species figée sur ${frozen} créatures bipèdes (sur ${creatures.length}).`);
