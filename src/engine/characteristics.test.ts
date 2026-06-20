import { describe, it, expect } from 'vitest';
import { effectiveChar } from './characteristics';
import type { Combatant, CharKey } from './types';

/** Combatant minimal : seuls `characteristics` et `activeEffects` importent ici (pool non-cumul). */
function mk(activeEffects: { char: CharKey; bonus: number }[] = [], F = 40): Combatant {
  return {
    id: 'c', name: 'c', kind: 'enemy', advantage: 0, conditions: [],
    characteristics: { F, Ag: 30 } as never,
    activeEffects: activeEffects as never,
    psychState: [], psychTraits: [], groups: [], weapons: [], armour: {} as never,
    skills: [], talents: [], movement: 4, wounds: { current: 10, max: 10 },
  } as Combatant;
}

describe('effectiveChar — non-cumul des modificateurs (LDB l.168 : meilleur bonus + pire pénalité, sommés)', () => {
  it('aucun effet actif → valeur de base', () => {
    expect(effectiveChar(mk(), 'F')).toBe(40);
  });
  it('plusieurs bonus → seul le MEILLEUR s’applique (+20, +10 → +20)', () => {
    expect(effectiveChar(mk([{ char: 'F', bonus: 20 }, { char: 'F', bonus: 10 }]), 'F')).toBe(60);
  });
  it('plusieurs pénalités → seule la PIRE s’applique (−10, −20 → −20)', () => {
    expect(effectiveChar(mk([{ char: 'F', bonus: -10 }, { char: 'F', bonus: -20 }]), 'F')).toBe(20);
  });
  it('mélange → meilleur bonus + pire pénalité (+20, +10, −10 → +10 net)', () => {
    expect(effectiveChar(mk([{ char: 'F', bonus: 20 }, { char: 'F', bonus: 10 }, { char: 'F', bonus: -10 }]), 'F')).toBe(50);
  });
  it('effets ciblant une AUTRE caractéristique → ignorés', () => {
    expect(effectiveChar(mk([{ char: 'Ag', bonus: 30 }]), 'F')).toBe(40);
  });
});
