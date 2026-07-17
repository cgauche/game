import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  scanNamedImport,
  RAW_SYMBOL, RAW_ALLOWED, CHANNEL_SYMBOL, CHANNEL_ALLOWED,
} from '../../scripts/guards/lib/weatherTestModQuarantine.mjs';

/**
 * QUARANTAINE du CANAL météo « Tests physiques » (EDOC 8 l.82, #341). Le calcul brut
 * `weatherPhysicalTestMod` n'est importable QUE par le lecteur canonique `src/engine/weatherTestMod.ts` ;
 * le lecteur `weatherTestMods` (qui produit la ligne « Météo : … ») QUE par les étages de Test canoniques
 * (`combat.ts` : attack/defenseModifiers/baseTestMods ; `travelPostes.ts` : rangées d'Activité). Garde
 * STRUCTURELLE (doctrine « gardes structurelles, pas greps ») : pousser la météo dans une NOUVELLE surface
 * (une future modale, un nouvel écran) devient INEXPRIMABLE sans éditer la whitelist — c'est la garde qui
 * aurait attrapé le trou de la DÉFENSE avant l'audit. Whitelist FIXE, zéro violation tolérée.
 */

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const SRC = join(ROOT, 'src');

/** Fichiers `.ts(x)` de `src/` (hors tests) : chemin ABSOLU + POSIX relatif à la racine repo. */
function srcFiles(): { abs: string; rel: string }[] {
  const out: { abs: string; rel: string }[] = [];
  const walk = (dir: string) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (/\.tsx?$/.test(e.name) && !/\.test\.tsx?$/.test(e.name)) out.push({ abs: p, rel: relative(ROOT, p).split('\\').join('/') });
    }
  };
  walk(SRC);
  return out;
}

function offendersFor(symbol: string, allowed: string[]): string[] {
  const out: string[] = [];
  for (const { abs, rel } of srcFiles()) {
    if (allowed.includes(rel)) continue;
    const found = scanNamedImport(readFileSync(abs, 'utf8'), symbol);
    for (const f of found) out.push(`${rel}:${f.line} importe '${symbol}' de '${f.source}'`);
  }
  return out;
}

describe('quarantaine d’import — canal météo « Tests physiques » (#341)', () => {
  it(`'${RAW_SYMBOL}' n’est importé QUE par le lecteur canonique (${RAW_ALLOWED.join(', ')})`, () => {
    expect(
      offendersFor(RAW_SYMBOL, RAW_ALLOWED),
      'Calcul brut de météo importé hors du lecteur canonique — passer par `weatherTestMods` (src/engine/weatherTestMod.ts).',
    ).toEqual([]);
  });

  it(`'${CHANNEL_SYMBOL}' n’est importé QUE par les étages de Test canoniques (${CHANNEL_ALLOWED.join(', ')})`, () => {
    expect(
      offendersFor(CHANNEL_SYMBOL, CHANNEL_ALLOWED),
      'Canal météo câblé dans une surface non canonique — router le Test par combatModifiers/baseTestMods ou par une rangée d’Activité, ou ÉDITER la whitelist (revue).',
    ).toEqual([]);
  });

  it('FAIL-CLOSED : le scanner détecte un import nommé (valeur ET type, alias)', () => {
    expect(scanNamedImport("import { weatherPhysicalTestMod } from '../engine/travelStages';", 'weatherPhysicalTestMod')).toHaveLength(1);
    expect(scanNamedImport("import { a, weatherTestMods as w } from './x';", 'weatherTestMods')).toHaveLength(1);
    expect(scanNamedImport("import type { weatherTestMods } from './x';", 'weatherTestMods')).toHaveLength(1);
    expect(scanNamedImport("import { weatherRangedMod } from './x';", 'weatherPhysicalTestMod')).toHaveLength(0);
  });
});
