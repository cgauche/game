import { describe, it, expect } from 'vitest';
import { cosmeticPart } from './cosmetic';
import { genericPart } from './generic';
import { pickView } from './types';

const sv = (slot: 'visage' | 'cheveux', sp: string, sex: 'M' | 'F', idx: number) =>
  pickView(cosmeticPart(slot, sp, sex, idx), 'front');

describe('cosmeticPart', () => {
  it('renvoie un fragment SVG non vide pour visage et cheveux', () => {
    expect(sv('visage', 'Humain', 'M', 0)).toContain('<');
    expect(sv('cheveux', 'Humain', 'M', 0)).toContain('<');
  });
  it('art généré par espèce : déterministe (index ignoré quand une tête existe)', () => {
    const a = sv('cheveux', 'Humain', 'M', 0);
    const b = sv('cheveux', 'Humain', 'M', 5);
    expect(a).toBe(b);
    expect(a.length).toBeGreaterThan(20);
  });
  it('normalise les variantes régionales vers l’espèce de base', () => {
    expect(sv('visage', 'Humains (Reiklander)', 'M', 0)).toBe(sv('visage', 'Humain', 'M', 0));
  });
  it('le Nain mâle a une part cheveux distincte (barbe) du Halfling', () => {
    expect(sv('cheveux', 'Nain', 'M', 0)).not.toBe(sv('cheveux', 'Halfling', 'M', 0));
  });
  it('espèce sans art généré (Gnome) : secours sans planter, non vide', () => {
    expect(sv('visage', 'Gnome', 'M', 0)).toContain('<');
    expect(sv('cheveux', 'Gnome', 'M', 999)).toContain('<');
  });
});

describe('genericPart', () => {
  it('fournit un vêtement fallback pour les slots de corps habillés', () => {
    for (const s of ['torse', 'bras', 'jambes'] as const)
      expect(pickView(genericPart(s), 'front')).toContain('<');
  });
  it('tete (couvre-chef) et arme sont vides par défaut (tête nue / mains nues)', () => {
    expect(pickView(genericPart('tete'), 'front')).toBe('');
    expect(pickView(genericPart('arme'), 'front')).toBe('');
  });
});
