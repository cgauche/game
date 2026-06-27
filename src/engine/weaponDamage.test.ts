import { describe, it, expect } from 'vitest';
import { effectiveWeaponDamage, effectiveRange, isImprovised, damageWeapon, destroyWeapon, effectiveWeapon, solideSaveThreshold } from './weaponDamage';
import { recomputeLoadout, damageString } from './items';
import type { Weapon, Combatant } from './types';

const sword = (over: Partial<Weapon> = {}): Weapon => ({ name: 'Épée', type: 'melee', damage: { plusBF: true, flat: 4 }, qualities: [], ...over });
const bow = (over: Partial<Weapon> = {}): Weapon => ({ name: 'Arc', type: 'ranged', damage: { plusBF: false, flat: 9 }, qualities: [], range: 30, ...over });

describe('effectiveWeaponDamage (LDB 62 l.178)', () => {
  it('réduit les Dégâts de damageTaken', () => {
    expect(effectiveWeaponDamage(sword({ damageTaken: 2 }), 3)).toBe(5); // BF3 + (4-2)
    expect(effectiveWeaponDamage(bow({ damageTaken: 3 }), 3)).toBe(6);   // 9-3, pas de BF
  });
  it('plancher +0 (BF+0) → improvisée, ne descend pas sous BF', () => {
    expect(effectiveWeaponDamage(sword({ damageTaken: 9 }), 3)).toBe(3); // BF+0
    expect(isImprovised(sword({ damageTaken: 4 }))).toBe(true);
    expect(isImprovised(sword({ damageTaken: 3 }))).toBe(false);
    expect(isImprovised(bow({ damageTaken: 9 }))).toBe(true);
  });
  it("préserve une arme non endommagée (mains nues +BF-2 inchangées)", () => {
    const fists: Weapon = { name: 'Mains nues', type: 'melee', damage: { plusBF: true, flat: -2 }, qualities: [] };
    expect(effectiveWeaponDamage(fists, 3)).toBe(1); // 3 - 2
  });
});

describe('effectiveRange (LDB 62) — résolution de la Portée à l’usage (miroir effectiveWeaponDamage)', () => {
  it('mètres fixes (number) → inchangés ; {bf} → BF×N ; null/undefined → null', () => {
    expect(effectiveRange(50, 4)).toBe(50); // arc : 50 m quel que soit le BF
    expect(effectiveRange({ bf: 3 }, 4)).toBe(12); // javelot : BF4 × 3
    expect(effectiveRange({ bf: 1 }, 5)).toBe(5);  // bombe : BF×1
    expect(effectiveRange(null, 4)).toBeNull();
    expect(effectiveRange(undefined, 4)).toBeNull();
  });
  it('DYNAMIQUE : un BF plus haut allonge la Portée de jet (≠ mètres fixes)', () => {
    expect(effectiveRange({ bf: 3 }, 2)).toBe(6);
    expect(effectiveRange({ bf: 3 }, 5)).toBe(15);
    expect(effectiveRange(30, 2)).toBe(30); // fixe : insensible au BF
  });
});

describe('recomputeLoadout — Portée = SPEC COPIÉE (résolue à l’usage, pas au loadout)', () => {
  it('une arme de jet conserve sa spec {bf} sur le Weapon actif (non pré-résolue)', () => {
    const c = hero([{ uid: 'jav', name: 'Javelot', kind: 'ranged', damage: { plusBF: true, flat: 0, bare: true }, qualities: [], enc: 1, equipped: true, range: { bf: 3 } }]);
    recomputeLoadout(c);
    const jav = c.weapons.find((w) => w.name === 'Javelot');
    expect(jav?.range).toEqual({ bf: 3 }); // copiée telle quelle ; effectiveRange la résout au tir/affichage
  });
});

