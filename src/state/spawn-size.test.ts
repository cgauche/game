import { describe, it, expect } from 'vitest';
import { statblockToCombatant, sizeFromTraits } from './spawn';

describe('sizeFromTraits + dérivation de Taille au spawn (LDB 85)', () => {
  it('parse le trait Taille (insensible accents/casse)', () => {
    expect(sizeFromTraits(['Taille (Énorme)'])).toBe('enorme');
    expect(sizeFromTraits(['Arme (Épée) +7', 'Taille (Grande)'])).toBe('grande');
    expect(sizeFromTraits(['Taille (de Petite à Énorme)'])).toBe('enorme'); // plage → borne haute
    expect(sizeFromTraits(['Arme +5'])).toBeNull();
  });
  it('statblockToCombatant : Taille dérivée du trait', () => {
    const c = statblockToCombatant({ name: 'Troll', char: { B: 30 }, traits: ['Taille (Grande)'] }, 'x', { x: 0, y: 0 });
    expect(c.size).toBe('grande');
  });
  it('statblockToCombatant : champ size explicite prioritaire sur le trait', () => {
    const c = statblockToCombatant({ name: 'X', char: {}, size: 'enorme', traits: ['Taille (Grande)'] }, 'x', { x: 0, y: 0 });
    expect(c.size).toBe('enorme');
  });
  it('statblockToCombatant : défaut Moyenne sans trait ni champ', () => {
    const c = statblockToCombatant({ name: 'X', char: {} }, 'x', { x: 0, y: 0 });
    expect(c.size).toBe('moyenne');
  });
  it('wounds.base : sans char.B → formule (woundsForSize) ; avec char.B → surcharge', () => {
    const f = statblockToCombatant({ name: 'X', char: { F: 30, E: 30, FM: 30 } }, 'x', { x: 0, y: 0 });
    expect(f.wounds.max).toBe(12); // 3 + 2·3 + 3 (Moyenne)
    expect(f.wounds.base).toBe(12);
    const o = statblockToCombatant({ name: 'Y', char: { F: 30, E: 30, FM: 30, B: 50 } }, 'y', { x: 0, y: 0 });
    expect(o.wounds.max).toBe(50); // surcharge
    expect(o.wounds.base).toBe(50);
  });
});
