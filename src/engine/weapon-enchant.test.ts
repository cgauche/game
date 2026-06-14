import { describe, it, expect } from 'vitest';
import { enchantedWeapon, enchantOnHitConditions, enchantOnHitTests, effectiveWeaponDamage } from './weaponDamage';
import { isMagicWeapon } from './qualities/dispatch';
import { applyOps } from './ops';
import { endOfRound } from './conditions';
import type { Combatant, Weapon } from './types';

/**
 * Jalon 2.6 — Enchantement d'arme temporisé (op `enchantWeapon`) : B. de Droiture (Magique),
 * Marteau ardent de Sigmar (Magique, +BSoc, En flammes + À Terre à la touche), Épée ardente de
 * Rhuin (+6, Percutante, En flammes). L'enchantement vit sur le PORTEUR (ActiveEffect) et est
 * fusionné à l'arme au moment de la résolution — `recomputeLoadout` ne peut pas l'écraser.
 */
const dummy = (p: Partial<Combatant> = {}): Combatant =>
  ({
    id: 'x', name: 'X', kind: 'hero',
    characteristics: { CC: 30, CT: 30, F: 30, E: 30, I: 30, Ag: 30, Dex: 30, Int: 30, FM: 30, Soc: 45 },
    wounds: { current: 20, max: 20 }, advantage: 0, conditions: [], skills: [], talents: [],
    weapons: [], armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
    ...p,
  } as Combatant);

const sword = (): Weapon => ({ name: 'Épée', type: 'melee', damage: '+BF+4', reach: 'Moyenne', range: null, qualities: [] });

describe('enchantedWeapon — fusion des enchantements actifs du porteur', () => {
  it('B. de Droiture : l’arme devient Magique (isMagicWeapon → touche l’Éthéré)', () => {
    const c = dummy({});
    applyOps(c, [{ op: 'enchantWeapon', addQualities: ['Magique'] }], { label: 'Bénédiction de Droiture', defaultDurationRounds: 6 });
    const w = enchantedWeapon(c, sword());
    expect(isMagicWeapon(w)).toBe(true);
    expect(isMagicWeapon(sword())).toBe(false); // l'objet d'origine n'est pas muté
  });

  it('Marteau ardent : +BSoc Dégâts (du PRÊTRE) + Magique + En flammes/À Terre à la touche', () => {
    const priest = dummy({}); // BSoc 4
    const fighter = dummy({ id: 'f' });
    applyOps(fighter, [{
      op: 'enchantWeapon', addQualities: ['Magique'], damageBonus: { bonusOf: 'Soc' },
      onHitConditions: [{ name: 'En flammes' }, { name: 'À Terre' }],
    }], { label: 'Marteau ardent de Sigmar', caster: priest, defaultDurationRounds: 4 });
    const w = enchantedWeapon(fighter, sword());
    expect(effectiveWeaponDamage(w, 3)).toBe(3 + 4 + 4); // BF 3 + arme 4 + BSoc 4 du prêtre
    expect(enchantOnHitConditions(fighter).map((x) => x.name)).toEqual(['En flammes', 'À Terre']);
  });

  it('Épée ardente de Rhuin : +6 et Percutante s’apposent, et l’enchantement EXPIRE', () => {
    const c = dummy({});
    applyOps(c, [{ op: 'enchantWeapon', addQualities: ['Percutante'], damageBonus: 6, onHitConditions: [{ name: 'En flammes' }] }], {
      label: 'Épée ardente de Rhuin', defaultDurationRounds: 1,
    });
    let w = enchantedWeapon(c, sword());
    expect(w.qualities).toContain('Percutante');
    expect(effectiveWeaponDamage(w, 3)).toBe(3 + 4 + 6);
    endOfRound(c); // (BFM) Rounds écoulés → dissipation
    w = enchantedWeapon(c, sword());
    expect(w.qualities).not.toContain('Percutante');
    expect(effectiveWeaponDamage(w, 3)).toBe(3 + 4);
    expect(enchantOnHitConditions(c)).toHaveLength(0);
  });

  it('Épée de justice : Test à la touche GATÉ par le Groupe « Criminel » (Inconscient sur échec)', () => {
    const c = dummy({});
    applyOps(c, [{
      op: 'enchantWeapon', addQualities: ['Magique'],
      onHitTest: { onlyGroups: ['Criminel'], skill: 'Résistance', difficulty: 'accessible', onFail: [{ name: 'Inconscient' }] },
    }], { label: 'Épée de justice', defaultDurationRounds: 4 });
    const tests = enchantOnHitTests(c);
    expect(tests).toHaveLength(1);
    expect(tests[0]?.onlyGroups).toEqual(['Criminel']);
    expect(tests[0]?.onFail[0].name).toBe('Inconscient');
    endOfRound(c); endOfRound(c); endOfRound(c); endOfRound(c);
    expect(enchantOnHitTests(c)).toHaveLength(0); // dissipé avec l'enchantement
  });
});
