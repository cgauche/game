import { describe, it, expect } from 'vitest';
import type { ItemInstance, Weapon } from '../engine/types';
import { weaponStatParts } from './weaponStats';

const item = (o: Partial<ItemInstance>): ItemInstance =>
  ({ uid: 'u', name: 'x', kind: 'melee', qualities: [], enc: 0, equipped: false, ...o }) as ItemInstance;

describe('weaponStatParts (composeur partagé des stats d’arme)', () => {
  it('mêlée : « Dégâts +BF+4 (7) · Allonge Longue » (BF=3 injecté, jamais [object Object])', () => {
    const parts = weaponStatParts(item({ damage: { plusBF: true, flat: 4 }, reach: 'Longue' }), 3);
    expect(parts).toEqual(['Dégâts +BF+4 (7)', 'Allonge Longue']);
    expect(parts.join(' · ')).not.toContain('[object Object]');
  });

  it('distance : Portée en mètres, pas d’Allonge (range prime)', () => {
    const parts = weaponStatParts(item({ kind: 'ranged', damage: { plusBF: true, flat: 3 }, range: 50 }), 4);
    expect(parts).toEqual(['Dégâts +BF+3 (7)', 'Portée 50 m']);
  });

  it('Dégâts plats sans BF (« +9 ») : total = la valeur fixe', () => {
    expect(weaponStatParts(item({ damage: { plusBF: false, flat: 9 } }), 5)).toEqual(['Dégâts +9 (9)']);
  });

  it('Dégâts littéraux (« Spécial ») : total 0, jamais [object Object]', () => {
    const parts = weaponStatParts(item({ damage: { literal: 'Spécial' }, reach: 'Moyenne' }), 3);
    expect(parts).toEqual(['Dégâts Spécial (0)', 'Allonge Moyenne']);
  });

  it('sans Dégâts : seule l’Allonge sort', () => {
    expect(weaponStatParts(item({ damage: undefined, reach: 'Courte' }), 3)).toEqual(['Allonge Courte']);
  });

  it('accepte un Weapon dérivé (armes EN MAIN)', () => {
    const w: Weapon = { name: 'Épée', type: 'melee', damage: { plusBF: true, flat: 4 }, reach: 'Moyenne', qualities: [] };
    expect(weaponStatParts(w, 3)).toEqual(['Dégâts +BF+4 (7)', 'Allonge Moyenne']);
  });
});
