import { describe, it, expect } from 'vitest';
import { testScenarios } from './index';

describe('Batterie de scénarios de test', () => {
  it('couvre au moins 6 scénarios', () => {
    expect(testScenarios.length).toBeGreaterThanOrEqual(6);
  });
  // Invariants GÉNÉRIQUES sur tout le set (s'adapte à la refonte sans liste d'ids à maintenir).
  it.each(testScenarios.map((s) => [s.id, s] as const))(
    'le scénario %s a un groupe de héros non vide et une scène cohérente',
    (_id, s) => {
      const party = s.makeParty();
      expect(party.length).toBeGreaterThanOrEqual(1);
      expect(party.every((h) => h.kind === 'hero')).toBe(true);
      expect(s.scene.levels[0].tiles.length).toBe(s.scene.dimensions.w * s.scene.dimensions.h);
      if (s.autoCombat) expect(s.scene.encounters.find((e) => e.id === s.autoCombat)).toBeTruthy();
    },
  );
  it('contient les piliers Embuscade et Magie', () => {
    expect(testScenarios.find((s) => s.id === 'embuscade')).toBeTruthy();
    expect(testScenarios.find((s) => s.id === 'magie')).toBeTruthy();
  });
});
