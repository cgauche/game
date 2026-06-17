/**
 * engine/ops — vocabulaire d'effets partagé (sorts / tables de contrecoup /
 * mutations) : formules, applicateur, non-cumul des modificateurs (LDB l.168).
 */
import { describe, it, expect } from 'vitest';
import type { Combatant } from './types';
import { makeRNG } from './dice';
import { resolveFormula, applyOps, applyActiveEffect, COMBAT_PERSIST } from './ops';
import { hasTraitKey } from './traits/dispatch';

function hero(p: Partial<Combatant> = {}): Combatant {
  return {
    id: 'h', name: 'Cobaye', kind: 'hero',
    characteristics: { CC: 30, CT: 30, F: 30, E: 45, I: 30, Ag: 30, Dex: 30, Int: 30, FM: 38, Soc: 30 },
    wounds: { current: 10, max: 12 }, advantage: 0, conditions: [], movement: 4,
    weapons: [], armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
    skills: [], talents: [],
    ...p,
  } as Combatant;
}

describe('resolveFormula', () => {
  it('littéral, (Bonus de X), (X) pleine, dés (RNG seedable)', () => {
    const c = hero(); // FM 38 → BFM 3 ; E 45 → BE 4
    expect(resolveFormula(7, c)).toBe(7);
    expect(resolveFormula({ bonusOf: 'FM' }, c)).toBe(3);
    expect(resolveFormula({ bonusOf: 'E' }, c)).toBe(4);
    expect(resolveFormula({ charOf: 'FM' }, c)).toBe(38);
    const rng = makeRNG(42);
    const v = resolveFormula({ dice: { n: 1, sides: 10, plus: 2 } }, c, rng);
    expect(v).toBeGreaterThanOrEqual(3);
    expect(v).toBeLessThanOrEqual(12);
    // Déterminisme au seed
    expect(resolveFormula({ dice: { n: 1, sides: 10, plus: 2 } }, c, makeRNG(42))).toBe(v);
  });

  it('(Bonus de X) se résout contre la caractéristique EFFECTIVE (buffs compris)', () => {
    const c = hero({ activeEffects: [{ label: 'Buff', char: 'FM', bonus: 10, roundsLeft: 3 }] });
    expect(resolveFormula({ bonusOf: 'FM' }, c)).toBe(4); // 38+10 → 48 → bonus 4
  });
});

