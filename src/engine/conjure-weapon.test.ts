import { describe, it, expect } from 'vitest';
import { applyOps } from './ops';
import { endOfRound } from './conditions';
import { effectiveWeaponDamage, enchantOnHitConditions } from './weaponDamage';
import { conjureFormOptions } from './conjuredWeapons';
import { bonus } from './characteristics';
import type { Combatant } from './types';

/**
 * Armes INVOQUÉES temporaires (op `conjureWeapon`, LDB 47/48) : un OBJET ordinaire `conjured` posé en
 * inventaire, tenu d'office (recomputeLoadout) puis retiré à l'expiration. Réutilise la base d'armes
 * (itemFromTrapping) et le loadout — seuls Dégâts (= BFM…) et l'Atout Magique sont surchargés.
 */
const mage = (p: Partial<Combatant> = {}): Combatant =>
  ({
    id: 'mage', name: 'Magister', kind: 'hero',
    characteristics: { CC: 40, CT: 30, F: 30, E: 30, I: 35, Ag: 40, Dex: 45, Int: 40, FM: 45, Soc: 30 },
    wounds: { current: 12, max: 12 }, advantage: 0, conditions: [], skills: [], talents: [],
    weapons: [], items: [], armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
    ...p,
  } as Combatant);

describe('conjureWeapon — objet temporaire (Arme aethyrique, Dégâts = BFM)', () => {
  it('crée un OBJET `conjured` en inventaire, tenu en tête de c.weapons, Dégâts FIXES = BFM', () => {
    const c = mage(); // FM 45 → BFM 4
    applyOps(c, [{ op: 'conjureWeapon', name: 'Arme aethyrique', damage: { bonusOf: 'FM' }, qualities: ['Magique'] }],
      { label: 'Arme aethyrique', defaultDurationRounds: 4 });
    expect(c.items?.some((it) => it.conjured && it.name === 'Arme aethyrique')).toBe(true); // objet réel
    expect(c.weapons[0].name).toBe('Arme aethyrique'); // arme directrice
    expect(c.weapons[0].qualities).toContain('Magique');
    expect(c.weapons[0].damage).toBe('+4'); // BFM, pas de +BF
    expect(effectiveWeaponDamage(c.weapons[0], bonus(c.characteristics.F))).toBe(4);
  });

  it('formes proposées : toutes les armes réelles des Spé connues, « Arme simple » incluse (≠ junk)', () => {
    const c = mage({ skills: [{ name: 'Corps à corps', spec: 'Base', advances: 10 }] as Combatant['skills'] });
    const labels = conjureFormOptions(c).map((f) => f.weapon);
    expect(labels).toContain('Arme simple'); // arme de base commune (épée/hache/masse/lance courte)
    expect(labels.every((l) => !/bouclier|improvis|mains nues/i.test(l))).toBe(true); // junk exclu
    expect(conjureFormOptions(c).every((f) => f.group.toLowerCase() === 'base')).toBe(true); // seulement la Spé connue
  });

  it('forme LIBRE : clone le profil d’une arme RÉELLE de la Spé de Corps à corps choisie', () => {
    const c = mage({ skills: [{ name: 'Corps à corps', spec: 'Escrime', advances: 10 }] as Combatant['skills'] });
    const opt = conjureFormOptions(c)[0]; // arme réelle d'Escrime issue de la base (Rapière…)
    applyOps(c, [{ op: 'conjureWeapon', name: 'Arme aethyrique', damage: { bonusOf: 'FM' }, qualities: ['Magique'], chooseForm: true }],
      { label: 'Arme aethyrique', defaultDurationRounds: 4, conjureForm: opt });
    expect(c.weapons[0].subType?.toLowerCase()).toBe('escrime'); // Groupe = la Spé choisie (profil réel)
    expect(c.weapons[0].name).toContain('Arme aethyrique');
    expect(c.weapons[0].damage).toBe('+4'); // Dégâts toujours = BFM (le gabarit ne donne que le profil)
  });

  it('vit dans un SET dédié actif, retiré à l’expiration (set + objet + restauration)', () => {
    const c = mage();
    applyOps(c, [{ op: 'conjureWeapon', name: 'Arme aethyrique', damage: { bonusOf: 'FM' }, qualities: ['Magique'] }],
      { label: 'Arme aethyrique', defaultDurationRounds: 1 });
    const conjuredSet = (c.loadouts ?? []).find((l) => l.name === 'Arme invoquée');
    expect(conjuredSet).toBeTruthy(); // SET dédié créé…
    expect(c.activeLoadoutId).toBe(conjuredSet!.id); // …et actif
    expect(c.weapons.some((w) => w.name === 'Arme aethyrique')).toBe(true);
    endOfRound(c); // 1 Round → expire
    expect(c.items?.some((it) => it.conjured)).toBeFalsy(); // objet retiré
    expect((c.loadouts ?? []).some((l) => l.name === 'Arme invoquée')).toBe(false); // set retiré
    expect(c.activeLoadoutId).not.toBe(conjuredSet!.id); // set d'origine réactivé
    expect(c.weapons.some((w) => w.name === 'Arme aethyrique')).toBe(false);
  });
});

describe('conjureWeapon — variantes de domaine (stats fixes du Sort)', () => {
  it('Faux de Shyish : Armes d’hast à 2 mains, Dégâts = BFM+3', () => {
    const c = mage(); // BFM 4
    applyOps(c, [{ op: 'conjureWeapon', name: 'Faux de Shyish', damage: { bonusOf: 'FM' }, damagePlus: 3, subType: 'Armes d’hast', reach: 'Longue', hands: 2, qualities: ['Magique'] }],
      { label: 'La Faux de Shyish', defaultDurationRounds: 4 });
    expect(c.weapons[0].name).toBe('Faux de Shyish');
    expect(c.weapons[0].hands).toBe(2);
    expect(c.weapons[0].subType).toBe('Armes d’hast');
    expect(c.weapons[0].damage).toBe('+7'); // BFM 4 + 3
  });

  it('Épée ardente de Rhuin : Dégâts +6, Percutante + En flammes à la touche', () => {
    const c = mage();
    applyOps(c, [{ op: 'conjureWeapon', name: 'Épée ardente de Rhuin', damage: 6, subType: 'Base', reach: 'Moyenne', hands: 1, qualities: ['Magique', 'Percutante'], onHitConditions: [{ name: 'En flammes' }] }],
      { label: "L'Épée ardente de Rhuin", defaultDurationRounds: 4 });
    expect(c.weapons[0].damage).toBe('+6');
    expect(c.weapons[0].qualities).toEqual(expect.arrayContaining(['Magique', 'Percutante']));
    expect(enchantOnHitConditions(c, c.weapons[0]).some((x) => x.name === 'En flammes')).toBe(true);
  });
});
