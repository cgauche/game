import { describe, it, expect } from 'vitest';
import { applyOps } from './ops';
import { endOfRound } from './conditions';
import { effectiveWeaponDamage, enchantOnHitConditions } from './weaponDamage';
import { bonus } from './characteristics';
import type { Combatant } from './types';

/**
 * Armes INVOQUÉES (op `conjureWeapon`, LDB 47/48) : Arme aethyrique (Dégâts = BFM), Faux de Shyish
 * (Arme d'hast, BFM+3), Épée ardente de Rhuin (Dégâts +6, Percutante, En flammes). L'arme passe en
 * tête de `c.weapons` tant que le Sort dure puis disparaît à l'expiration (loadout recomposé).
 */
const mage = (p: Partial<Combatant> = {}): Combatant =>
  ({
    id: 'mage', name: 'Magister', kind: 'hero',
    characteristics: { CC: 40, CT: 30, F: 30, E: 30, I: 35, Ag: 40, Dex: 45, Int: 40, FM: 45, Soc: 30 },
    wounds: { current: 12, max: 12 }, advantage: 0, conditions: [], skills: [], talents: [],
    weapons: [], items: [], armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
    ...p,
  } as Combatant);

describe('conjureWeapon — Arme aethyrique (Dégâts = BFM, Magique)', () => {
  it('place l’arme invoquée en tête de c.weapons, Dégâts FIXES = BFM (sans Bonus de Force)', () => {
    const c = mage(); // FM 45 → BFM 4
    applyOps(c, [{ op: 'conjureWeapon', name: 'Arme aethyrique', damage: { bonusOf: 'FM' }, qualities: ['Magique'] }],
      { label: 'Arme aethyrique', defaultDurationRounds: 4 });
    expect(c.weapons[0].name).toBe('Arme aethyrique');
    expect(c.weapons[0].qualities).toContain('Magique');
    expect(c.weapons[0].damage).toBe('+4'); // BFM, pas de +BF
    expect(effectiveWeaponDamage(c.weapons[0], bonus(c.characteristics.F))).toBe(4); // Dégâts = BFM seul
  });

  it('disparaît de c.weapons à l’expiration du Sort (loadout recomposé)', () => {
    const c = mage();
    applyOps(c, [{ op: 'conjureWeapon', name: 'Arme aethyrique', damage: { bonusOf: 'FM' }, qualities: ['Magique'] }],
      { label: 'Arme aethyrique', defaultDurationRounds: 1 });
    expect(c.weapons.some((w) => w.name === 'Arme aethyrique')).toBe(true);
    endOfRound(c); // 1 Round → l'effet expire
    expect(c.weapons.some((w) => w.name === 'Arme aethyrique')).toBe(false);
    expect(c.activeEffects?.some((e) => e.conjuredWeapon)).toBeFalsy();
  });
});

describe('conjureWeapon — variantes de domaine', () => {
  it('Faux de Shyish : Arme d’hast à 2 mains, Dégâts = BFM+3', () => {
    const c = mage(); // BFM 4
    applyOps(c, [{ op: 'conjureWeapon', name: 'Faux de Shyish', damage: { bonusOf: 'FM' }, damagePlus: 3, subType: 'Arme d’hast', hands: 2, qualities: ['Magique'] }],
      { label: 'La Faux de Shyish', defaultDurationRounds: 4 });
    expect(c.weapons[0].name).toBe('Faux de Shyish');
    expect(c.weapons[0].hands).toBe(2);
    expect(c.weapons[0].subType).toBe('Arme d’hast');
    expect(c.weapons[0].damage).toBe('+7'); // BFM 4 + 3
  });

  it('Épée ardente de Rhuin : Dégâts +6 fixes, Percutante + En flammes à la touche', () => {
    const c = mage();
    applyOps(c, [{ op: 'conjureWeapon', name: 'Épée ardente de Rhuin', damage: 6, subType: 'Épée', qualities: ['Magique', 'Percutante'], onHitConditions: [{ name: 'En flammes' }] }],
      { label: "L'Épée ardente de Rhuin", defaultDurationRounds: 4 });
    expect(c.weapons[0].damage).toBe('+6');
    expect(c.weapons[0].qualities).toEqual(expect.arrayContaining(['Magique', 'Percutante']));
    // l'État « à la touche » est porté par l'enchantement compagnon, gaté sur l'arme invoquée.
    expect(enchantOnHitConditions(c, c.weapons[0]).some((x) => x.name === 'En flammes')).toBe(true);
  });
});
