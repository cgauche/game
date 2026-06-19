import { describe, it, expect } from 'vitest';
import { effectiveWeaponDamage } from './weaponDamage';
import { recomputeLoadout } from './items';
import { isMagicWeapon } from './qualities/dispatch';
import { applyOps } from './ops';
import { endOfRound } from './conditions';
import { runSpellFlow } from '../state/combatEffects';
import type { Combatant, ItemInstance, Weapon } from './types';
import type { TriggeredEffect } from '../state/flow';

/** Construit un `TriggeredEffect` onHit→victim portant `ops` (forme unifiée des onHit d'arme). */
const onHitFlow = (ops: unknown[]): TriggeredEffect =>
  ({ trigger: 'onHit', on: 'victim', flow: { kind: 'do', effect: { type: 'ops', on: 'victim', ops } as never } });

/**
 * Enchantement d'arme (op `augmentWeapon`) : B. de Droiture (Magique), Marteau ardent de Sigmar
 * (Magique, +BSoc, En flammes + À Terre à la touche), Épée ardente de Rhuin (+6, Percutante, En
 * flammes), Épée de justice (bypass + Test gaté). L'enchantement vit SUR L'ARME (`ItemInstance.enchants`)
 * et est replié dans l'arme active par `recomputeLoadout` → `c.weapons[0]` est déjà enchantée
 * (visible partout ET appliquée à la résolution). À l'expiration, l'enchant est retiré de l'objet.
 */
const dummy = (p: Partial<Combatant> = {}): Combatant =>
  ({
    id: 'x', name: 'X', kind: 'hero',
    characteristics: { CC: 30, CT: 30, F: 30, E: 30, I: 30, Ag: 30, Dex: 30, Int: 30, FM: 30, Soc: 45 },
    wounds: { current: 20, max: 20 }, advantage: 0, conditions: [], skills: [], talents: [],
    weapons: [], armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
    ...p,
  } as Combatant);

/** Arme NUE pour les comparaisons de mitigation (non enchantée). */
const sword = (): Weapon => ({ name: 'Épée', type: 'melee', damage: '+BF+4', reach: 'Moyenne', range: null, qualities: [] });

const weaponItem = (uid: string, name: string, damage: string): ItemInstance =>
  ({ uid, name, kind: 'melee', damage, reach: 'Moyenne', range: null, qualities: [], enc: 1, equipped: true });

/** Combattant tenant une arme dans son set actif (l'op enchante l'arme TENUE). */
const wielder = (item: ItemInstance, p: Partial<Combatant> = {}): Combatant => {
  const c = dummy({ items: [item], loadouts: [{ id: 'lo', name: 'Set I', main: item.uid }], activeLoadoutId: 'lo', ...p });
  recomputeLoadout(c);
  return c;
};
const heldEnchants = (c: Combatant) => (c.items ?? []).find((i) => i.uid === 'w')?.enchants;

