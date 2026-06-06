import { describe, it, expect } from 'vitest';
import { weaponPart, weaponFamily, shieldPart, armourPart, armourMaterial, equipFromCombatant, isShield } from './equipment';
import { pickView } from './types';
import type { Combatant, Weapon, ItemInstance } from '../../../engine/types';

const wep = (name: string, type: 'melee' | 'ranged', q: string[] = []): Weapon =>
  ({ name, type, damage: '+4', qualities: q } as Weapon);
const wpv = (name: string, type: 'melee' | 'ranged' = 'melee') => pickView(weaponPart(wep(name, type)), 'front');
const fam = (name: string, type: 'melee' | 'ranged' = 'melee') => weaponFamily(wep(name, type));

describe('weaponPart', () => {
  it('rend un SVG non vide pour une arme connue', () => {
    expect(wpv('Dague')).toContain('<');
  });
  it('arme inconnue → part générique mêlée non vide', () => {
    expect(wpv('Truc bizarre')).toContain('<');
  });
});

// Contrat « 1 forme par arme » : des armes jadis confondues ont désormais des formes
// (slugs) distincts. Testé au niveau FAMILLE (slug), robuste que l'art soit généré ou non.
describe('weaponFamily — 1 forme par arme (anti-collapse)', () => {
  it('chaque arme jadis confondue a sa propre forme', () => {
    expect(fam('Arc court', 'ranged')).not.toBe(fam('Épée'));
    expect(fam('Javelot', 'ranged')).not.toBe(fam('Lance de cavalerie'));
    expect(fam('Main Gauche')).not.toBe(fam('Brise-épée'));
    expect(fam('Main Gauche')).not.toBe(fam('Dague'));
    expect(fam('Pioche à deux mains')).not.toBe(fam('Grande hache'));
    expect(fam('Fleuret')).not.toBe(fam('Zweihänder'));
  });
});

describe('isShield', () => {
  it('reconnaît un bouclier par qualité ou nom, pas une épée', () => {
    expect(isShield({ name: 'Targe', qualities: ['Bouclier'] })).toBe(true);
    expect(isShield({ name: 'Bouclier', qualities: [] })).toBe(true);
    expect(isShield({ name: 'Épée', qualities: [] })).toBe(false);
  });
});

describe('armourMaterial — corrections audit', () => {
  const mat = (name: string, pa: number) =>
    armourMaterial({ uid: 'x', name, kind: 'armor', qualities: [], pa, locs: ['corps'], enc: 1, equipped: true } as ItemInstance);
  it('« Plastron de cuir » = cuir (cuir prime sur plaque)', () => {
    expect(mat('Plastron de cuir', 2)).toBe('cuir');
  });
  it('« Plastron » (plaque) = plaque', () => {
    expect(mat('Plastron', 5)).toBe('plaque');
  });
  it('« Jambières d’acier » et « Brassards » = plaque', () => {
    expect(mat("Jambières d'acier", 2)).toBe('plaque');
    expect(mat('Brassards', 2)).toBe('plaque');
  });
  it('« Cotte de mailles » = maille', () => {
    expect(mat('Cotte de mailles', 2)).toBe('maille');
  });
});

describe('armourPart', () => {
  const mail: ItemInstance = { uid: '1', name: 'Cotte de mailles', kind: 'armor', qualities: [], pa: 2, locs: ['corps'], enc: 1, equipped: true };
  it('mappe une pièce de corps sur le slot torse', () => {
    expect(pickView(armourPart(mail, 'torse'), 'front')).toContain('<');
  });
  it('ne renvoie rien si la pièce ne couvre pas l’emplacement', () => {
    expect(armourPart(mail, 'jambes')).toBeNull();
  });
});

describe('shieldPart', () => {
  it('renvoie un SVG de bouclier non vide', () => {
    expect(pickView(shieldPart(wep('Bouclier', 'melee', ['Bouclier'])), 'front')).toContain('<');
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
