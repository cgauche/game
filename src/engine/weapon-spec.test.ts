import { describe, it, expect } from 'vitest';
import { combatValue, defenseValue } from './combat';
import { weaponGroupIdByLabel } from '../data';
import type { Combatant, Weapon } from './types';

/**
 * Jalon ② — la Spécialisation de Corps à corps / Projectiles compte enfin.
 * RAW : Compétences Groupées (LDB 09 l.141/409) ; les Augmentations ne valent QUE pour la
 * Spécialisation correspondant au Groupe de l'arme tenue (exemple Sigrid, LDB 09 l.44).
 */
function hero(over: Partial<Combatant> = {}): Combatant {
  return {
    id: 'h', name: 'H', kind: 'hero',
    characteristics: { CC: 40, CT: 40, F: 40, E: 40, I: 40, Ag: 40, Dex: 40, Int: 40, FM: 40, Soc: 40 },
    wounds: { current: 12, max: 12 }, advantage: 0, conditions: [],
    weapons: [], armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
    skills: [], talents: [], movement: 4, items: [],
    ...over,
  } as Combatant;
}
// `groupLabel` = libellé de Groupe (lisibilité) → résolu en id pour `Weapon.subType` (réf).
const wpn = (groupLabel: string, type: Weapon['type'] = 'melee'): Weapon =>
  ({ name: groupLabel, type, damage: { plusBF: true, flat: 0, bare: true }, qualities: [], subType: weaponGroupIdByLabel(groupLabel) ?? groupLabel });

describe('combatValue — Spécialisation de Corps à corps (LDB 09 l.44)', () => {
  const sk = (spec: string, advances: number) =>
    ({ skillId: 'corps-a-corps', spec, characteristic: 'CC', advances } as Combatant['skills'][number]);

  it('les Augmentations comptent quand la Spé correspond au Groupe de l’arme', () => {
    const c = hero({ skills: [sk('Base', 20)] });
    expect(combatValue(c, 'melee', wpn('Base'))).toBe(60); // CC 40 + 20 (Base)
  });

  it('sans la bonne Spé, on teste sur la Caractéristique brute (Sigrid)', () => {
    const c = hero({ skills: [sk('Base', 20)] }); // entraîné en Base seulement
    expect(combatValue(c, 'melee', wpn('Escrime'))).toBe(40); // CC 40, +20 ne s’applique PAS
  });

  it('Groupe d’arme « Deux-mains » ↔ Spé « À deux mains » (l.144)', () => {
    const c = hero({ skills: [sk('À deux mains', 15)] });
    expect(combatValue(c, 'melee', wpn('Deux-mains'))).toBe(55); // CC 40 + 15
    // un escrimeur ne profite PAS de sa Spé Escrime avec une arme à deux mains
    const esc = hero({ skills: [sk('Escrime', 15)] });
    expect(combatValue(esc, 'melee', wpn('Deux-mains'))).toBe(40);
  });

  it('plusieurs Spés : seule celle du Groupe tenu s’applique', () => {
    const c = hero({ skills: [sk('Base', 10), sk('À deux mains', 25)] });
    expect(combatValue(c, 'melee', wpn('Base'))).toBe(50);
    expect(combatValue(c, 'melee', wpn('Deux-mains'))).toBe(65);
  });

  it('arme omise (créature, affichage) → meilleure Spé disponible (historique)', () => {
    const c = hero({ skills: [sk('Base', 10), sk('Escrime', 25)] });
    expect(combatValue(c, 'melee')).toBe(65); // 40 + max(10,25)
  });

  it('Parade utilise la Spé de l’arme parante (defenseValue)', () => {
    const c = hero({ skills: [sk('Escrime', 30)], weapons: [wpn('Escrime')] });
    expect(defenseValue(c, 'parade')).toBe(70); // 40 + 30, arme = weapons[0]
    const cBase = hero({ skills: [sk('Escrime', 30)], weapons: [wpn('Base')] });
    expect(defenseValue(cBase, 'parade')).toBe(40); // pas d’Escrime sur une arme Base
  });
});

describe('combatValue — Spécialisation de Projectiles (LDB 62 l.225/234)', () => {
  const sk = (spec: string, advances: number) =>
    ({ skillId: 'projectiles', spec, characteristic: 'CT', advances } as Combatant['skills'][number]);

  it('les Augmentations comptent pour le bon Groupe à distance', () => {
    const c = hero({ skills: [sk('Arc', 18)] });
    expect(combatValue(c, 'ranged', wpn('Arc', 'ranged'))).toBe(58); // CT 40 + 18
  });

  it('Projectiles (Poudre noire) ne s’applique pas à un Arc (l.225)', () => {
    const c = hero({ skills: [sk('Poudre noire', 18)] });
    expect(combatValue(c, 'ranged', wpn('Arc', 'ranged'))).toBe(40);
  });

  it('Projectiles (Ingénierie) couvre Poudre noire et Explosifs (l.234)', () => {
    const c = hero({ skills: [sk('Ingénierie', 22)] });
    expect(combatValue(c, 'ranged', wpn('Poudre noire', 'ranged'))).toBe(62);
    expect(combatValue(c, 'ranged', wpn('Explosifs', 'ranged'))).toBe(62);
    expect(combatValue(c, 'ranged', wpn('Poudre noire et ingénierie', 'ranged'))).toBe(62);
    // mais pas un Arc
    expect(combatValue(c, 'ranged', wpn('Arc', 'ranged'))).toBe(40);
  });
});
