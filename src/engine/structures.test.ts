import { describe, it, expect } from 'vitest';
import { findStructureById } from '../data';
import { woundsFromHit } from './woundsCalc';
import { isStructure, isEngin, structureImmune, siegeMultiplier, structureCombatant, ramVsNonDoor } from './structures';
import { improvisedProfile } from './weaponDamage';
import type { Weapon, Combatant } from './types';

/**
 * Structures destructibles de siège — modèle de Dégâts (ADE II ch.08). Tests DÉTERMINISTES via
 * `woundsFromHit` (point d'injection unique) : `totalDamage` est l'entrant déjà calculé par l'appelant,
 * donc on contrôle exactement la valeur et on vérifie le Bonus d'Endurance (BE×10 ⇒ bonus = BE), Siège ×2,
 * et les immunités Résistant/Impénétrable/Bélier. RAW : structures sans PA ⇒ `effectiveArmour` = 0.
 * NB : aucun « easeDifficulty » modélisé — ADE II ch.08 ne facilite PAS le Test de toucher d'une structure.
 */
const mkWeapon = (over: Partial<Weapon> = {}): Weapon => ({
  name: 'arme',
  type: 'melee',
  damage: { plusBF: false, flat: 0 },
  qualities: [],
  ...over,
});

const epee = mkWeapon({ name: 'Épée', type: 'melee' });
const hache = mkWeapon({ name: 'Hache', type: 'melee' });
const fleche = mkWeapon({ name: 'Flèche', type: 'ranged' });
const canon = mkWeapon({ name: 'Canon', type: 'ranged', qualities: [{ id: 'siege' }] }); // Atout Siège (ADE II 08 l.292)
const belier = mkWeapon({ name: 'Bélier', type: 'melee', qualities: [{ id: 'siege' }, { id: 'belier' }] }); // Siège + portes uniquement (l.249)

const struct = (id: string): Combatant => structureCombatant(findStructureById(id)!);
const creature = { bodyShape: 'humanoide' } as Combatant; // cible NON-structure (référence)

describe('structureCombatant (Combatant à PV calqué sur la coque)', () => {
  it('bâtit une Porte ADE II : BE 2 → E 20, Bl 8, inerte', () => {
    const c = struct('porte');
    expect(c.id).toBe('structure-porte');
    expect(c.name).toBe('Porte');
    expect(c.bodyShape).toBe('structure');
    expect(c.characteristics.endurance).toBe(20); // BE 2 × 10 ⇒ bonus(E) = 2
    expect(c.wounds).toEqual({ current: 8, max: 8, base: 8 });
    expect(c.psychImmune).toBe(true);
    expect(c.movement).toBe(0);
    expect(c.creatureId).toBe('porte');
  });

  it('Mur en pierre : BE 12 → E 120, Bl 40, Atout Impénétrable', () => {
    const c = struct('mur-en-pierre');
    expect(c.characteristics.endurance).toBe(120);
    expect(c.wounds.max).toBe(40);
    expect(c.traits).toEqual([{ id: 'impenetrable-structure' }]);
  });
});

describe('woundsFromHit — structures (ADE II ch.08)', () => {
  it('Épée (mêlée) vs Porte (Résistant) : SUBIT — total − Bonus d\'Endurance, plancher 0', () => {
    // Porte BE 2 ; 10 Dégâts entrants − 2 = 8.
    expect(woundsFromHit(epee, struct('porte'), 'corps', 10)).toBe(8);
  });

  it('Mur en pierre vs Flèche → 0 (Impénétrable : imparable par toute arme sans Siège)', () => {
    expect(woundsFromHit(fleche, struct('mur-en-pierre'), 'corps', 30)).toBe(0);
  });

  it('Mur en bois vs Flèche → 0 (Résistant : imparable à distance sans Siège)…', () => {
    expect(woundsFromHit(fleche, struct('mur-en-bois'), 'corps', 30)).toBe(0);
  });

  it('…MAIS Mur en bois vs Hache (corps à corps) → SUBIT (Résistant ne bloque que la distance)', () => {
    // Mur en bois BE 6 ; 30 − 6 = 24.
    expect(woundsFromHit(hache, struct('mur-en-bois'), 'corps', 30)).toBe(24);
  });

  it('Canon (Siège) vs Mur en pierre → ×2 (double les Dégâts AVANT le Bonus d\'Endurance)', () => {
    // 2 × 20 = 40 ; Mur en pierre BE 12 ⇒ 40 − 12 = 28.
    expect(woundsFromHit(canon, struct('mur-en-pierre'), 'corps', 20)).toBe(28);
  });

  it('Bélier vs Porte → ×2 (la porte est sa cible légitime + Atout Siège)', () => {
    // 2 × 10 = 20 ; Porte BE 2 ⇒ 20 − 2 = 18.
    expect(woundsFromHit(belier, struct('porte'), 'corps', 10)).toBe(18);
  });

  it('Bélier hors-porte = Arme improvisée : endommage un Mur, plus de Siège (ADE II ch.08 l.249)', () => {
    // Hors-porte, le funnel transforme le Bélier en improvisée (cf. effectiveWeapon/weaponContextOf) ; c'est
    // CE profil qui atteint woundsFromHit — ni immune (≠ 0) ni doublé par Siège.
    expect(woundsFromHit(improvisedProfile(belier), struct('mur-en-bois'), 'corps', 8)).toBe(2); // 8 − BE 6, sans ×2
    expect(structureImmune(improvisedProfile(belier), struct('mur-en-bois'))).toBe(false); // mêlée passe le Résistant
    expect(structureImmune(improvisedProfile(belier), struct('mur-en-pierre'))).toBe(true); // improvisée sans Siège vs Impénétrable
  });

  it('Bl → 0 : un coup trop faible ne raye PAS la structure (plancher 0, pas 1 comme un personnage)', () => {
    // Hache (mêlée, non immune) vs Mur en bois BE 6 ; 4 − 6 = −2 → plancher 0 (un personnage aurait 1).
    expect(woundsFromHit(hache, struct('mur-en-bois'), 'corps', 4)).toBe(0);
  });
});

