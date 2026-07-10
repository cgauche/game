import { describe, it, expect } from 'vitest';
import { spawnEnemy } from './spawn';
import { shipManeuverParams } from './shipManeuver';

/**
 * Améliorations d'INSTANCE (MDG ch.12) appliquées au spawn : un navire-instance = type + `upgrades[]`
 * (libellés verbatim). **Blindage** (l.234/236) confère des PA à la coque (`armour.corps`), consommés tels
 * quels par les dégâts navals (`applyOps` op `wounds` déduit `armour.corps`). Comme un `ItemInstance` + qualités.
 */
describe('spawn — Blindage (Amélioration d’instance) → PA de coque', () => {
  const at = { x: 0, y: 0 };

  it('cogue + « Blindage (fer) » → 2 PA de coque (emptyArmour 0 + fer 2)', () => {
    const hull = spawnEnemy('cogue', undefined, 'hull-fer', at, { upgrades: [{ id: 'blindage-fer' }] });
    expect(hull.bodyShape).toBe('vehicule');
    expect(hull.upgrades).toEqual([{ id: 'blindage-fer' }]); // l'instance porte ses améliorations (réf par id)
    expect(hull.armour.corps).toBe(2);
  });

  it('« Blindage (bronze) » → 1 PA ; sans Amélioration → 0 PA (coque nue)', () => {
    expect(spawnEnemy('cogue', undefined, 'h-bronze', at, { upgrades: [{ id: 'blindage-bronze' }] }).armour.corps).toBe(1);
    expect(spawnEnemy('cogue', undefined, 'h-nue', at).armour.corps).toBe(0);
  });

  it('une Amélioration NON-PA (Lissage) ne touche pas l’armure de coque', () => {
    const hull = spawnEnemy('cogue', undefined, 'h-lissage', at, { upgrades: [{ id: 'lissage' }] });
    expect(hull.upgrades).toEqual([{ id: 'lissage' }]);
    expect(hull.armour.corps).toBe(0); // Lissage agit sur le M, pas sur les PA
  });

  it('« Coque de course » → 2×M de manœuvre, op moveScale APPLIQUÉE dans shipManeuverParams (T2C ch.10 l.27)', () => {
    // cogue à voile : M de base 5 ; Coque de course multiplie APRÈS les moveMod additifs → 10.
    expect(shipManeuverParams(spawnEnemy('cogue', undefined, 'h-nue2', at)).baseM).toBe(5);
    const hull = spawnEnemy('cogue', undefined, 'h-course', at, { upgrades: [{ id: 'coque-de-course' }] });
    expect(shipManeuverParams(hull).baseM).toBe(10);
    // combinée à Lissage (moveMod +1) : (5 + 1) × 2 = 12 — l'additif précède le facteur (ordre canonique).
    const hull2 = spawnEnemy('cogue', undefined, 'h-course-liss', at, { upgrades: [{ id: 'coque-de-course' }, { id: 'lissage' }] });
    expect(shipManeuverParams(hull2).baseM).toBe(12);
  });
});
