import { describe, it, expect } from 'vitest';
import { findTableEntry } from './tables';

describe('findTableEntry — lookup d100 par fourchette [min,max] (source unique)', () => {
  const table = [
    { min: 1, max: 10, v: 'a' },
    { min: 11, max: 20, v: 'b' },
    { min: 21, max: 100, v: 'c' },
  ];
  it('trouve l’entrée contenant le jet (bornes incluses)', () => {
    expect(findTableEntry(table, 5).v).toBe('a');
    expect(findTableEntry(table, 11).v).toBe('b'); // borne basse
    expect(findTableEntry(table, 20).v).toBe('b'); // borne haute
    expect(findTableEntry(table, 50).v).toBe('c');
  });
  it('repli sur la DERNIÈRE entrée si le jet dépasse la table', () => {
    expect(findTableEntry(table, 999).v).toBe('c');
  });
});
