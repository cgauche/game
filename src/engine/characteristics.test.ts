import { describe, it, expect } from 'vitest';
import { effectiveChar, volatileCharLines } from './characteristics';
import { passiveCharSum, traumaById, dechirureFractureFicheId } from './trauma';
import type { Combatant, CharKey } from './types';

/** Combatant minimal : seuls `characteristics` et `activeEffects` importent ici (pool non-cumul). */
function mk(activeEffects: { char: CharKey; bonus: number; label?: string }[] = [], F = 40, over: Partial<Combatant> = {}): Combatant {
  return {
    id: 'c', label: 'c', kind: 'enemy', advantage: 0, conditions: [],
    characteristics: { force: F, agilite: 30, 'capacite-de-combat': 40 } as never,
    activeEffects: activeEffects.map((e) => ({ label: e.label ?? 'Effet', ...e })) as never,
    psychState: [], psychTraits: [], groups: [], weapons: [], armour: {} as never,
    skills: [], talents: [], movement: 4, wounds: { current: 10, max: 10 },
    ...over,
  } as Combatant;
}

describe('effectiveChar — non-cumul des modificateurs (LDB l.168 : meilleur bonus + pire pénalité, sommés)', () => {
  it('aucun effet actif → valeur de base', () => {
    expect(effectiveChar(mk(), 'force')).toBe(40);
  });
  it('plusieurs bonus → seul le MEILLEUR s’applique (+20, +10 → +20)', () => {
    expect(effectiveChar(mk([{ char: 'force', bonus: 20 }, { char: 'force', bonus: 10 }]), 'force')).toBe(60);
  });
  it('plusieurs pénalités → seule la PIRE s’applique (−10, −20 → −20)', () => {
    expect(effectiveChar(mk([{ char: 'force', bonus: -10 }, { char: 'force', bonus: -20 }]), 'force')).toBe(20);
  });
  it('mélange → meilleur bonus + pire pénalité (+20, +10, −10 → +10 net)', () => {
    expect(effectiveChar(mk([{ char: 'force', bonus: 20 }, { char: 'force', bonus: 10 }, { char: 'force', bonus: -10 }]), 'force')).toBe(50);
  });
  it('effets ciblant une AUTRE caractéristique → ignorés', () => {
    expect(effectiveChar(mk([{ char: 'agilite', bonus: 30 }]), 'force')).toBe(40);
  });
});

describe('volatileCharLines — décomposition étiquetée du pool non-cumul (issue #202)', () => {
  it('invariant : Σ(lines.value) = effectiveChar − characteristics − passiveCharSum, pour tout combattant', () => {
    const c = mk([{ char: 'capacite-de-combat', bonus: 20, label: 'Bénédiction de Bataille' }, { char: 'capacite-de-combat', bonus: 10, label: 'Autre buff' }, { char: 'capacite-de-combat', bonus: -10, label: 'Malédiction' }]);
    const sum = volatileCharLines(c, 'capacite-de-combat').reduce((s, l) => s + l.value, 0);
    expect(sum).toBe(effectiveChar(c, 'capacite-de-combat') - c.characteristics['capacite-de-combat'] - passiveCharSum(c, 'capacite-de-combat'));
  });

  it('un seul buff +10 CC → une ligne étiquetée, uncapped', () => {
    const c = mk([{ char: 'capacite-de-combat', bonus: 10, label: 'Bénédiction de Bataille' }]);
    expect(volatileCharLines(c, 'capacite-de-combat')).toEqual([{ label: 'Bénédiction de Bataille', value: 10, uncapped: true }]);
  });

  it('buffs +20/+10/−10 même carac → seules les lignes gagnantes (+20 et −10), le +10 dominé absent', () => {
    const c = mk([
      { char: 'capacite-de-combat', bonus: 20, label: 'Bénédiction de Bataille' },
      { char: 'capacite-de-combat', bonus: 10, label: 'Autre buff' },
      { char: 'capacite-de-combat', bonus: -10, label: 'Malédiction' },
    ]);
    const lines = volatileCharLines(c, 'capacite-de-combat');
    expect(lines).toEqual([
      { label: 'Bénédiction de Bataille', value: 20, uncapped: true },
      { label: 'Malédiction', value: -10, uncapped: true },
    ]);
    expect(lines.reduce((s, l) => s + l.value, 0)).toBe(10);
  });

  it('pire pénalité = séquelle (non-cumul) → ligne étiquetée du kind, valeur = worstPenalty', () => {
    const trauma = traumaById(dechirureFractureFicheId('fracture', 'majeur', 'corps'), undefined, 'corps');
    const c = mk([], 40, { traumas: [trauma] });
    const lines = volatileCharLines(c, 'force');
    expect(lines).toEqual([{ label: 'Séquelle', value: -30, uncapped: true }]);
    expect(effectiveChar(c, 'force')).toBe(40 - 30);
  });
});
