import { describe, it, expect } from 'vitest';
import { TERRAINS, terrainWalkable, terrainPriority } from './terrain';

describe('registre terrain', () => {
  it('contient les ids existants + nouveaux', () => {
    for (const id of ['herbe', 'sol', 'route', 'eau', 'plancher', 'bois', 'mur', 'porte', 'pave', 'terre', 'dalle'])
      expect(TERRAINS[id], id).toBeDefined();
  });
  it('walkability : herbe/route/pave franchissables, eau/mur non', () => {
    expect(terrainWalkable('herbe')).toBe(true);
    expect(terrainWalkable('pave')).toBe(true);
    expect(terrainWalkable('eau')).toBe(false);
    expect(terrainWalkable('mur')).toBe(false);
  });
  it('id inconnu → non franchissable (fallback bloquant)', () => {
    expect(terrainWalkable('zzz-inconnu')).toBe(false);
  });
  it('précédence : pave déborde sur herbe (priorité plus haute)', () => {
    expect(terrainPriority('pave')).toBeGreaterThan(terrainPriority('herbe'));
  });
});
