/**
 * One-shot : migre les ops `grantTrait` de `src/data/spells.json` de l'ANCIEN champ libellé
 * `{ op:'grantTrait', trait:'X', indice?:… }` vers le NOUVEAU `{ op:'grantTrait', traitId:'<slug>',
 * arg?:'…', indice?:… }`. Le split `id`+`arg` (« Haine (Morts-vivants) » → traitId:'haine',
 * arg:'Morts-vivants') passe par le VRAI parseur `parseTraitInstance` (source unique). Les autres
 * champs (`indice`, `indicePerSL`, `onlyGroups`) sont préservés DANS LEUR ORDRE.
 * Écrit en `JSON.stringify(…, 2)` sans newline final (cf. serialize.ts / serialize.test).
 *   npx tsx scripts/migrate-spell-granttrait.mts
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { parseTraitInstance } from '../src/engine/traits/dispatch';

const path = 'src/data/spells.json';
const root = JSON.parse(readFileSync(path, 'utf8'));

let n = 0;

function walk(node: unknown): void {
  if (Array.isArray(node)) {
    for (const item of node) walk(item);
    return;
  }
  if (!node || typeof node !== 'object') return;
  const obj = node as Record<string, unknown>;

  if (obj.op === 'grantTrait' && typeof obj.trait === 'string') {
    n++;
    const parsed = parseTraitInstance(obj.trait);
    // Reconstruit l'op en PRÉSERVANT l'ordre des clés : op, traitId, [arg], puis le reste original.
    const rebuilt: Record<string, unknown> = { op: 'grantTrait', traitId: parsed.id };
    if (parsed.arg != null) rebuilt.arg = parsed.arg;
    for (const [k, v] of Object.entries(obj)) {
      if (k === 'op' || k === 'trait') continue; // 'op' déjà posé ; 'trait' remplacé par traitId
      rebuilt[k] = v;
    }
    // Mute en place : vide puis ré-assigne dans le bon ordre.
    for (const k of Object.keys(obj)) delete obj[k];
    Object.assign(obj, rebuilt);
  }

  for (const v of Object.values(obj)) walk(v);
}

walk(root);
writeFileSync(path, JSON.stringify(root, null, 2));
console.log(`migrated ${n} grantTrait ops (trait → traitId) in ${path}`);
