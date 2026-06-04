import { describe, it, expect } from 'vitest';
import { makePregens } from './pregens';

describe('Personnages pré-tirés', () => {
  it('se génèrent tous sans erreur (labels d’espèce/carrière valides)', () => {
    const errs: unknown[] = [];
    const orig = console.error;
    console.error = (...a: unknown[]) => errs.push(a);
    const pregens = makePregens();
    console.error = orig;
    expect(errs).toEqual([]); // aucun pré-tiré ignoré
    expect(pregens.length).toBe(8);
    for (const h of pregens) {
      expect(h.kind).toBe('hero');
      expect(h.wounds.max).toBeGreaterThan(0);
      expect(h.species).toBeTruthy();
    }
    // Les deux incantateurs portent bien leurs sorts.
    const sorcier = pregens.find((h) => h.career === 'Sorcier');
    const pretre = pregens.find((h) => h.career === 'Prêtre');
    expect(sorcier?.spells).toContain('Fléchette');
    expect(pretre?.spells).toContain('Bénédiction de Guérison');
  });
});
