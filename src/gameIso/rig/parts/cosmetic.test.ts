import { describe, it, expect } from 'vitest';
import { cosmeticPart } from './cosmetic';
import { genericPart } from './generic';

describe('cosmeticPart', () => {
  it('renvoie un fragment SVG non vide pour visage', () => {
    expect(cosmeticPart('visage', 'Humain', 'M', 0).svg).toContain('<');
  });
  it('cheveux varie selon l’index (déterministe)', () => {
    const a = cosmeticPart('cheveux', 'Humain', 'M', 0).svg;
    const b = cosmeticPart('cheveux', 'Humain', 'M', 1).svg;
    expect(a).not.toBe(b);
  });
  it('index hors-bornes retombe sur la 1re variante', () => {
    const a = cosmeticPart('cheveux', 'Humain', 'M', 0).svg;
    const big = cosmeticPart('cheveux', 'Humain', 'M', 999).svg;
    expect(big).toBe(a);
  });
});

describe('genericPart', () => {
  it('fournit un vêtement fallback pour les slots de corps habillés', () => {
    for (const s of ['torse', 'bras', 'jambes'] as const)
      expect(genericPart(s).svg).toContain('<');
  });
  it('tete (couvre-chef) et arme sont vides par défaut (tête nue / mains nues)', () => {
    expect(genericPart('tete').svg).toBe('');
    expect(genericPart('arme').svg).toBe('');
  });
});
