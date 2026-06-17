/**
 * One-shot : destringifie l'AUTHORING de traits du projet Arène (`arene-projet.json`) :
 *   - `entity.combat.optionals: string[]`  → `TraitInstance[]`
 *   - `entity.statblock.traits: string[]`  → `TraitInstance[]`  (custom statblocks)
 * via le VRAI parseur `parseTraitInstance` (source unique, zéro logique dupliquée).
 * NE TOUCHE PAS `combat.spells` / `statblock.spells` / `skills` / `talents` (restent string[]).
 * Écrit en LF / `JSON.stringify(…, 1) + '\n'` — format canonique de `scripts/arene/generate.mjs`
 * (indent 1 + newline final), byte-fidèle au reste du fichier.
 *   npx tsx scripts/migrate-arene-authoring-traits.mts
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { parseTraitInstance } from '../src/engine/traits/dispatch';

const path = 'src/scenes/arene/arene-projet.json';
const root = JSON.parse(readFileSync(path, 'utf8'));

let nOpt = 0;
let nTraits = 0;

const isStringArray = (v: unknown): v is string[] =>
  Array.isArray(v) && v.every((x) => typeof x === 'string');

/** Marche récursive : chaque objet portant `combat.optionals` / `statblock.traits` en string[] est migré. */
function walk(node: unknown): void {
  if (Array.isArray(node)) {
    for (const item of node) walk(item);
    return;
  }
  if (!node || typeof node !== 'object') return;
  const obj = node as Record<string, unknown>;

  const combat = obj.combat as Record<string, unknown> | undefined;
  if (combat && isStringArray(combat.optionals)) {
    combat.optionals = combat.optionals.map((s) => {
      nOpt++;
      return parseTraitInstance(s);
    });
  }
  const statblock = obj.statblock as Record<string, unknown> | undefined;
  if (statblock && isStringArray(statblock.traits)) {
    statblock.traits = statblock.traits.map((s) => {
      nTraits++;
      return parseTraitInstance(s);
    });
  }

  for (const v of Object.values(obj)) walk(v);
}

walk(root);
writeFileSync(path, JSON.stringify(root, null, 1) + '\n');
console.log(`destringified ${nOpt} optionals + ${nTraits} statblock traits in ${path}`);
