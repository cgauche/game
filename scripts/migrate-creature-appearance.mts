/**
 * Migration one-shot (plan P2) — UNIFIE l'apparence par défaut SUR l'enregistrement créature.
 * Replie les champs top-level `species`/`tenue` (figés par P1a) dans UN bloc `appearance`
 * (EntityAppearance), pour que la créature soit UN seul record éditable (stats + apparence).
 * L'éditeur (CodexEdit → MonsterPartsFields) y ajoutera ensuite monster/colors/parts/etc.
 *
 *   npx tsx scripts/migrate-creature-appearance.mts
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { serializeDataset } from '../src/data/serialize';

const FILE = join(fileURLToPath(new URL('.', import.meta.url)), '../src/data/creatures.json');
const creatures = JSON.parse(readFileSync(FILE, 'utf8')) as Array<Record<string, unknown>>;

let folded = 0;
for (const c of creatures) {
  const app: Record<string, unknown> = {};
  if (c.species !== undefined) { app.species = c.species; delete c.species; }
  if (c.tenue !== undefined) { app.tenue = c.tenue; delete c.tenue; }
  if (Object.keys(app).length) { c.appearance = app; folded++; }
}

writeFileSync(FILE, serializeDataset(creatures), 'utf8');
console.log(`P2 apparence — species/tenue repliés dans appearance sur ${folded} créatures (sur ${creatures.length}).`);
