import { describe, it, expect } from 'vitest';
import { weaponFromTrait, renderWeaponsFromTraits, weaponsFromTraits, armourFromTraits } from './creatureEquip';
import type { TraitInstance } from './statEntry';

const t = (o: { id: string; arg?: string; value?: number; range?: number }): TraitInstance => o as TraitInstance;

describe('creatureEquip — dérivation traits → armes (source unique de l’armement ennemi/PNJ)', () => {
  it('trait « Arme (Épée) +7 » → arme de mêlée nommée', () => {
    const w = weaponFromTrait(t({ id: 'arme', arg: 'Épée', value: 7 }));
    expect(w).not.toBeNull();
    expect(w!.name).toBe('Épée');
    expect(w!.type).toBe('melee');
  });

  it('trait « Arme » sans type ni Indice → arme de mêlée générique', () => {
    const w = weaponFromTrait(t({ id: 'arme' }));
    expect(w?.name).toBe('Arme');
    expect(w?.type).toBe('melee');
  });

  it('trait « À distance (Arbalète) +9 (60) » → arme à distance nommée', () => {
    const w = weaponFromTrait(t({ id: 'a-distance', arg: 'Arbalète', value: 9, range: 60 }));
    expect(w?.name).toBe('Arbalète');
    expect(w?.type).toBe('ranged');
  });

  it('trait « À distance » SANS Indice de Dégâts → pas une arme jouable (RAW) → null', () => {
    expect(weaponFromTrait(t({ id: 'a-distance' }))).toBeNull();
  });

  it('trait non-armement (ex. Vol) → null', () => {
    expect(weaponFromTrait(t({ id: 'vol' }))).toBeNull();
  });

  it('renderWeaponsFromTraits : AUCUNE arme de repli (un PNJ sans trait d’arme reste mains libres)', () => {
    expect(renderWeaponsFromTraits([])).toHaveLength(0);
    expect(renderWeaponsFromTraits([t({ id: 'arme', arg: 'Hache', value: 6 })])).toHaveLength(1);
  });

  it('weaponsFromTraits : GARANTIT au moins une arme (pour pouvoir toujours frapper)', () => {
    const fallback = weaponsFromTraits([]);
    expect(fallback).toHaveLength(1);
    expect(fallback[0].name).toBe('Arme');
    // avec un trait d'arme explicite, pas de repli ajouté
    expect(weaponsFromTraits([t({ id: 'arme', arg: 'Hache', value: 6 })])).toHaveLength(1);
  });
});

describe('creatureEquip — armourFromTraits (lookup par id stable)', () => {
  it('trait « armure » (id stable) value 2 → PA 2 sur toutes les localisations', () => {
    const ap = armourFromTraits([t({ id: 'armure', value: 2 })]);
    expect(ap).toEqual({ tete: 2, brasG: 2, brasD: 2, corps: 2, jambeG: 2, jambeD: 2 });
  });

  it('aucun trait armure → PA 0 partout', () => {
    const ap = armourFromTraits([t({ id: 'vol', value: 6 })]);
    expect(ap).toEqual({ tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 });
  });
});
