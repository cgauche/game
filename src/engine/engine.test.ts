import { describe, it, expect } from 'vitest';
import { makeRNG } from './dice';
import { evaluateTest, resolveOpposed, rollTest } from './tests';
import { bonus, maxWounds } from './characteristics';
import { reverseRoll, hitLocation, parseWeaponDamage, resolveMelee } from './combat';
import { createHero } from './character';
import type { Characteristics, Combatant, Weapon } from './types';

describe('Tests & DR', () => {
  it('réussite si jet ≤ cible, DR = différence des dizaines', () => {
    // cible 45, jet 23 → succès, DR = 4 - 2 = 2
    const r = evaluateTest(23, 45);
    expect(r.success).toBe(true);
    expect(r.sl).toBe(2);
  });
  it('échec donne un DR négatif', () => {
    const r = evaluateTest(67, 45); // dizaines 4 - 6 = -2
    expect(r.success).toBe(false);
    expect(r.sl).toBe(-2);
  });
  it('détecte les doubles', () => {
    expect(evaluateTest(33, 50).isDouble).toBe(true);
    expect(evaluateTest(34, 50).isDouble).toBe(false);
    expect(evaluateTest(100, 50).isDouble).toBe(true);
  });
});

describe('Bonus & Blessures', () => {
  it('bonus = chiffre des dizaines', () => {
    expect(bonus(37)).toBe(3);
    expect(bonus(40)).toBe(4);
  });
  it('Blessures = BF + 2×BE + BFM', () => {
    const chars = { F: 35, E: 40, FM: 30 } as Characteristics;
    expect(maxWounds(chars)).toBe(3 + 2 * 4 + 3); // 14
  });
  it('Halfling (Petit) = 2×BE + BFM', () => {
    const chars = { F: 30, E: 40, FM: 30 } as Characteristics;
    expect(maxWounds(chars, true)).toBe(2 * 4 + 3); // 11
  });
});

describe('Localisation', () => {
  it('inverse le jet du toucher', () => {
    expect(reverseRoll(23)).toBe(32);
    expect(reverseRoll(5)).toBe(50);
    expect(reverseRoll(100)).toBe(100);
  });
  it('mappe sur le Tableau de Localisation', () => {
    expect(hitLocation(5)).toBe('tete'); // 01-09
    expect(hitLocation(32)).toBe('brasD'); // 25-44
    expect(hitLocation(60)).toBe('corps'); // 45-79
    expect(hitLocation(95)).toBe('jambeD'); // 90-00
  });
});

describe('Dégâts d’arme', () => {
  it('+BF+4 avec BF=3 → 7', () => {
    expect(parseWeaponDamage('+BF+4', 3)).toBe(7);
  });
  it('+9 (distance) ignore BF', () => {
    expect(parseWeaponDamage('+9', 3)).toBe(9);
  });
});

function dummy(name: string, chars: Partial<Characteristics>, wounds: number, weapon: Weapon): Combatant {
  const base: Characteristics = { CC: 30, CT: 30, F: 30, E: 30, I: 30, Ag: 30, Dex: 30, Int: 30, FM: 30, Soc: 30 };
  return {
    id: name,
    name,
    kind: 'enemy',
    characteristics: { ...base, ...chars },
    wounds: { current: wounds, max: wounds },
    advantage: 0,
    conditions: [],
    weapons: [weapon],
    armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
    skills: [],
    talents: [],
    movement: 4,
  };
}

describe('Résolution de mêlée', () => {
  it('produit un résultat cohérent et déterministe avec une graine', () => {
    const rng = makeRNG(42);
    const sword: Weapon = { name: 'Épée', type: 'melee', damage: '+BF+4', qualities: [] };
    const a = dummy('Attaquant', { CC: 60, F: 40 }, 15, sword);
    const d = dummy('Défenseur', { CC: 25, E: 30 }, 12, sword);
    const res = resolveMelee(a, d, sword, rng);
    expect(typeof res.hit).toBe('boolean');
    if (res.hit) {
      expect(res.woundsLost).toBeGreaterThanOrEqual(1);
      expect(res.location).toBeDefined();
    }
  });
});

describe('Création de héros', () => {
  it('génère un personnage jouable et reproductible', () => {
    const hero = createHero({
      speciesLabel: 'Humains (Reiklander)',
      careerLabel: 'Agitateur',
      name: 'Test',
      rng: makeRNG(7),
    });
    expect(hero.kind).toBe('hero');
    expect(hero.skills.length).toBeGreaterThan(0);
    expect(hero.wounds.max).toBeGreaterThan(0);
    expect(hero.movement).toBe(4);
    // 40 augmentations réparties par défaut (+5 × 8)
    const totalAdv = hero.skills.reduce((s, sk) => s + sk.advances, 0);
    expect(totalAdv).toBe(40);
  });
});
