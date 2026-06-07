import { describe, it, expect } from 'vitest';
import { socialPsychMod } from './skills';
import type { Combatant } from './types';

function mk(opts: Partial<Combatant>): Combatant {
  return { id: 'c', name: 'c', kind: 'enemy', advantage: 0, conditions: [], characteristics: {} as never, psychState: [], psychTraits: [], groups: [], weapons: [], armour: {} as never, skills: [], talents: [], movement: 4, wounds: { current: 10, max: 10 }, ...opts } as Combatant;
}

describe('socialPsychMod — pénalités de Sociabilité psy (LDB 21, P3)', () => {
  it('Animosité ACTIVE vs le groupe → −20 (l.22)', () => {
    const tester = mk({ psychState: [{ type: 'animosite', cible: 'Elfes', active: true }] });
    expect(socialPsychMod(tester, mk({ groups: ['Elfe'] }))).toBe(-20);
    expect(socialPsychMod(tester, mk({ groups: ['Humain'] }))).toBe(0); // hors groupe
  });
  it('Animosité INACTIVE (résistée) → 0', () => {
    const tester = mk({ psychState: [{ type: 'animosite', cible: 'Elfes', active: false }] });
    expect(socialPsychMod(tester, mk({ groups: ['Elfe'] }))).toBe(0);
  });
  it('Préjugé (trait passif) vs le groupe → −10 (l.43-52)', () => {
    const tester = mk({ psychTraits: [{ type: 'prejuge', cible: 'Nains' }] });
    expect(socialPsychMod(tester, mk({ groups: ['Nain'] }))).toBe(-10);
    expect(socialPsychMod(tester, mk({ groups: ['Elfe'] }))).toBe(0);
  });
  it('Animosité + Préjugé cumulent', () => {
    const tester = mk({ psychState: [{ type: 'animosite', cible: 'Gobelins', active: true }], psychTraits: [{ type: 'prejuge', cible: 'Gobelins' }] });
    expect(socialPsychMod(tester, mk({ groups: ['Gobelin'] }))).toBe(-30);
  });
});
