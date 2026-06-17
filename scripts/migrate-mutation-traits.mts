/** One-shot : destringifie le champ `traits` de `mutations.json` (DONNÉE) en `TraitInstance[]`,
 *  via le vrai `parseTraitInstance`. LF / JSON.stringify(…,2). */
import { readFileSync, writeFileSync } from 'node:fs';
import { parseTraitInstance } from '../src/engine/traits/dispatch';

const path = 'src/data/mutations.json';
const arr = JSON.parse(readFileSync(path, 'utf8')) as { traits?: unknown[] }[];
let n = 0;
for (const m of arr) {
  if (!Array.isArray(m.traits)) continue;
  m.traits = m.traits.map((t) => (typeof t === 'string' ? (n++, parseTraitInstance(t)) : t));
}
writeFileSync(path, JSON.stringify(arr, null, 2));
console.log(`destringified ${n} mutation trait(s)`);
