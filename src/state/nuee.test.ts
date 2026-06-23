import { describe, it, expect } from 'vitest';
import { statblockToCombatant } from './spawn';
import { attackModifiers } from '../engine/combat';
import type { Weapon } from '../engine/types';

// Nuée — Trait Essaim (LDB 85 l.199-200) : ignore Taille & Psychologie, +40 au tir contre elle,
// ×5 PB + 10 CC au build, Frappe Mortelle sur touche, 1 PB/Round aux Engagés.
const bow: Weapon = { name: 'Arc', type: 'ranged', damage: { plusBF: false, flat: 8 }, range: 60, qualities: [] };

describe('Nuée — Trait Essaim (LDB 85 l.199-200)', () => {
  it('build au spawn : ×5 PB, +10 CC, immunité Psychologie, flag swarm', () => {
    const c = statblockToCombatant({ name: 'Nuée de rats', char: { CC: 35, F: 30, E: 30, B: 5 }, traits: [{ id: 'nuee' }, { id: 'taille', arg: 'Petite' }] }, 'x', { x: 0, y: 0 });
    expect(c.swarm).toBe(true);
    expect(c.psychImmune).toBe(true);
    expect(c.wounds.max).toBe(25); // 5 × 5 (PB d'une créature type)
    expect(c.characteristics.CC).toBe(45); // 35 + 10
  });

  it('sans le trait : ni swarm ni ×5', () => {
    const c = statblockToCombatant({ name: 'Rat', char: { CC: 35, B: 5 }, traits: [{ id: 'taille', arg: 'Petite' }] }, 'x', { x: 0, y: 0 });
    expect(c.swarm).toBeUndefined();
    expect(c.wounds.max).toBe(5);
    expect(c.characteristics.CC).toBe(35);
  });

  it('+40 au tir CONTRE une nuée, et la Taille de la cible est ignorée', () => {
    const swarm = statblockToCombatant({ name: 'Nuée', char: { B: 5 }, traits: [{ id: 'nuee' }, { id: 'taille', arg: 'Petite' }] }, 's', { x: 0, y: 0 });
    const shooter = statblockToCombatant({ name: 'Tireur', char: {} }, 't', { x: 5, y: 0 });
    const mods = attackModifiers(shooter, swarm, bow, { kind: 'ranged' });
    expect(mods.some((m) => m.label === 'Nuée (tir)' && m.value === 40)).toBe(true);
    expect(mods.some((m) => m.label.startsWith('Taille (cible)'))).toBe(false); // Taille ignorée (l.200)
  });
});
