import { describe, it, expect } from 'vitest';
import { cosmeticPart } from './cosmetic';
import { genericPart } from './generic';

describe('cosmeticPart', () => {
  it('renvoie un fragment SVG non vide pour visage et cheveux', () => {
    expect(cosmeticPart('visage', 'Humain', 'M', 0).svg).toContain('<');
    expect(cosmeticPart('cheveux', 'Humain', 'M', 0).svg).toContain('<');
  });
  it('art généré par espèce : déterministe (index ignoré quand une tête existe)', () => {
    const a = cosmeticPart('cheveux', 'Humain', 'M', 0).svg;
    const b = cosmeticPart('cheveux', 'Humain', 'M', 5).svg;
    expect(a).toBe(b);
    expect(a.length).toBeGreaterThan(20);
  });
  it('normalise les variantes régionales vers l’espèce de base', () => {
    expect(cosmeticPart('visage', 'Humains (Reiklander)', 'M', 0).svg).toBe(
      cosmeticPart('visage', 'Humain', 'M', 0).svg,
    );
  });
  it('le Nain mâle a une part cheveux distincte (barbe) du Halfling', () => {
    expect(cosmeticPart('cheveux', 'Nain', 'M', 0).svg).not.toBe(
      cosmeticPart('cheveux', 'Halfling', 'M', 0).svg,
    );
  });
  it('espèce sans art généré (Gnome) : secours sans planter, non vide', () => {
    expect(cosmeticPart('visage', 'Gnome', 'M', 0).svg).toContain('<');
    expect(cosmeticPart('cheveux', 'Gnome', 'M', 999).svg).toContain('<');
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
