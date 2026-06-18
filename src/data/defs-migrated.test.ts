/**
 * Garde-fou ANTI-RÉGRESSION de la migration « defs/ mécaniques → DONNÉE » (traits + qualités).
 * Directive : les `defs/` ne servent QU'aux SVG (rig) ; toute la mécanique des Traits et des Atouts/
 * Défauts vit dans `traits.json` / `qualities.json` (capabilities/passive/effects), le registre est
 * DÉRIVÉ de la donnée, et le runtime résout PAR ID. Toute réintroduction d'un `defs/` mécanique ou
 * d'un `_registry.generated` casse ici. Cf. [[game-label-id-migration-complete]].
 */
import { describe, it, expect } from 'vitest';
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { traits, qualities, findTraitById, findQualityById } from './index';

const ENGINE = join(fileURLToPath(new URL('../engine', import.meta.url)));
/** Fichiers `.ts` (hors tests) présents dans un dossier — [] si le dossier n'existe pas. */
const tsFiles = (rel: string): string[] =>
  existsSync(join(ENGINE, rel)) ? readdirSync(join(ENGINE, rel)).filter((f) => f.endsWith('.ts') && !f.endsWith('.test.ts')) : [];

describe('defs mécaniques migrées en DONNÉE (traits + qualités)', () => {
  it('aucun fichier defs/ mécanique de Traits ne subsiste (seuls les defs SVG du rig sont permis)', () => {
    expect(tsFiles('traits/defs')).toEqual([]);
  });
  it('aucun fichier defs/ mécanique de Qualités ne subsiste', () => {
    expect(tsFiles('qualities/defs')).toEqual([]);
  });
  it('aucun registre généré (_registry.generated.ts) pour Traits/Qualités', () => {
    expect(existsSync(join(ENGINE, 'traits/_registry.generated.ts'))).toBe(false);
    expect(existsSync(join(ENGINE, 'qualities/_registry.generated.ts'))).toBe(false);
  });
  it('chaque Trait de traits.json résout PAR ID (registre dérivé de la donnée)', () => {
    for (const t of traits) expect(findTraitById(t.id), t.id).toBeTruthy();
  });
  it('chaque Qualité de qualities.json résout PAR ID', () => {
    for (const q of qualities) expect(findQualityById(q.id), q.id).toBeTruthy();
  });
});
