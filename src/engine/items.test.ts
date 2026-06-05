import { describe, it, expect } from 'vitest';
import { recomputeLoadout, totalEncumbrance, maxEncumbrance, itemFromTrapping } from './items';
import { Combatant, ItemInstance } from './types';

const item = (o: Partial<ItemInstance>): ItemInstance =>
  ({ uid: 'u', name: 'x', kind: 'misc', qualities: [], enc: 0, equipped: false, ...o }) as ItemInstance;

describe('items — recomputeLoadout / encombrement', () => {
  it('recomputeLoadout dérive armes ET armure actives des objets ÉQUIPÉS', () => {
    const c = {
      characteristics: { F: 30, E: 30 },
      items: [
        item({ name: 'Hache', kind: 'melee', damage: '+BF+4', equipped: true }),
        item({ name: 'Plastron', kind: 'armor', pa: 2, locs: ['corps'], equipped: true }),
        item({ name: 'Casque rangé', kind: 'armor', pa: 3, locs: ['tete'], equipped: false }),
      ],
    } as unknown as Combatant;
    recomputeLoadout(c);
    expect(c.weapons.map((w) => w.name)).toContain('Hache');
    expect(c.weapons.map((w) => w.name)).toContain('Mains nues'); // dernier recours toujours présent
    expect(c.armour.corps).toBe(2); // armure équipée appliquée à sa localisation
    expect(c.armour.tete).toBe(0); // l'armure NON équipée ne compte pas
  });
  it("totalEncumbrance somme l'encombrement de tous les objets portés", () => {
    const c = { items: [item({ enc: 2 }), item({ enc: 3 }), item({ enc: 0 })] } as unknown as Combatant;
    expect(totalEncumbrance(c)).toBe(5);
  });
  it("maxEncumbrance = Bonus de Force + Bonus d'Endurance (LDB)", () => {
    expect(maxEncumbrance({ characteristics: { F: 35, E: 42 } } as unknown as Combatant)).toBe(3 + 4);
  });
  it('maxEncumbrance : +2 par niveau de Costaud (LDB talents)', () => {
    const c = { characteristics: { F: 30, E: 30 }, talents: [{ name: 'Costaud', times: 1 }] } as unknown as Combatant;
    expect(maxEncumbrance(c)).toBe(3 + 3 + 2); // BF+BE + Costaud×2
  });
  it('totalEncumbrance : une armure ÉQUIPÉE (portée) compte −1 ; arme tenue et armure rangée non (LDB Enc. l.22)', () => {
    const c = {
      items: [
        item({ name: 'Armure de cuir', kind: 'armor', enc: 1, equipped: true }), // portée → 0
        item({ name: 'Cotte de mailles', kind: 'armor', enc: 2, equipped: true }), // portée → 1
        item({ name: 'Plastron rangé', kind: 'armor', enc: 2, equipped: false }), // rangé → 2
        item({ name: 'Épée', kind: 'melee', enc: 1, equipped: true }), // tenue, non « portée » → 1
      ],
    } as unknown as Combatant;
    expect(totalEncumbrance(c)).toBe(0 + 1 + 2 + 1);
  });
  it('itemFromTrapping : trapping inconnu → null', () => {
    expect(itemFromTrapping('Objet Totalement Imaginaire XYZ')).toBeNull();
  });
});
