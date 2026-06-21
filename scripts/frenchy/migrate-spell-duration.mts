/**
 * Migration PONCTUELLE : prose `duration` des sorts → structure `SpellDuration`, en repliant le champ
 * structuré existant `durationRounds: Formula` (échelle Rounds, prioritaire) qu'elle supprime ensuite.
 * Réutilise le PARSER UNIQUE `src/engine/spellDuration.ts`.
 *
 * Usage : npx tsx scripts/frenchy/migrate-spell-duration.mts [--write]
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { parseSpellDuration, type SpellDuration } from '../../src/engine/spellDuration';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA = resolve(__dirname, '../../src/data');
const FILES = ['spells.json', 'frenchy-spells.json'];
const write = process.argv.includes('--write');

const review: string[] = [];
const conflicts: string[] = [];

for (const file of FILES) {
  const path = resolve(DATA, file);
  const arr = JSON.parse(readFileSync(path, 'utf8')) as Record<string, unknown>[];
  for (const sp of arr) {
    let dur: SpellDuration | null;
    if (sp.durationRounds != null) {
      dur = { kind: 'rounds', value: sp.durationRounds as never };
      const parsed = sp.duration != null ? parseSpellDuration(String(sp.duration)) : null;
      if (parsed && parsed.kind !== 'rounds' && parsed.kind !== 'special' && parsed.kind !== 'instant') {
        conflicts.push(`${file}:${sp.id} durationRounds mais prose=${JSON.stringify(sp.duration)} (→${parsed.kind})`);
      }
    } else if (sp.duration == null) {
      dur = null;
    } else {
      dur = parseSpellDuration(String(sp.duration));
      if (dur.kind === 'special') review.push(`${file}:${sp.id} duration=${JSON.stringify(sp.duration)}`);
    }
    sp.duration = dur;
    delete sp.durationRounds;
  }
  if (write) writeFileSync(path, JSON.stringify(arr, null, 2));
  console.log(`${file}: ${arr.length} sorts ${write ? 'ÉCRITS' : '(aperçu)'}`);
}

console.log(`\n── ${review.length} durées en escape hatch « special » (revue homebrew) ──`);
for (const l of review) console.log('  ' + l);
if (conflicts.length) { console.log(`\n⚠ ${conflicts.length} CONFLITS durationRounds↔prose :`); for (const l of conflicts) console.log('  ' + l); }
console.log(write ? '\n✅ écrit' : '\nℹ aperçu — relancer avec --write');