describe('effectiveWeapon — bascule Arme improvisée à +0 (LDB 62 l.178)', () => {
  it('arme usée à +0 → +BF+1, Inoffensive, sans Atout (Empaleuse/Perforante perdus)', () => {
    const w = effectiveWeapon(sword({ damageTaken: 4, qualities: [{ id: 'empaleuse' }, { id: 'perforante' }] }));
    expect(damageString(w.damage)).toBe('+BF+1');
    expect(w.qualities).toEqual([{ id: 'inoffensive' }]);
    expect(effectiveWeaponDamage(w, 3)).toBe(4); // BF3 + 1
  });
  it('arme non usée renvoyée telle quelle (même référence)', () => {
    const w = sword({ damageTaken: 2, qualities: [{ id: 'empaleuse' }] });
    expect(effectiveWeapon(w)).toBe(w);
  });
});

describe('Solide (Indice) — absorption des Dégâts d’arme + sauvegarde (LDB 60 l.64-67)', () => {
  it('Solide(N) absorbe les N premiers points de damageTaken (pas de pénalité)', () => {
    expect(effectiveWeaponDamage(sword({ damageTaken: 3, qualities: [{ id: 'solide', value: 3 }] }), 3)).toBe(7); // BF3+4 (3 absorbés)
    expect(effectiveWeaponDamage(sword({ damageTaken: 4, qualities: [{ id: 'solide', value: 3 }] }), 3)).toBe(6); // BF3 + (4 - max(0,4-3))
    expect(isImprovised(sword({ damageTaken: 4, qualities: [{ id: 'solide', value: 3 }] }))).toBe(false);
    expect(isImprovised(sword({ damageTaken: 7, qualities: [{ id: 'solide', value: 3 }] }))).toBe(true);
  });
  it('seuil de sauvegarde : 9+ (Solide 1), 8+ (Solide 2), null sans Solide', () => {
    expect(solideSaveThreshold(sword({ qualities: [{ id: 'solide', value: 1 }] }))).toBe(9);
    expect(solideSaveThreshold(sword({ qualities: [{ id: 'solide', value: 2 }] }))).toBe(8);
    expect(solideSaveThreshold(sword({ qualities: [{ id: 'solide', value: 4 }] }))).toBe(6);
    expect(solideSaveThreshold(sword())).toBeNull();
  });
});

describe('damageWeapon / destroyWeapon', () => {
  it('incrémente damageTaken', () => { const w = sword(); damageWeapon(w); expect(w.damageTaken).toBe(1); });
  it('Incassable exempte des dégâts ET de la destruction', () => {
    const w = sword({ qualities: [{ id: 'incassable' }] });
    damageWeapon(w); expect(w.damageTaken ?? 0).toBe(0);
    destroyWeapon(w); expect(w.destroyed).toBeFalsy();
  });
  it('destroyWeapon marque détruite', () => { const w = bow(); destroyWeapon(w); expect(w.destroyed).toBe(true); });
});

function hero(items: Combatant['items']): Combatant {
  return {
    id: 'h', name: 'T', kind: 'hero',
    characteristics: { CC: 40, CT: 40, F: 40, E: 40, I: 40, Ag: 40, Dex: 40, Int: 40, FM: 40, Soc: 40 },
    wounds: { current: 12, max: 12 }, advantage: 0, conditions: [],
    weapons: [], armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
    skills: [], talents: [], movement: 4, items,
  } as Combatant;
}

describe("recomputeLoadout — propagation des Dégâts d'arme", () => {
  it("propage damageTaken de l'ItemInstance vers le Weapon actif", () => {
    const c = hero([{ uid: 'w1', name: 'Épée', kind: 'melee', damage: { plusBF: true, flat: 4 }, qualities: [], enc: 1, equipped: true, damageTaken: 2 }]);
    recomputeLoadout(c);
    const s = c.weapons.find((w) => w.name === 'Épée');
    expect(s?.damageTaken).toBe(2);
  });
  it("une arme détruite n'est pas équipée (repli mains nues)", () => {
    const c = hero([{ uid: 'w1', name: 'Épée', kind: 'melee', damage: { plusBF: true, flat: 4 }, qualities: [], enc: 1, equipped: true, destroyed: true }]);
    recomputeLoadout(c);
    expect(c.weapons.some((w) => w.name === 'Épée')).toBe(false);
    expect(c.weapons.some((w) => w.name === 'Mains nues')).toBe(true);
  });
});