describe('augmentWeapon — enchantement porté par l’arme, replié dans c.weapons', () => {
  it('B. de Droiture : l’arme tenue devient Magique (isMagicWeapon → touche l’Éthéré), objet non muté', () => {
    const c = wielder(weaponItem('w', 'Épée', '+BF+4'));
    applyOps(c, [{ op: 'augmentWeapon', addQualities: ['Magique'] }], { label: 'Bénédiction de Droiture', defaultDurationRounds: 6 });
    expect(isMagicWeapon(c.weapons[0])).toBe(true); // arme active enchantée
    expect(heldEnchants(c)).toHaveLength(1); // l'enchant vit sur l'OBJET
    expect(c.items![0].qualities).toEqual([]); // les qualités de base de l'objet ne sont pas mutées
  });

  it('Marteau ardent : +BSoc Dégâts (du PRÊTRE) + Magique + En flammes/À Terre à la touche', () => {
    const priest = dummy({}); // BSoc 4
    const fighter = wielder(weaponItem('w', 'Épée', '+BF+4'), { id: 'f' });
    applyOps(fighter, [{
      op: 'augmentWeapon', addQualities: ['Magique'], damageBonus: { bonusOf: 'Soc' },
      onHitEffects: [onHitFlow([{ op: 'condition', name: 'en-flammes' }, { op: 'condition', name: 'a-terre' }])],
    }], { label: 'Marteau ardent de Sigmar', caster: priest, defaultDurationRounds: 4 });
    expect(effectiveWeaponDamage(fighter.weapons[0], 3)).toBe(3 + 4 + 4); // BF 3 + arme 4 + BSoc 4 du prêtre
    expect(isMagicWeapon(fighter.weapons[0])).toBe(true);
    // L'onHit est replié sur l'arme (weapon.onHitEffects) ; exécuté par le dispatcher → 2 États sur la cible.
    const victim = dummy({ id: 'v' });
    runSpellFlow(victim, fighter, fighter.weapons[0].onHitEffects![0].flow, {});
    expect(victim.conditions.map((c) => c.name).sort()).toEqual(['en-flammes', 'a-terre'].sort());
  });

  it('Épée ardente de Rhuin : +6 et Percutante s’apposent, et l’enchantement EXPIRE (objet nettoyé)', () => {
    const c = wielder(weaponItem('w', 'Épée', '+BF+4'));
    applyOps(c, [{ op: 'augmentWeapon', addQualities: ['Percutante'], damageBonus: 6, onHitEffects: [onHitFlow([{ op: 'condition', name: 'en-flammes' }])] }], {
      label: 'Épée ardente de Rhuin', defaultDurationRounds: 1,
    });
    expect(c.weapons[0].qualities).toContain('Percutante');
    expect(effectiveWeaponDamage(c.weapons[0], 3)).toBe(3 + 4 + 6);
    endOfRound(c); // Round écoulé → dissipation
    expect(c.weapons[0].qualities).not.toContain('Percutante');
    expect(effectiveWeaponDamage(c.weapons[0], 3)).toBe(3 + 4);
    expect(heldEnchants(c)).toBeUndefined(); // enchant retiré de l'objet
  });

  it('Épée de justice : bypass « all » lie l’ÉPÉE tenue (requiresWeapon) ; un marteau tenu → fizzle', async () => {
    const { woundsFromHit } = await import('./combat');
    const c = wielder(weaponItem('w', 'Épée', '+BF+4'));
    applyOps(c, [{ op: 'augmentWeapon', requiresWeapon: 'épée', addQualities: ['Magique'], bypass: 'all' }], { label: 'Épée de justice', defaultDurationRounds: 4 });
    expect(c.weapons[0].bypass).toBe('all'); // épée tenue → enchantée
    const hammerGuy = wielder(weaponItem('w', 'Marteau de guerre', '+BF+5'), { id: 'h' });
    applyOps(hammerGuy, [{ op: 'augmentWeapon', requiresWeapon: 'épée', addQualities: ['Magique'], bypass: 'all' }], { label: 'Épée de justice', defaultDurationRounds: 4 });
    expect(hammerGuy.weapons[0].bypass).toBeUndefined(); // pas d'épée tenue → fizzle
    expect(heldEnchants(hammerGuy)).toBeUndefined();
    const armored = dummy({ armour: { tete: 0, brasG: 0, brasD: 0, corps: 5, jambeG: 0, jambeD: 0 } }); // 5 PA corps, BE 3
    expect(woundsFromHit(sword(), armored, 'corps', 12)).toBe(12 - 3 - 5); // arme nue : −BE −PA
    expect(woundsFromHit(c.weapons[0], armored, 'corps', 12)).toBe(12 - 3); // épée enchantée : ignore les 5 PA
  });

  it('Épée de justice : Test à la touche GATÉ par le Groupe « Criminel » (Inconscient sur échec)', () => {
    const c = wielder(weaponItem('w', 'Épée', '+BF+4'));
    applyOps(c, [{
      op: 'augmentWeapon', addQualities: ['Magique'],
      onHitEffects: [onHitFlow([{ op: 'test', skill: 'resistance', difficulty: 'accessible', onlyGroups: ['Criminel'], onFail: [{ op: 'condition', name: 'inconscient' }] }])],
    }], { label: 'Épée de justice', defaultDurationRounds: 4 });
    // Cible NON-Criminel : le Test est gaté par Groupe → aucun effet, indépendamment du jet.
    const civilian = dummy({ id: 'civ' });
    runSpellFlow(civilian, c, c.weapons[0].onHitEffects![0].flow, {});
    expect(civilian.conditions).toHaveLength(0);
    endOfRound(c); endOfRound(c); endOfRound(c); endOfRound(c);
    expect(heldEnchants(c)).toBeUndefined(); // dissipé avec l'enchantement
  });
});
