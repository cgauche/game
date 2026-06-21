/**
 * Migration PONCTUELLE : `ManeuverDef.range`/`blast` (formule-chaîne FR « Bonus d'Endurance + 20 mètres »)
 * → `ManeuverMeasure { bonusOf?: CharKey; plus?: number }` structuré. Échoue bruyamment sur toute forme
 * non reconnue (exit≠0). Re-sérialise `maneuvers.json` byte-fidèle (Node `JSON.stringify`).
 *
 * Usage : npx tsx scripts/frenchy/migrate-maneuver-measures.mts [--write]
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const path = resolve(__dirname, '../../src/data/maneuvers.json');
const write = process.argv.includes('--write');

/** Prose FR → `ManeuverMeasure`. null si non reconnue (échec). « Bonus d'Endurance »→`{bonusOf:'E'}`,
 *  « Bonus de Force »→`{bonusOf:'F'}`, « + N »/« N mètres »→`plus`. */
function parseMeasure(prose: string): { bonusOf?: string; plus?: number } | null {
  const bonusOf = /bonus d[e'’]\s*endurance/i.test(prose) ? 'E' : /bonus d[e'’]\s*force/i.test(prose) ? 'F' : undefined;
  let plus: number | undefined;
  const p = prose.match(/\+\s*(\d+)/);
  if (p) plus = parseInt(p[1], 10);
  if (!bonusOf) { const lit = prose.match(/(\d+)\s*m/i); if (lit) plus = parseInt(lit[1], 10); }
  const out: { bonusOf?: string; plus?: number } = {};
  if (bonusOf) out.bonusOf = bonusOf;
  if (plus != null) out.plus = plus;
  return out.bonusOf || out.plus != null ? out : null; // vide = non reconnue
}

const arr = JSON.parse(readFileSync(path, 'utf8')) as Record<string, unknown>[];
const fails: string[] = [];
let migrated = 0;
for (const m of arr) {
  for (const field of ['range', 'blast'] as const) {
    const v = m[field];
    if (v == null || typeof v !== 'string') continue;
    const spec = parseMeasure(v);
    if (!spec) { fails.push(`${m.id}.${field}: « ${v} » non reconnue`); continue; }
    m[field] = spec;
    migrated++;
  }
}
if (fails.length) { console.error('⚠ formes non reconnues :'); for (const f of fails) console.error('  ' + f); process.exit(1); }
if (write && migrated) writeFileSync(path, JSON.stringify(arr, null, 2));
console.log(`maneuvers.json : ${migrated} mesures range/blast migrées ${write && migrated ? 'ÉCRITES' : '(aperçu)'}`);
