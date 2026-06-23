import { describe, it, expect } from 'vitest';
import { recomputeLoadout, emptyArmour } from './items';
import type { Combatant, ItemInstance } from './types';

/**
 * Un poste d'artillerie monte une arme sur un servant via le chemin d'équipement NORMAL : l'`ItemInstance`
 * (base + qualités/enchants par instance) porte un `mountSide`, et `recomputeLoadout` le propage à l'arme
 * active dérivée (`Weapon.mountSide`) — lu ensuite par la validation d'arc de tir. (MDG ch.12-13)
 */
const gunItem: ItemInstance = {
  uid: 'gun1', trappingId: 'pierrier', name: 'Pierrier', kind: 'ranged',
  damage: { plusBF: false, flat: 14 }, range: 30,
  qualities: [{ id: 'dangereuse' }, { id: 'recharge', value: 4 }],
  enc: 5, equipped: true, mountSide: 'tribord',
};

const gunner = (): Combatant =>
  ({
    id: 'cap', name: 'Chef de pièce', kind: 'enemy',
    characteristics: { CC: 30, CT: 40, F: 30, E: 30, I: 30, Ag: 30, Dex: 30, Int: 30, FM: 30, Soc: 30 },
    wounds: { current: 12, max: 12 }, advantage: 0, conditions: [], talents: [], skills: [],
    armour: emptyArmour(), movement: 4, items: [{ ...gunItem }],
  }) as unknown as Combatant;

describe('recomputeLoadout — propage mountSide de l’ItemInstance à l’arme active', () => {
  it('un canon monté à tribord → l’arme à distance active porte mountSide:tribord', () => {
    const c = gunner();
    recomputeLoadout(c);
    const w = c.weapons.find((w) => w.uid === 'gun1');
    expect(w).toBeDefined();
    expect(w?.mountSide).toBe('tribord');
  });

  it('une arme NON montée n’a pas de mountSide (régression : champ optionnel)', () => {
    const c = gunner();
    c.items = [{ ...gunItem, uid: 'gun2', mountSide: undefined }];
    recomputeLoadout(c);
    expect(c.weapons.find((w) => w.uid === 'gun2')?.mountSide).toBeUndefined();
  });
});
