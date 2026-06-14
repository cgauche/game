/**
 * Migration one-shot (plan P1, carrière) — fige la carrière d'apparence EXPLICITE sur le bestiaire.
 * Pour chaque créature BIPÈDE, gèle `career` = carrière RÉSOLUE aujourd'hui par `entityRigProfile`
 * (chaîne perso ?? race ?? detectCareer/ROLE_CAREERS), pour que le rig lise cette clé au lieu de la
 * re-deviner du nom (regex `ROLE_CAREERS`). À lancer AVANT de modifier la résolution dans enemyProfile.
 * Non-bipèdes : pas de tenue (rendus par leur plan) → ignorés.
 *
 *   npx tsx scripts/migrate-creature-career.mts
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { entityRigProfile } from '../src/gameIso/rig/enemyProfile';
import { serializeDataset } from '../src/data/serialize';

const FILE = join(fileURLToPath(new URL('.', import.meta.url)), '../src/data/creatures.json');
const creatures = JSON.parse(readFileSync(FILE, 'utf8')) as Array<Record<string, unknown>>;

let frozen = 0;
for (const c of creatures) {
  const prof = entityRigProfile(String(c.label), 7); // seed fixe (la carrière ne dépend pas du seed)
  if (!prof) continue; // non-bipède
  if (c.career !== prof.career) {
    c.career = prof.career;
    frozen++;
  }
}

writeFileSync(FILE, serializeDataset(creatures), 'utf8');
console.log(`P1 carrière — career figée sur ${frozen} créatures bipèdes (sur ${creatures.length}).`);
