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
  it('itemFromTrapping : trapping inconnu → null', () => {
    expect(itemFromTrapping('Objet Totalement Imaginaire XYZ')).toBeNull();
  });
});
