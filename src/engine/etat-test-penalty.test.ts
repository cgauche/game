import { describe, it, expect } from 'vitest';
import { combatTestPenalty, testStatePenalty, meleeAttackerBonus, addCondition, COND } from './conditions';
import type { Combatant } from './types';
import { findConditionById } from '../data';

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
    it('Assourdi → 0 en combat (pénalité d’AUDITION, pas un Test de combat — LDB 16 l.29)', () => { const c = mk(); addCondition(c, COND.assourdi); expect(combatTestPenalty(c)).toBe(0); });
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
    it('Assourdi → −10 sur un Test d’AUDITION (Perception) seulement (LDB 16 l.29)', () => {
      const c = mk(); addCondition(c, COND.assourdi);
      expect(testStatePenalty(c, 'perception')).toBe(-10); // Perception = hearing:true
      expect(testStatePenalty(c, 'athletisme')).toBe(0); // pas un Test d'audition
    });
  });
  // Cumul du MÊME État : les pénalités s'additionnent (LDB 16 l.11) — le « pire seul » (l.13) ne
  // départage que des États DIFFÉRENTS, après multiplication par les pions.
  describe('cumul du même État (perStack, LDB 16 l.11)', () => {
    it('Brisé ×3 → −30 (combat ET hors combat), sauf course/dissimulation', () => {
      const c = mk(); addCondition(c, COND.brise); addCondition(c, COND.brise); addCondition(c, COND.brise);
      expect(combatTestPenalty(c)).toBe(-30);
      expect(testStatePenalty(c, 'perception')).toBe(-30);
      expect(testStatePenalty(c, 'athletisme')).toBe(0);
      expect(testStatePenalty(c, 'discretion')).toBe(0);
    });
    it('Sonné ×2 → −20', () => {
      const c = mk(); addCondition(c, COND.sonne); addCondition(c, COND.sonne);
      expect(combatTestPenalty(c)).toBe(-20);
    });
    it('Empoisonné ×3 → −30', () => {
      const c = mk(); addCondition(c, COND.empoisonne); addCondition(c, COND.empoisonne); addCondition(c, COND.empoisonne);
      expect(combatTestPenalty(c)).toBe(-30);
    });
    it('Aveuglé ×2 → −20 en combat', () => {
      const c = mk(); addCondition(c, COND.aveugle); addCondition(c, COND.aveugle);
      expect(combatTestPenalty(c)).toBe(-20);
    });
    it('Assourdi ×2 → −20 sur un Test d’audition', () => {
      const c = mk(); addCondition(c, COND.assourdi); addCondition(c, COND.assourdi);
      expect(testStatePenalty(c, 'perception')).toBe(-20);
    });
    it('Empêtré ×2 → −20 sur un Test de déplacement', () => {
      const c = mk(); addCondition(c, COND.empetre); addCondition(c, COND.empetre);
      expect(testStatePenalty(c, 'escalade')).toBe(-20);
    });
    it('Assourdi ×3 : le bonus de flanc/dos reste +10 (LDB 16 l.29)', () => {
      const c = mk(); addCondition(c, COND.assourdi); addCondition(c, COND.assourdi); addCondition(c, COND.assourdi);
      expect(meleeAttackerBonus(c, { flankRear: true })).toBe(10);
    });
    it('À Terre ne se cumule pas (LDB 16 l.37) : 2 pions → toujours −20', () => {
      const c = mk(); addCondition(c, COND.aTerre); addCondition(c, COND.aTerre);
      expect(testStatePenalty(c, 'athletisme')).toBe(-20);
    });
    it('MIXTE : Brisé ×3 + Sonné ×1 → −30 (le pire POOL après ×pions, LDB 16 l.13)', () => {
      const c = mk(); addCondition(c, COND.brise); addCondition(c, COND.brise); addCondition(c, COND.brise); addCondition(c, COND.sonne);
      expect(combatTestPenalty(c)).toBe(-30);
      expect(testStatePenalty(c, 'perception')).toBe(-30);
    });
  });
  // TÉMOIN INVERSE : c'est la DONNÉE (`perStack` de l'entrée) qui gouverne le cumul, pas le code.
  it('la donnée gouverne : sans `perStack` sur l’entrée `brise`, Brisé ×3 retombe à −10', () => {
    const ed = findConditionById(COND.brise)!;
    expect(ed.perStack).toBe(true);
    delete ed.perStack;
    try {
      const c = mk(); addCondition(c, COND.brise); addCondition(c, COND.brise); addCondition(c, COND.brise);
      expect(combatTestPenalty(c)).toBe(-10);
    } finally {
      ed.perStack = true;
    }
    const c2 = mk(); addCondition(c2, COND.brise); addCondition(c2, COND.brise); addCondition(c2, COND.brise);
    expect(combatTestPenalty(c2)).toBe(-30);
  });
});
