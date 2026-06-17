/**
 * One-shot : destringifie `creatures.json` — `traits: string[]` → `TraitInstance[]` structurés
 * (`{ id, value?, arg?, count?, range? }`), via le VRAI parseur `parseTraitInstance` (source unique,
 * pas de logique dupliquée). Écrit en LF / `JSON.stringify(…, 2)` (byte-fidèle, serialize.test).
 *   npx tsx scripts/migrate-trait-instances.mts
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { parseTraitInstance } from '../src/engine/traits/dispatch';

const path = 'src/data/creatures.json';
const arr = JSON.parse(readFileSync(path, 'utf8')) as { traits?: unknown[] }[];
let n = 0;
for (const cr of arr) {
  if (!Array.isArray(cr.traits)) continue;
  cr.traits = cr.traits.map((t) => {
    if (typeof t !== 'string') return t;
    n++;
    return parseTraitInstance(t);
  });
}
writeFileSync(path, JSON.stringify(arr, null, 2));
console.log(`destringified ${n} trait strings across ${arr.length} creatures`);
