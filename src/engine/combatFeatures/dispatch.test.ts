import { describe, it, expect } from 'vitest';
import { offHandPenalty } from './dispatch';
import type { Combatant } from '../types';

const mk = (talents: { name: string; times: number }[]): Combatant =>
  ({ id: 'c', name: 'X', kind: 'hero', talents, skills: [] } as unknown as Combatant);

describe('offHandPenalty (registre de capacités)', () => {
  it('sans Ambidextre : -20 (LDB 14 l.181)', () => {
    expect(offHandPenalty(mk([]))).toBe(-20);
  });
  it('Ambidextre 1x : -10 (LDB 10 l.32)', () => {
    expect(offHandPenalty(mk([{ name: 'Ambidextre', times: 1 }]))).toBe(-10);
  });
  it('Ambidextre 2x : 0', () => {
    expect(offHandPenalty(mk([{ name: 'Ambidextre', times: 2 }]))).toBe(0);
  });
  it('insensible a la casse du nom de talent', () => {
    expect(offHandPenalty(mk([{ name: 'ambidextre', times: 1 }]))).toBe(-10);
  });
});
