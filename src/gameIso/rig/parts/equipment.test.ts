import { describe, it, expect } from 'vitest';
import { weaponPart, shieldPart, armourPart, equipFromCombatant } from './equipment';
import type { Combatant, Weapon, ItemInstance } from '../../../engine/types';

const wep = (name: string, type: 'melee' | 'ranged', q: string[] = []): Weapon =>
  ({ name, type, damage: '+4', qualities: q } as Weapon);

describe('weaponPart', () => {
  it('reconnaît une épée vs un arc (SVG différents)', () => {
    expect(weaponPart(wep('Épée', 'melee')).svg).not.toBe(weaponPart(wep('Arc court', 'ranged')).svg);
  });
  it('arme inconnue → part générique mêlée non vide', () => {
    expect(weaponPart(wep('Truc bizarre', 'melee')).svg).toContain('<');
  });
});

describe('armourPart', () => {
  const mail: ItemInstance = { uid: '1', name: 'Cotte de mailles', kind: 'armor', qualities: [], pa: 2, locs: ['corps'], enc: 1, equipped: true };
  it('mappe une pièce de corps sur le slot torse', () => {
    expect(armourPart(mail, 'torse')?.svg).toContain('<');
  });
  it('ne renvoie rien si la pièce ne couvre pas l’emplacement', () => {
    expect(armourPart(mail, 'jambes')).toBeNull();
  });
});

describe('shieldPart', () => {
  it('renvoie un SVG de bouclier non vide', () => {
    expect(shieldPart(wep('Bouclier', 'melee', ['Bouclier'])).svg).toContain('<');
  });
});

describe('equipFromCombatant', () => {
  it('extrait armes actives + pièces d’armure équipées + bouclier', () => {
    const c = {
      weapons: [wep('Épée', 'melee'), wep('Bouclier', 'melee', ['Bouclier'])],
      items: [
        { uid: 'a', name: 'Plastron', kind: 'armor', qualities: [], pa: 1, locs: ['corps'], enc: 1, equipped: true } as ItemInstance,
        { uid: 'b', name: 'Heaume', kind: 'armor', qualities: [], pa: 1, locs: ['tete'], enc: 0, equipped: false } as ItemInstance,
      ],
    } as unknown as Combatant;
    const e = equipFromCombatant(c);
    expect(e.armour.map((i) => i.name)).toEqual(['Plastron']); // 'Heaume' non équipé exclu
    expect(e.shield).toBeTruthy();
    expect(e.weapons.length).toBe(2);
  });
});
