import { describe, it, expect } from 'vitest';
import { weaponFromTrait } from './spawn';
import { weaponFamily } from '../gameIso/rig/parts/equipment';

/** Traits d'arme FR vérifiés dans L'ennemi dans l'Ombre ch.2 (Knud Cratinx & co). */
describe('weaponFromTrait — armement des monstres dans les Traits (FR)', () => {
  it('Arme +7 (sans type) → mêlée générique', () => {
    expect(weaponFromTrait('Arme +7')).toMatchObject({ name: 'Arme', type: 'melee', damage: '+7' });
  });
  it('Arme (Épée) +7 → arme tenue « Épée »', () => {
    const w = weaponFromTrait('Arme (Épée) +7')!;
    expect(w).toMatchObject({ name: 'Épée', type: 'melee', damage: '+7' });
    expect(weaponFamily(w)).toBe('epee'); // le rig tient une épée
  });
  it('Arme (Dague) +4 → dague', () => {
    expect(weaponFamily(weaponFromTrait('Arme (Dague) +4')!)).toBe('dague');
  });
  it('À distance (Arbalète) +9 (60) → arbalète à distance, portée 60', () => {
    const w = weaponFromTrait('À distance (Arbalète) +9 (60)')!;
    expect(w).toMatchObject({ name: 'Arbalète', type: 'ranged', damage: '+9', range: 60 });
    expect(weaponFamily(w)).toBe('arbalete');
  });
  it('À distance +8 (50) (sans type) → distance générique', () => {
    expect(weaponFromTrait('À distance +8 (50)')).toMatchObject({ type: 'ranged', damage: '+8', range: 50 });
  });
  it('Arme (griffes) → attaque NATURELLE, aucune arme dessinée', () => {
    const w = weaponFromTrait('Arme (griffes)')!;
    expect(w.type).toBe('melee');
    expect(weaponFamily(w)).toBe(''); // pas d'arme tenue
  });
  it('Morsure +9 → attaque naturelle (pas d’arme tenue)', () => {
    const w = weaponFromTrait('Morsure +9')!;
    expect(w).toMatchObject({ name: 'Morsure', type: 'melee', damage: '+9' });
    expect(weaponFamily(w)).toBe('');
  });
  it('un trait non-arme → null', () => {
    expect(weaponFromTrait('Corruption (Mineure)')).toBeNull();
    expect(weaponFromTrait('Mutation (Écailles épineuses)')).toBeNull();
  });
});
