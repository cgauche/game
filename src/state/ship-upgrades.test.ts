import { describe, it, expect } from 'vitest';
import { spawnEnemy } from './spawn';

/**
 * Améliorations d'INSTANCE (MDG ch.12) appliquées au spawn : un navire-instance = type + `upgrades[]`
 * (libellés verbatim). **Blindage** (l.234/236) confère des PA à la coque (`armour.corps`), consommés tels
 * quels par les dégâts navals (`applyOps` op `wounds` déduit `armour.corps`). Comme un `ItemInstance` + qualités.
 */
describe('spawn — Blindage (Amélioration d’instance) → PA de coque', () => {
  const at = { x: 0, y: 0 };

  it('cogue + « Blindage (fer) » → 2 PA de coque (emptyArmour 0 + fer 2)', () => {
    const hull = spawnEnemy('cogue', undefined, 'hull-fer', at, { upgrades: ['Blindage (fer)'] });
    expect(hull.bodyShape).toBe('vehicule');
    expect(hull.upgrades).toEqual(['Blindage (fer)']); // l'instance porte ses améliorations
    expect(hull.armour.corps).toBe(2);
  });

  it('« Blindage (bronze) » → 1 PA ; sans Amélioration → 0 PA (coque nue)', () => {
    expect(spawnEnemy('cogue', undefined, 'h-bronze', at, { upgrades: ['Blindage (bronze)'] }).armour.corps).toBe(1);
    expect(spawnEnemy('cogue', undefined, 'h-nue', at).armour.corps).toBe(0);
  });

  it('une Amélioration NON-PA (Lissage) ne touche pas l’armure de coque', () => {
    const hull = spawnEnemy('cogue', undefined, 'h-lissage', at, { upgrades: ['Lissage'] });
    expect(hull.upgrades).toEqual(['Lissage']);
    expect(hull.armour.corps).toBe(0); // Lissage agit sur le M, pas sur les PA
  });
});