describe('structureImmune (unitaire)', () => {
  it('Résistant : flèche (distance) imparable, hache (mêlée) passe', () => {
    expect(structureImmune(fleche, struct('mur-en-bois'))).toBe(true);
    expect(structureImmune(hache, struct('mur-en-bois'))).toBe(false);
    expect(structureImmune(epee, struct('porte'))).toBe(false);
  });

  it('Impénétrable : toute arme sans Siège est imparable (même la mêlée)', () => {
    expect(structureImmune(fleche, struct('mur-en-pierre'))).toBe(true);
    expect(structureImmune(hache, struct('mur-en-pierre'))).toBe(true);
    expect(structureImmune(canon, struct('mur-en-pierre'))).toBe(false); // Siège outrepasse
  });

  it('Bélier hors-porte n\'est PAS une immunité — c\'est une Arme improvisée (ADE II ch.08 l.249)', () => {
    expect(ramVsNonDoor(belier, struct('mur-en-bois'))).toBe(true);
    expect(ramVsNonDoor(belier, struct('mur-en-pierre'))).toBe(true);
    expect(ramVsNonDoor(belier, struct('porte'))).toBe(false); // porte = cible légitime
    expect(ramVsNonDoor(belier, struct('porte-de-ville'))).toBe(false);
    expect(ramVsNonDoor(hache, struct('mur-en-bois'))).toBe(false); // pas un Bélier
    // structureImmune ne traite plus le Bélier : une fois transformé en improvisée, seules Impénétrable/Résistant jouent.
    expect(structureImmune(improvisedProfile(belier), struct('mur-en-pierre'))).toBe(true); // improvisée sans Siège vs Impénétrable
    expect(structureImmune(improvisedProfile(belier), struct('mur-en-bois'))).toBe(false); // mêlée passe le Résistant
  });
});

describe('siegeMultiplier (unitaire)', () => {
  it('×2 pour une arme à Atout Siège ; le Bélier hors-porte (devenu improvisé) ne double plus', () => {
    expect(siegeMultiplier(canon, struct('mur-en-pierre'))).toBe(2);
    expect(siegeMultiplier(belier, struct('porte'))).toBe(2); // porte = cible légitime (Bélier + Siège)
    expect(siegeMultiplier(improvisedProfile(belier), struct('mur-en-pierre'))).toBe(1); // hors-porte : improvisé, plus de Siège
    expect(siegeMultiplier(epee, struct('porte'))).toBe(1); // pas de Siège
    expect(siegeMultiplier(canon, creature)).toBe(1); // cible non-structure
  });
});

describe('isStructure', () => {
  it('vrai pour une structure, faux pour une créature', () => {
    expect(isStructure(struct('porte'))).toBe(true);
    expect(isStructure(creature)).toBe(false);
  });
});

describe('isEngin', () => {
  it('vrai pour un emplacement de siège (engin), faux pour mur/porte et créature', () => {
    expect(isEngin({ bodyShape: 'engin' })).toBe(true);
    expect(isEngin(struct('porte'))).toBe(false); // structure = mur/porte, PAS un affût
    expect(isEngin(creature)).toBe(false);
  });
});
