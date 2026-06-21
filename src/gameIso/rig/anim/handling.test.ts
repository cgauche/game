import { describe, it, expect } from 'vitest';
import { handlingClass, isTwoHanded, isRangedHandling, type Handling } from './handling';
import { WEAPON_FORMS } from '../parts/weaponForms';
import type { Weapon } from '../../../engine/types';

const w = (name: string, type: 'melee' | 'ranged' = 'melee'): Weapon =>
  ({ name, type, damage: { plusBF: false, flat: 4 }, qualities: [] } as Weapon);

describe('handlingClass — dérivé de la FORME, pas du Groupe de règles', () => {
  it('mappe un représentant de chaque classe', () => {
    const cases: Array<[string, 'melee' | 'ranged', Handling]> = [
      ['Dague', 'melee', 'lame1m'],
      ['Rapière', 'melee', 'escrime'],
      ['Zweihänder', 'melee', 'lourde2m'],
      ['Hallebarde', 'melee', 'hampe'],
      ['Lance de cavalerie', 'melee', 'lance_cav'],
      ["Fléau d'armes", 'melee', 'fleau'],
      ['Main Gauche', 'melee', 'parade'],
      ['Coup-de-poing', 'melee', 'poings'],
      ['Arc long', 'ranged', 'arc'],
      ['Arbalète', 'ranged', 'arbalete'],
      ['Pistolet', 'ranged', 'arme_feu'],
      ['Fronde', 'ranged', 'fronde'],
      ['Javelot', 'ranged', 'jet'],
      ['Fouet', 'ranged', 'entraves'],
      ['Bombe', 'ranged', 'explosif'],
    ];
    for (const [name, type, expected] of cases) {
      expect(handlingClass(w(name, type)), name).toBe(expected);
    }
  });

  it('la FORME prime sur le Groupe trompeur (bec-de-corbin: Groupe Cavalerie → maniement lame1m)', () => {
    expect(handlingClass(w('Marteau à bec-de-corbin'))).toBe('lame1m');
  });

  it('arme à feu d’ingénierie (Arquebus à répétition) → arme_feu comme la poudre noire', () => {
    expect(handlingClass(w('Arquebus à répétition', 'ranged'))).toBe('arme_feu');
  });

  it('toute forme cataloguée résout vers UNE classe connue (aucune forme orpheline)', () => {
    const KNOWN: Handling[] = ['lame1m', 'escrime', 'lourde2m', 'hampe', 'lance_cav', 'fleau', 'parade', 'poings', 'arc', 'arbalete', 'arme_feu', 'fronde', 'jet', 'entraves', 'explosif'];
    for (const f of WEAPON_FORMS) {
      const h = handlingClass(w(f.label, f.type));
      expect(KNOWN, f.label).toContain(h);
    }
  });

  it('repli : arme non dessinée → groupe canonique (Épée → lame1m, mêlée inconnue → lame1m, distance inconnue → arc)', () => {
    expect(handlingClass(w('Épée'))).toBe('lame1m'); // catalogué Groupe Base, sans forme propre
    expect(handlingClass(w('Truc bizarre', 'melee'))).toBe('lame1m');
    expect(handlingClass(w('Engin inconnu', 'ranged'))).toBe('arc');
  });

  it('sans arme → lame1m (défaut neutre)', () => {
    expect(handlingClass(undefined)).toBe('lame1m');
  });
});

describe('isTwoHanded — la main gauche vient tenir l’arme', () => {
  it('vrai pour lourde2m / hampe / arc / arbalète / arme à feu', () => {
    expect(isTwoHanded(w('Zweihänder'))).toBe(true);
    expect(isTwoHanded(w('Hallebarde'))).toBe(true);
    expect(isTwoHanded(w('Arc long', 'ranged'))).toBe(true);
    expect(isTwoHanded(w('Arbalète', 'ranged'))).toBe(true);
    expect(isTwoHanded(w('Arquebuse', 'ranged'))).toBe(true);
  });
  it('faux pour les armes à une main', () => {
    expect(isTwoHanded(w('Dague'))).toBe(false);
    expect(isTwoHanded(w('Rapière'))).toBe(false);
    expect(isTwoHanded(w('Coup-de-poing'))).toBe(false);
  });
});

describe('isRangedHandling', () => {
  it('classe les familles à distance', () => {
    expect(isRangedHandling(w('Arc long', 'ranged'))).toBe(true);
    expect(isRangedHandling(w('Bombe', 'ranged'))).toBe(true);
    expect(isRangedHandling(w('Fouet', 'ranged'))).toBe(true);
    expect(isRangedHandling(w('Dague'))).toBe(false);
  });
});
