import { describe, it, expect } from 'vitest';
import { combatTestPenalty, testStatePenalty, addCondition, COND } from './conditions';
import type { Combatant } from './types';

const mk = (): Combatant => ({
  id: 'x', name: 'X', kind: 'hero', characteristics: {}, skills: [], talents: [], traits: [],
  conditions: [], activeEffects: [], liveTraits: [], weapons: [], armour: [],
  wounds: { current: 10, max: 10, base: 10 }, advantage: 0,
}) as unknown as Combatant;

describe('pénalités de Test d’État lues en DONNÉES (etats.json passive testMod)', () => {
  describe('combat (combatTestPenalty)', () => {
    it('Sonné → −10', () => { const c = mk(); addCondition(c, COND.sonne); expect(combatTestPenalty(c)).toBe(-10); });
    it('Exténué ×2 → −20 (perStack)', () => { const c = mk(); addCondition(c, COND.extenue); addCondition(c, COND.extenue); expect(combatTestPenalty(c)).toBe(-20); });
    it('non-cumul (LDB 16 l.20) : Sonné + Exténué×3 → le PIRE seul (−30)', () => {
      const c = mk(); addCondition(c, COND.sonne); addCondition(c, COND.extenue); addCondition(c, COND.extenue); addCondition(c, COND.extenue);
      expect(combatTestPenalty(c)).toBe(-30);
    });
    it('Aveuglé → −10 (combatOnly s’applique EN combat)', () => { const c = mk(); addCondition(c, COND.aveugle); expect(combatTestPenalty(c)).toBe(-10); });
    it('À Terre → 0 (pénalité de DÉPLACEMENT, pas un Test de combat)', () => { const c = mk(); addCondition(c, COND.aTerre); expect(combatTestPenalty(c)).toBe(0); });
  });
  describe('hors combat (testStatePenalty)', () => {
    it('Aveuglé → 0 (combatOnly : non classé hors combat)', () => { const c = mk(); addCondition(c, COND.aveugle); expect(testStatePenalty(c, 'perception')).toBe(0); });
    it('À Terre → −20 sur un Test de DÉPLACEMENT (Athlétisme)', () => { const c = mk(); addCondition(c, COND.aTerre); expect(testStatePenalty(c, 'athletisme')).toBe(-20); });
    it('À Terre → 0 sur un Test NON-déplacement (Perception)', () => { const c = mk(); addCondition(c, COND.aTerre); expect(testStatePenalty(c, 'perception')).toBe(0); });
    it('Brisé → −10 sauf course/dissimulation', () => {
      const c = mk(); addCondition(c, COND.brise);
      expect(testStatePenalty(c, 'perception')).toBe(-10);
      expect(testStatePenalty(c, 'athletisme')).toBe(0);
      expect(testStatePenalty(c, 'discretion')).toBe(0);
    });
    it('Empêtré → −10 sur un Test de déplacement seulement', () => {
      const c = mk(); addCondition(c, COND.empetre);
      expect(testStatePenalty(c, 'escalade')).toBe(-10);
      expect(testStatePenalty(c, 'perception')).toBe(0);
    });
  });
});
