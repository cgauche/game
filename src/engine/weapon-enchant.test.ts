import { describe, it, expect } from 'vitest';
import { enchantedWeapon, activeEnchantsFor, effectiveWeaponDamage } from './weaponDamage';
import { isMagicWeapon } from './qualities/dispatch';
import { applyOps } from './ops';
import { endOfRound } from './conditions';
import { runSpellFlow } from '../state/combatEffects';
import type { Combatant, Weapon } from './types';
import type { TriggeredEffect } from '../state/flow';

/** Construit un `TriggeredEffect` onHit→victim portant `ops` (forme unifiée des onHit d'arme). */
const onHitFlow = (ops: unknown[]): TriggeredEffect =>
  ({ trigger: 'onHit', on: 'victim', flow: { kind: 'do', effect: { type: 'ops', on: 'victim', ops } as never } });

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
      onHitEffects: [onHitFlow([{ op: 'condition', name: 'En flammes' }, { op: 'condition', name: 'À Terre' }])],
    }], { label: 'Marteau ardent de Sigmar', caster: priest, defaultDurationRounds: 4 });
    const w = enchantedWeapon(fighter, sword());
    expect(effectiveWeaponDamage(w, 3)).toBe(3 + 4 + 4); // BF 3 + arme 4 + BSoc 4 du prêtre
    // L'onHit unifié, exécuté par le dispatcher de flow, applique les deux États à la cible touchée.
    const victim = dummy({ id: 'v' });
    const eff = activeEnchantsFor(fighter, sword())[0].onHitEffects![0];
    runSpellFlow(victim, fighter, eff.flow, {});
    expect(victim.conditions.map((c) => c.name).sort()).toEqual(['En flammes', 'À Terre'].sort());
  });

  it('Épée ardente de Rhuin : +6 et Percutante s’apposent, et l’enchantement EXPIRE', () => {
    const c = dummy({});
    applyOps(c, [{ op: 'enchantWeapon', addQualities: ['Percutante'], damageBonus: 6, onHitEffects: [onHitFlow([{ op: 'condition', name: 'En flammes' }])] }], {
      label: 'Épée ardente de Rhuin', defaultDurationRounds: 1,
    });
    let w = enchantedWeapon(c, sword());
    expect(w.qualities).toContain('Percutante');
    expect(effectiveWeaponDamage(w, 3)).toBe(3 + 4 + 6);
    endOfRound(c); // (BFM) Rounds écoulés → dissipation
    w = enchantedWeapon(c, sword());
    expect(w.qualities).not.toContain('Percutante');
    expect(effectiveWeaponDamage(w, 3)).toBe(3 + 4);
    expect(activeEnchantsFor(c)).toHaveLength(0); // l'enchant (et son onHit) dissipé
  });

  it('Épée de justice : bypass « all » (ignore les PA) UNIQUEMENT sur une épée (requiresWeapon)', async () => {
    const { woundsFromHit } = await import('./combat');
    const c = dummy({});
    applyOps(c, [{ op: 'enchantWeapon', requiresWeapon: 'épée', addQualities: ['Magique'], bypass: 'all' }], { label: 'Épée de justice', defaultDurationRounds: 4 });
    const enchSword = enchantedWeapon(c, sword());
    expect(enchSword.bypass).toBe('all'); // épée → enchantée
    const hammer: Weapon = { name: 'Marteau de guerre', type: 'melee', damage: '+BF+5', reach: 'Moyenne', range: null, qualities: [] };
    expect(enchantedWeapon(c, hammer).bypass).toBeUndefined(); // pas une épée → enchant ignoré
    const armored = dummy({ armour: { tete: 0, brasG: 0, brasD: 0, corps: 5, jambeG: 0, jambeD: 0 } }); // 5 PA corps, BE 3
    expect(woundsFromHit(sword(), armored, 'corps', 12)).toBe(12 - 3 - 5); // arme normale : −BE −PA
    expect(woundsFromHit(enchSword, armored, 'corps', 12)).toBe(12 - 3); // épée enchantée : ignore les 5 PA
  });

  it('Épée de justice : Test à la touche GATÉ par le Groupe « Criminel » (Inconscient sur échec)', () => {
    const c = dummy({});
    applyOps(c, [{
      op: 'enchantWeapon', addQualities: ['Magique'],
      onHitEffects: [onHitFlow([{ op: 'test', skill: 'Résistance', difficulty: 'accessible', onlyGroups: ['Criminel'], onFail: [{ op: 'condition', name: 'Inconscient' }] }])],
    }], { label: 'Épée de justice', defaultDurationRounds: 4 });
    const eff = activeEnchantsFor(c)[0].onHitEffects![0];
    // Cible NON-Criminel : le Test est gaté par Groupe → aucun effet, indépendamment du jet.
    const civilian = dummy({ id: 'civ' });
    runSpellFlow(civilian, c, eff.flow, {});
    expect(civilian.conditions).toHaveLength(0);
    endOfRound(c); endOfRound(c); endOfRound(c); endOfRound(c);
    expect(activeEnchantsFor(c)).toHaveLength(0); // dissipé avec l'enchantement
  });
});
