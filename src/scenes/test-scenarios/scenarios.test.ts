import { describe, it, expect } from 'vitest';
import { testScenarios } from './index';

describe('Batterie de scénarios de test', () => {
  it('couvre au moins 6 scénarios', () => {
    expect(testScenarios.length).toBeGreaterThanOrEqual(6);
  });
  it.each(['embuscade', 'critiques-mort', 'destin-resilience', 'engagement', 'magie'])(
    'le scénario %s existe, a un groupe non vide et une scène valide',
    (id) => {
      const s = testScenarios.find((x) => x.id === id)!;
      expect(s).toBeTruthy();
      const party = s.makeParty();
      expect(party.length).toBeGreaterThanOrEqual(1);
      expect(party.every((h) => h.kind === 'hero')).toBe(true);
      expect(s.scene.tiles.length).toBe(s.scene.dimensions.w * s.scene.dimensions.h);
      if (s.autoCombat) expect(s.scene.encounters.find((e) => e.id === s.autoCombat)).toBeTruthy();
    },
  );
});
