/**
 * Terrain : présentation unifiée. Chaque `TerrainDef` porte SES arrêts de dégradé (`stops`,
 * source unique avec `swatch`) ; `sprites.ts` ASSEMBLE les `<linearGradient>` de terrain depuis
 * ce registre. On vérifie la complétude des `stops` et la parité de l'assemblage.
 */
import { describe, it, expect } from 'vitest';
import { TERRAIN_DEFS } from './index';
import { DEFS } from '../../gameIso/sprites';

describe('terrain — arrêts de dégradé en donnée', () => {
  it('chaque terrain a des arrêts non vides', () => {
    for (const t of TERRAIN_DEFS) {
      expect(t.stops.length, `${t.id} sans stops`).toBeGreaterThan(0);
      for (const s of t.stops) {
        expect(s.off, `${t.id}: offset`).toMatch(/%$/);
        expect(s.color, `${t.id}: couleur`).toMatch(/^#[0-9a-fA-F]{3,8}$/);
      }
    }
  });

  it('DEFS assemble le dégradé de terrain g_grass avec sa première couleur', () => {
    expect(DEFS).toContain('<linearGradient id="g_grass"');
    // g_grass : premier arrêt #4d7a38 (parité avec l'ancien blob).
    expect(DEFS).toContain('<stop offset="0%" stop-color="#4d7a38"/>');
  });
});