describe('applyOps — opérations unitaires', () => {
  it('wounds : perte directe centralisée (Avantage purgé, À Terre à 0 PB)', () => {
    const c = hero({ advantage: 2, wounds: { current: 3, max: 12 } });
    const lines = applyOps(c, [{ op: 'wounds', amount: 5 }]);
    expect(c.wounds.current).toBe(0);
    expect(c.advantage).toBe(0);
    expect(c.conditions.some((x) => x.name === 'a-terre')).toBe(true);
    expect(lines[0]).toMatch(/subit 5 Blessure/);
  });

  it('heal : plafonné au max de Blessures', () => {
    const c = hero({ wounds: { current: 10, max: 12 } });
    applyOps(c, [{ op: 'heal', amount: 5 }]);
    expect(c.wounds.current).toBe(12);
  });

  it('giveTrapping : crée l’objet dans l’inventaire (réel → stats, échelle au DR)', () => {
    const c = hero({ items: [] });
    // Générosité de Manann : 1 Ration + 1 par +2 DR → à DR 4, 1 + floor(4/2) = 3 Rations.
    applyOps(c, [{ op: 'giveTrapping', trapping: 'Ration (1 jour)', perSL: { every: 2, amount: 1 } }], { sl: 4 });
    const rations = (c.items ?? []).filter((it) => /^ration/i.test(it.name));
    expect(rations.length).toBe(3);
  });

  it('giveTrapping : nom inconnu → objet CUSTOM (jamais null, comme l’Effet de scène)', () => {
    const c = hero({ items: [] });
    applyOps(c, [{ op: 'giveTrapping', trapping: 'Babiole onirique XYZ' }]);
    expect((c.items ?? []).some((it) => it.name === 'Babiole onirique XYZ')).toBe(true);
  });

  it('grantTrait onlyGroups (Bannissement) : Instable n’atteint que Mort-vivant/Démon', () => {
    const undead = hero({ groups: ['Mort-vivant'] });
    const human = hero({ groups: ['Humain'] });
    const op = { op: 'grantTrait' as const, traitId: 'instable', onlyGroups: ['Mort-vivant', 'Démon'] };
    applyOps(undead, [op]);
    applyOps(human, [op]);
    expect(hasTraitKey(undead.traits, 'instable')).toBe(true);
    expect(hasTraitKey(human.traits, 'instable')).toBe(false); // gate de Groupe : non affecté
  });

  it('condition : ajout avec valeur en formule (Bonus de FM du référent caster)', () => {
    const caster = hero({ id: 'c', name: 'Lanceur', characteristics: { ...hero().characteristics, FM: 52 } });
    const c = hero();
    applyOps(c, [{ op: 'condition', name: 'hemorragique', value: { bonusOf: 'FM' } }], { caster });
    expect(c.conditions.find((x) => x.name === 'hemorragique')?.value).toBe(5);
  });

  it('removeCondition sans nom : retire le 1er État porté ; sans État → journal explicite', () => {
    const c = hero({ conditions: [{ name: 'extenue', value: 2 }] });
    const lines = applyOps(c, [{ op: 'removeCondition' }]);
    expect(c.conditions.find((x) => x.name === 'extenue')?.value).toBe(1);
    expect(lines[0]).toMatch(/retire 1 État Exténué/);
    const sain = hero();
    expect(applyOps(sain, [{ op: 'removeCondition' }])[0]).toMatch(/aucun État à retirer/);
  });

  it('charMod : durée du contexte (sort), agrégé en UNE ligne de journal', () => {
    const c = hero();
    const lines = applyOps(
      c,
      [
        { op: 'charMod', char: 'Ag', mod: -10 },
        { op: 'charMod', char: 'Dex', mod: -10 },
      ],
      { label: 'Écorce', defaultDurationRounds: 6 },
    );
    expect(c.activeEffects).toHaveLength(2);
    expect(c.activeEffects![0]).toMatchObject({ label: 'Écorce', char: 'Ag', bonus: -10, roundsLeft: 6 });
    expect(lines).toHaveLength(1);
    expect(lines[0]).toBe('Cobaye : Écorce (-10 Agilité, -10 Dextérité, 6 rounds).');
  });

  it('charMod : COMBAT_PERSIST par défaut → « durée hors combat » au journal', () => {
    const c = hero();
    const lines = applyOps(c, [{ op: 'charMod', char: 'E', mod: 20 }], { label: 'Armure' });
    expect(c.activeEffects![0].roundsLeft).toBe(COMBAT_PERSIST);
    expect(lines[0]).toMatch(/durée hors combat/);
  });

  it('test imbriqué : échec → onFail appliqué ; réussite → onSuccess', () => {
    // Résistance = E 45 ; Intermédiaire +0 → cible 45. RNG fixé : on force les deux issues.
    const fail = hero({ characteristics: { ...hero().characteristics, E: 1 } }); // cible ~1 → échec quasi sûr
    const ok = hero({ characteristics: { ...hero().characteristics, E: 100 } }); // cible 100 → réussite sûre
    const ops = [{ op: 'test', skill: 'Résistance', difficulty: 'intermediaire', onFail: [{ op: 'condition', name: 'sonne' }], onSuccess: [{ op: 'narrative', text: 'tenu bon' }] } as const];
    const linesFail = applyOps(fail, ops as never, { rng: makeRNG(6) }); // jet 53 : échec vs cible 1 (hors bande auto 01-05)
    expect(fail.conditions.some((x) => x.name === 'sonne')).toBe(true);
    expect(linesFail[0]).toMatch(/Test de Résistance/);
    const linesOk = applyOps(ok, ops as never, { rng: makeRNG(6) }); // jet 53 : réussite vs cible 99
    expect(ok.conditions).toHaveLength(0);
    expect(linesOk[1]).toBe('tenu bon');
  });

  it('reduceToZero : PB à 0 + Inconscient (Châtiment / Tonnerre et foudre, LDB 40)', () => {
    const c = hero();
    applyOps(c, [{ op: 'reduceToZero' }]);
    expect(c.wounds.current).toBe(0);
    expect(c.conditions.some((x) => x.name === 'inconscient')).toBe(true);
  });
});

describe('applyActiveEffect — non-cumul (LDB l.168)', () => {
  it('meilleur bonus conservé, pire pénalité conservée, bonus+pénalité coexistent', () => {
    const c = hero();
    applyActiveEffect(c, { label: 'A', char: 'FM', bonus: 10, roundsLeft: 3 });
    applyActiveEffect(c, { label: 'B', char: 'FM', bonus: 20, roundsLeft: 2 });
    applyActiveEffect(c, { label: 'C', char: 'FM', bonus: 5, roundsLeft: 9 });
    applyActiveEffect(c, { label: 'D', char: 'FM', bonus: -10, roundsLeft: 1 });
    const fm = c.activeEffects!.filter((e) => e.char === 'FM');
    expect(fm).toHaveLength(2); // un bonus (le meilleur : B +20) + une pénalité (D -10)
    expect(fm.find((e) => e.bonus > 0)).toMatchObject({ label: 'B', bonus: 20 });
    expect(fm.find((e) => e.bonus < 0)).toMatchObject({ label: 'D', bonus: -10 });
  });

  it('buff de F/E/FM recale les Blessures max (LDB 85)', () => {
    const c = hero({ wounds: { current: 10, max: 12, base: 12 } });
    applyActiveEffect(c, { label: 'Vigueur', char: 'E', bonus: 10, roundsLeft: 6 });
    expect(c.wounds.max).toBeGreaterThan(12); // E 45→55 : BE 4→5 → +2 PB (2×BE)
  });
});
