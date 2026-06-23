/**
 * Migration PONCTUELLE : prose `range`/`target` des sorts → structure typée (SpellRange/SpellTarget),
 * en réutilisant le PARSER UNIQUE `src/engine/spellRange.ts`. Réconcilie l'aire avec le champ structuré
 * existant `zdeRadiusMeters` (prioritaire), qu'elle supprime ensuite (avec `zdeExcludesCaster`).
 *
 * Usage : npx tsx scripts/frenchy/migrate-spell-rangetarget.mts          # aperçu + liste de revue
 *         npx tsx scripts/frenchy/migrate-spell-rangetarget.mts --write   # écrit les .json
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { parseSpellRange, parseSpellTarget, type SpellTarget } from '../../src/engine/spellRange';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA = resolve(__dirname, '../../src/data');
const FILES = ['spells.json', 'frenchy-spells.json'];
const write = process.argv.includes('--write');

const reviewSpecial: string[] = []; // valeurs tombées en `special` (revue data homebrew)
const conflicts: string[] = []; // zdeRadiusMeters présent mais cible parsée ≠ aire

for (const file of FILES) {
  const path = resolve(DATA, file);
  const arr = JSON.parse(readFileSync(path, 'utf8')) as Record<string, unknown>[];
  for (const sp of arr) {
    const id = String(sp.id);
    // RANGE — null (homebrew sans donnée) reste null ; sinon parse.
    if (sp.range == null) sp.range = null;
    else {
      const r = parseSpellRange(String(sp.range));
      if (r.kind === 'special') reviewSpecial.push(`${file}:${id} range=${JSON.stringify(sp.range)}`);
      sp.range = r;
    }
    // TARGET — l'aire structurée (`zdeRadiusMeters`) prime sur la prose ; sinon parse.
    let target: SpellTarget | null;
    if (sp.zdeRadiusMeters != null) {
      target = { kind: 'area', span: 'radius', meters: sp.zdeRadiusMeters as never, ...(sp.zdeExcludesCaster ? { excludesCaster: true } : {}) };
      const parsed = sp.target != null ? parseSpellTarget(sp.target as number | string) : null;
      if (parsed && parsed.kind !== 'area' && parsed.kind !== 'special' && parsed.kind !== 'self') {
        conflicts.push(`${file}:${id} zdeRadiusMeters mais target prose=${JSON.stringify(sp.target)} (→${parsed.kind})`);
      }
    } else if (sp.target == null) {
      target = null;
    } else {
      const t = parseSpellTarget(sp.target as number | string);
      if (t.kind === 'special') reviewSpecial.push(`${file}:${id} target=${JSON.stringify(sp.target)}`);
      target = t;
    }
    sp.target = target;
    delete sp.zdeRadiusMeters;
    delete sp.zdeExcludesCaster;
  }
  if (write) writeFileSync(path, JSON.stringify(arr, null, 2));
  console.log(`${file}: ${arr.length} sorts ${write ? 'ÉCRITS' : '(aperçu)'}`);
}

console.log(`\n── ${reviewSpecial.length} valeurs en escape hatch « special » (revue data homebrew) ──`);
for (const l of reviewSpecial.slice(0, 60)) console.log('  ' + l);
if (reviewSpecial.length > 60) console.log(`  … +${reviewSpecial.length - 60}`);
if (conflicts.length) {
  console.log(`\n⚠ ${conflicts.length} CONFLITS zdeRadiusMeters↔target :`);
  for (const l of conflicts) console.log('  ' + l);
}
console.log(write ? '\n✅ écrit (relancer serialize.test pour le round-trip byte-fidèle)' : '\nℹ aperçu — relancer avec --write');
