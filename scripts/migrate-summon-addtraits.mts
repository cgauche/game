/** One-shot : destringifie `summon.addTraits` (op) dans `spells.json` — `string[]` (libellés) →
 *  `TraitInstance[]` via le vrai `parseTraitInstance`. LF / JSON.stringify(…,2) (byte-fidèle). */
import { readFileSync, writeFileSync } from 'node:fs';
import { parseTraitInstance } from '../src/engine/traits/dispatch';

const path = 'src/data/spells.json';
const root = JSON.parse(readFileSync(path, 'utf8'));
let n = 0;
const walk = (o: unknown): void => {
  if (Array.isArray(o)) { o.forEach(walk); return; }
  if (!o || typeof o !== 'object') return;
  const rec = o as Record<string, unknown>;
  if (rec.op === 'summon' && Array.isArray(rec.addTraits)) {
    rec.addTraits = rec.addTraits.map((t) => (typeof t === 'string' ? (n++, parseTraitInstance(t)) : t));
  }
  for (const k of Object.keys(rec)) walk(rec[k]);
};
walk(root);
writeFileSync(path, JSON.stringify(root, null, 2));
console.log(`destringified ${n} summon.addTraits labels`);
