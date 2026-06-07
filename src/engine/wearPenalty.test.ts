import { describe, it, expect } from 'vitest';
import { parseWearPenalty, wornArmourPenalty } from './wearPenalty';
import type { Combatant } from './types';

describe('parseWearPenalty', () => {
  it('parse « -10% en Discrétion » → { skill: Discrétion, value: -10 }', () => {
    expect(parseWearPenalty('-10% en Discrétion')).toEqual({ skill: 'Discrétion', value: -10 });
  });
  it('parse « -20% en Perception »', () => {
    expect(parseWearPenalty('-20% en Perception')).toEqual({ skill: 'Perception', value: -20 });
  });
  it('renvoie null pour une qualité non-pénalité', () => {
    expect(parseWearPenalty('Flexible')).toBeNull();
    expect(parseWearPenalty('Impénétrable')).toBeNull();
  });
});

function mkWearer(qualities: string[]): Combatant {
  return {
    id: 'h', name: 'A', kind: 'hero',
    characteristics: { CC: 30, CT: 30, F: 30, E: 30, I: 40, Ag: 40, Dex: 30, Int: 30, FM: 30, Soc: 30 },
    wounds: { current: 10, max: 10 }, advantage: 0, conditions: [], movement: 4, skills: [], talents: [],
    armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
    items: [{ uid: 'a1', name: 'Heaume', kind: 'armor', qualities, pa: 2, locs: ['tete'], enc: 2, equipped: true }],
  } as unknown as Combatant;
}

describe('wornArmourPenalty', () => {
  it('somme la pénalité de la compétence portée (Perception -20 sur un Heaume)', () => {
    expect(wornArmourPenalty(mkWearer(['-10% en Discrétion', '-20% en Perception']), 'Perception')).toBe(-20);
    expect(wornArmourPenalty(mkWearer(['-10% en Discrétion', '-20% en Perception']), 'Discrétion')).toBe(-10);
  });
  it('ignore une pièce NON équipée', () => {
    const c = mkWearer(['-20% en Perception']);
    c.items![0].equipped = false;
    expect(wornArmourPenalty(c, 'Perception')).toBe(0);
  });
  it('Pratique réduit la pénalité d’un niveau (+10, plancher 0)', () => {
    expect(wornArmourPenalty(mkWearer(['-20% en Perception', 'Pratique']), 'Perception')).toBe(-10);
    expect(wornArmourPenalty(mkWearer(['-10% en Discrétion', 'Pratique']), 'Discrétion')).toBe(0);
  });
  it('Peu Fiable double la pénalité', () => {
    expect(wornArmourPenalty(mkWearer(['-10% en Discrétion', 'Peu Fiable']), 'Discrétion')).toBe(-20);
  });
  it('match insensible à la spécialisation et à la casse', () => {
    expect(wornArmourPenalty(mkWearer(['-10% en Discrétion']), 'discrétion (Urbaine)')).toBe(-10);
  });
});
