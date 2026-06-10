import { describe, it, expect } from 'vitest';
import { weaponFromTrait, creatureToCombatant } from './spawn';
import { weaponFamily } from '../gameIso/rig/parts/equipment';
import { findCreature } from '../data';
import { CHAR_KEYS } from '../engine/types';

/** Traits d'arme FR vérifiés dans L'ennemi dans l'Ombre ch.2 (Knud Cratinx & co). */
describe('weaponFromTrait — armement des monstres dans les Traits (FR)', () => {
  it('Arme +7 (sans type) → mêlée générique', () => {
    expect(weaponFromTrait('Arme +7')).toMatchObject({ name: 'Arme', type: 'melee', damage: '+7' });
  });
  it('Arme (Épée) +7 → arme tenue « Épée »', () => {
    const w = weaponFromTrait('Arme (Épée) +7')!;
    expect(w).toMatchObject({ name: 'Épée', type: 'melee', damage: '+7' });
    expect(weaponFamily(w)).toBe('epee'); // le rig tient une épée
  });
  it('Arme (Dague) +4 → dague', () => {
    expect(weaponFamily(weaponFromTrait('Arme (Dague) +4')!)).toBe('dague');
  });
  it('À distance (Arbalète) +9 (60) → arbalète à distance, portée 60', () => {
    const w = weaponFromTrait('À distance (Arbalète) +9 (60)')!;
    expect(w).toMatchObject({ name: 'Arbalète', type: 'ranged', damage: '+9', range: 60 });
    expect(weaponFamily(w)).toBe('arbalete');
  });
  it('À distance +8 (50) (sans type) → distance générique', () => {
    expect(weaponFromTrait('À distance +8 (50)')).toMatchObject({ type: 'ranged', damage: '+8', range: 50 });
  });
  it('Arme (griffes) → attaque NATURELLE, aucune arme dessinée', () => {
    const w = weaponFromTrait('Arme (griffes)')!;
    expect(w.type).toBe('melee');
    expect(weaponFamily(w)).toBe(''); // pas d'arme tenue
  });
  it('Morsure +9 → attaque naturelle (pas d’arme tenue)', () => {
    const w = weaponFromTrait('Morsure +9')!;
    expect(w).toMatchObject({ name: 'Morsure', type: 'melee', damage: '+9' });
    expect(weaponFamily(w)).toBe('');
  });
  it('un trait non-arme → null', () => {
    expect(weaponFromTrait('Corruption (Mineure)')).toBeNull();
    expect(weaponFromTrait('Mutation (Écailles épineuses)')).toBeNull();
  });
  it('« 8 Tentacules +9 » (Pieuvre) → UNE arme naturelle Tentacules +9 (pas d’« Arme +BF »)', () => {
    const w = weaponFromTrait('8 Tentacules +9')!;
    expect(w).toMatchObject({ name: 'Tentacules', type: 'melee', damage: '+9' });
    expect(weaponFamily(w)).toBe(''); // attaque naturelle : rien en main
  });
});

