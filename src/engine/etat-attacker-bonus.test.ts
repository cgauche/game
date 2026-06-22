import { describe, it, expect } from 'vitest';
import { meleeAttackerBonus, addCondition, COND } from './conditions';
import type { Combatant } from './types';

/** Combattant nu (le bonus dépend UNIQUEMENT des États portés, lus en données via passiveMods). */
const mk = (): Combatant => ({
  id: 'x', name: 'X', kind: 'enemy', characteristics: {}, skills: [], talents: [], traits: [],
  conditions: [], activeEffects: [], liveTraits: [], weapons: [], armour: [],
  wounds: { current: 10, max: 10, base: 10 }, advantage: 0,
}) as unknown as Combatant;

describe('meleeAttackerBonus — bonus à l’attaquant lu en DONNÉES (etats.json, plus de branche par-nom)', () => {
  it('À Terre → +20', () => {
    const c = mk(); addCondition(c, COND.aTerre);
    expect(meleeAttackerBonus(c)).toBe(20);
  });
  it('Surpris → +20', () => {
    const c = mk(); addCondition(c, COND.surpris);
    expect(meleeAttackerBonus(c)).toBe(20);
  });
  it('Aveuglé → +10', () => {
    const c = mk(); addCondition(c, COND.aveugle);
    expect(meleeAttackerBonus(c)).toBe(10);
  });
  it('non-cumul (LDB 16) : Aveuglé + À Terre → le MEILLEUR seul (+20)', () => {
    const c = mk(); addCondition(c, COND.aveugle); addCondition(c, COND.aTerre);
    expect(meleeAttackerBonus(c)).toBe(20);
  });
  it('aucun État pertinent (Empoisonné n’octroie pas de bonus) → 0', () => {
    const c = mk(); addCondition(c, COND.empoisonne);
    expect(meleeAttackerBonus(c)).toBe(0);
  });
});
