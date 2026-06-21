/**
 * Migration PONCTUELLE : tout champ de Dégâts d'arme en CHAÎNE (« +BF+4 ») → `WeaponDamageSpec` structuré,
 * via le PARSER UNIQUE `parseDamage` (src/engine/items.ts). Couvre `TrappingData.damage` ET les armes
 * dérivées imbriquées (`derivedWeapon.damage` des prothèses-armes et des mutations). Échoue bruyamment
 * sur toute forme inattendue (round-trip `damageString` non identique).
 *
 * Usage : npx tsx scripts/frenchy/migrate-weapon-damage.mts [--write]
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { parseDamage, damageString } from '../../src/engine/items';

const __dirname = dirname(fileURLToPath(import.meta.url));
const write = process.argv.includes('--write');
const fails: string[] = [];

/** Convertit toute clé `damage` STRING rencontrée (récursif) en `WeaponDamageSpec`, en vérifiant le round-trip. */
function convert(o: unknown, where: string): number {
  let n = 0;
  if (Array.isArray(o)) {
    o.forEach((v, i) => { n += convert(v, `${where}[${i}]`); });
  } else if (o && typeof o === 'object') {
    const rec = o as Record<string, unknown>;
    for (const [k, v] of Object.entries(rec)) {
      if (k === 'damage' && typeof v === 'string') {
        const spec = parseDamage(v);
        if (damageString(spec) !== v.trim()) fails.push(`${where}/damage: « ${v} » → ${JSON.stringify(spec)} → « ${damageString(spec)} »`);
        rec.damage = spec;
        n++;
      } else {
        n += convert(v, `${where}/${k}`);
      }
    }
  }
  return n;
}

for (const file of ['trappings.json', 'mutations.json']) {
  const path = resolve(__dirname, '../../src/data', file);
  const data = JSON.parse(readFileSync(path, 'utf8'));
  const migrated = convert(data, file);
  if (fails.length) { console.error('⚠ round-trip damageString≠original :'); for (const f of fails) console.error('  ' + f); process.exit(1); }
  if (write && migrated) writeFileSync(path, JSON.stringify(data, null, 2));
  console.log(`${file} : ${migrated} damage migrés ${write && migrated ? 'ÉCRITS' : '(aperçu)'} — round-trip OK`);
}