describe('creatureToCombatant — fidélité du profil du bestiaire (LDB 76/78)', () => {
  const at = { x: 0, y: 0 };

  it('« – » du livre = caractéristique INEXISTANTE → 0, pas 30 (Loup : CT –)', () => {
    const c = creatureToCombatant(findCreature('Loup')!, 'e1', at);
    expect(c.characteristics.CT).toBe(0);
  });

  it('Pieuvre des tourbières : arme Tentacules +9 dérivée du trait compté', () => {
    const c = creatureToCombatant(findCreature('Pieuvre des tourbières')!, 'e1', at);
    expect(c.weapons[0]).toMatchObject({ name: 'Tentacules', damage: '+9' });
  });

  it('traits FACULTATIFS (LDB 76) fusionnés : Armure, psychologie ciblée, arme à distance', () => {
    const c = creatureToCombatant(findCreature('Loup')!, 'e1', at, {
      optionals: ['Haine (Sigmarites)', 'À distance +8 (50)'],
    });
    expect(c.traits).toContain('Haine (Sigmarites)');
    expect(c.weapons.some((w) => w.type === 'ranged' && w.damage === '+8')).toBe(true);
    expect(c.psychTraits?.some((p) => p.type === 'haine')).toBe(true);
  });

  it('Taille facultative PRIME et applique « Utiliser les Tailles » (±10 F/E, ∓5 Ag) + PB par formule', () => {
    const wolf = findCreature('Loup')!; // Taille de base : Moyenne (aucun trait), F 35 E 35
    const base = creatureToCombatant(wolf, 'e1', at);
    const big = creatureToCombatant(wolf, 'e1', at, { optionals: ['Taille (Grande)'] });
    expect(big.size).toBe('grande');
    expect(big.characteristics.F).toBe(base.characteristics.F + 10);
    expect(big.characteristics.E).toBe(base.characteristics.E + 10);
    expect(big.characteristics.Ag).toBe(base.characteristics.Ag - 5);
    // Blessures recalculées par la formule de Taille (le B imprimé valait pour la taille de base)
    const bf = Math.floor(big.characteristics.F / 10), be = Math.floor(big.characteristics.E / 10), bfm = Math.floor(big.characteristics.FM / 10);
    expect(big.wounds.max).toBe((bf + 2 * be + bfm) * 2); // Grande = ×2 (LDB 85)
  });

  it('sorts d’auteur posés sur le Combattant (la donnée bestiaire n’en liste pas)', () => {
    const c = creatureToCombatant(findCreature('Mutant')!, 'e1', at, { spells: ['Fléchette'] });
    expect(c.spells).toEqual(['Fléchette']);
  });

  describe('Caractéristiques aléatoires (LDB 78 : « soustrayez -10 et ajoutez 2d10 »)', () => {
    const mutant = findCreature('Mutant')!;
    it('chaque caractéristique tirée reste dans [v−8, v+10] ; déterministe par id ; ids ≠ → profils ≠', () => {
      const a = creatureToCombatant(mutant, 'enemy-0', at, { randomChars: true });
      const b = creatureToCombatant(mutant, 'enemy-0', at, { randomChars: true });
      const c = creatureToCombatant(mutant, 'enemy-1', at, { randomChars: true });
      for (const k of CHAR_KEYS) {
        const v = mutant.char[k];
        if (typeof v !== 'number' || v === 0) continue;
        expect(a.characteristics[k]).toBeGreaterThanOrEqual(v - 8); // −10 + 2×1
        expect(a.characteristics[k]).toBeLessThanOrEqual(v + 10); // −10 + 2×10
      }
      expect(a.characteristics).toEqual(b.characteristics); // graine stable par id (rejouable)
      expect(CHAR_KEYS.some((k) => a.characteristics[k] !== c.characteristics[k])).toBe(true);
    });
    it('« Si une Caractéristique vaut 5, lancez juste 1d10 » (Pieuvre : Int 5) ; « – » reste 0', () => {
      const p = creatureToCombatant(findCreature('Pieuvre des tourbières')!, 'enemy-0', at, { randomChars: true });
      expect(p.characteristics.Int).toBeGreaterThanOrEqual(1);
      expect(p.characteristics.Int).toBeLessThanOrEqual(10);
      expect(p.characteristics.CT).toBe(0); // inexistante : pas tirée
    });
    it('Blessures recalculées par la formule (le B imprimé valait pour le profil rond)', () => {
      const c = creatureToCombatant(mutant, 'enemy-0', at, { randomChars: true });
      const bf = Math.floor(c.characteristics.F / 10), be = Math.floor(c.characteristics.E / 10), bfm = Math.floor(c.characteristics.FM / 10);
      expect(c.wounds.max).toBe(bf + 2 * be + bfm); // Mutant : Taille Moyenne
    });
  });
});
