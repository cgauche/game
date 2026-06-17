import { describe, it, expect } from 'vitest';
import { applyOps, slBonus } from './ops';
import { stacks } from './conditions';
import type { Combatant } from './types';

/**
 * Enablers d'ops (Jalon 2.6) :
 *  - `PerSL` / `OpsCtx.sl` : échelles « par +N DR » des sorts (LDB 41/42/47/48 —
 *    « 1d10 + DR Dégâts » Comète, « +1 Empêtré par +2 DR » Enchevêtrement,
 *    « perd 1 Point de Corruption (+1 par +2 DR) » Innocence immaculée,
 *    « +DR État Enflammé » Purification) ;
 *  - `onlyGroups` : ops gatées par Groupe de la cible (engine/groups — « les cibles
 *    possédant les Traits Mort-vivant et Démoniaque gagnent aussi En flammes », Feu de l'âme).
 */
const dummy = (p: Partial<Combatant> = {}): Combatant =>
  ({
    id: 'x', name: 'X', kind: 'enemy',
    characteristics: { CC: 30, CT: 30, F: 30, E: 30, I: 30, Ag: 30, Dex: 30, Int: 30, FM: 30, Soc: 30 },
    wounds: { current: 20, max: 20 }, advantage: 0, conditions: [], skills: [], talents: [],
    weapons: [], armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
    ...p,
  } as Combatant);

describe('PerSL — échelle « par +N DR » (OpsCtx.sl)', () => {
  it('slBonus : paliers entiers, jamais négatif, sl absent = 0', () => {
    expect(slBonus(5, { every: 2, amount: 1 })).toBe(2); // +1 par +2 DR, DR 5 → +2
    expect(slBonus(5, { every: 1, amount: 1 })).toBe(5); // +DR
    expect(slBonus(4, { every: 2, amount: -1 })).toBe(-2); // retrait (Innocence immaculée)
    expect(slBonus(-3, { every: 2, amount: 1 })).toBe(0); // DR négatif → rien
    expect(slBonus(undefined, { every: 2, amount: 1 })).toBe(0);
    expect(slBonus(5, undefined)).toBe(0);
  });

  it('wounds 1d10 + DR (Comète à Deux Queues, LDB 42)', () => {
    const c = dummy();
    applyOps(c, [{ op: 'wounds', amount: { dice: { n: 1, sides: 10 } }, perSL: { every: 1, amount: 1 } }], {
      rng: { int: () => 4 }, sl: 3, // d10 = 4 (jet figé int→4? cf. rollDice) + DR 3
    });
    expect(c.wounds.current).toBeLessThan(20);
    expect(20 - c.wounds.current).toBeGreaterThanOrEqual(4); // au moins le dé + l'échelle
  });

  it('condition « +1 Empêtré par +2 DR » (Enchevêtrement, LDB 47)', () => {
    const c = dummy();
    applyOps(c, [{ op: 'condition', name: 'empetre', valuePerSL: { every: 2, amount: 1 } }], { sl: 5 });
    expect(stacks(c, 'empetre')).toBe(3); // 1 (base) + ⌊5/2⌋ = 2
  });

  it('corruption « perd 1 (+1 par +2 DR) » (Innocence immaculée, LDB 42) — plancher 0', () => {
    const c = dummy({ corruption: 4 });
    applyOps(c, [{ op: 'corruption', amount: -1, perSL: { every: 2, amount: -1 } }], { sl: 4 });
    expect(c.corruption).toBe(1); // 4 − (1 + 2)
    applyOps(c, [{ op: 'corruption', amount: -1, perSL: { every: 2, amount: -1 } }], { sl: 8 });
    expect(c.corruption).toBe(0); // jamais sous 0
  });

  it('condition « +DR État En flammes » (Purification, LDB 48) — base 0, plancher 1 de l’op', () => {
    const c = dummy();
    applyOps(c, [{ op: 'condition', name: 'en-flammes', value: 0, valuePerSL: { every: 1, amount: 1 } }], { sl: 4 });
    expect(stacks(c, 'en-flammes')).toBe(4);
  });
});

describe('onlyGroups — ops gatées par Groupe de la cible (Feu de l’âme, LDB 42)', () => {
  it('un Mort-vivant gagne l’État, un Humain non ; les wounds non gatées touchent les deux', () => {
    const zombie = dummy({ groups: ['Mort-vivant'] });
    const villageois = dummy({ groups: ['Humain'] });
    const ops = [
      { op: 'wounds' as const, amount: 3 },
      { op: 'condition' as const, name: 'en-flammes', onlyGroups: ['Mort-vivant', 'Démon'] },
    ];
    applyOps(zombie, ops, { sl: 0 });
    applyOps(villageois, ops, { sl: 0 });
    expect(zombie.wounds.current).toBe(17);
    expect(villageois.wounds.current).toBe(17);
    expect(stacks(zombie, 'en-flammes')).toBe(1);
    expect(stacks(villageois, 'en-flammes')).toBe(0);
  });

  it('groupMatch tolère le pluriel de la spec (« Morts-vivants » matche le groupe Mort-vivant)', () => {
    const zombie = dummy({ groups: ['Mort-vivant'] });
    applyOps(zombie, [{ op: 'condition', name: 'en-flammes', onlyGroups: ['Morts-vivants'] }], {});
    expect(stacks(zombie, 'en-flammes')).toBe(1);
  });
});
