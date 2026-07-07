import { describe, it, expect } from 'vitest';
import { effectiveChar, volatileCharLines } from './characteristics';
import { passiveCharSum, traumaById, dechirureFractureFicheId } from './trauma';
import type { Combatant, CharKey } from './types';

/** Combatant minimal : seuls `characteristics` et `activeEffects` importent ici (pool non-cumul). */
function mk(activeEffects: { char: CharKey; bonus: number; label?: string }[] = [], F = 40, over: Partial<Combatant> = {}): Combatant {
  return {
    id: 'c', name: 'c', kind: 'enemy', advantage: 0, conditions: [],
    characteristics: { F, Ag: 30, CC: 40 } as never,
    activeEffects: activeEffects.map((e) => ({ label: e.label ?? 'Effet', ...e })) as never,
    psychState: [], psychTraits: [], groups: [], weapons: [], armour: {} as never,
    skills: [], talents: [], movement: 4, wounds: { current: 10, max: 10 },
    ...over,
  } as Combatant;
}

describe('effectiveChar — non-cumul des modificateurs (LDB l.168 : meilleur bonus + pire pénalité, sommés)', () => {
  it('aucun effet actif → valeur de base', () => {
    expect(effectiveChar(mk(), 'F')).toBe(40);
  });
  it('plusieurs bonus → seul le MEILLEUR s’applique (+20, +10 → +20)', () => {
    expect(effectiveChar(mk([{ char: 'F', bonus: 20 }, { char: 'F', bonus: 10 }]), 'F')).toBe(60);
  });
  it('plusieurs pénalités → seule la PIRE s’applique (−10, −20 → −20)', () => {
    expect(effectiveChar(mk([{ char: 'F', bonus: -10 }, { char: 'F', bonus: -20 }]), 'F')).toBe(20);
  });
  it('mélange → meilleur bonus + pire pénalité (+20, +10, −10 → +10 net)', () => {
    expect(effectiveChar(mk([{ char: 'F', bonus: 20 }, { char: 'F', bonus: 10 }, { char: 'F', bonus: -10 }]), 'F')).toBe(50);
  });
  it('effets ciblant une AUTRE caractéristique → ignorés', () => {
    expect(effectiveChar(mk([{ char: 'Ag', bonus: 30 }]), 'F')).toBe(40);
  });
});

describe('volatileCharLines — décomposition étiquetée du pool non-cumul (issue #202)', () => {
  it('invariant : Σ(lines.value) = effectiveChar − characteristics − passiveCharSum, pour tout combattant', () => {
    const c = mk([{ char: 'CC', bonus: 20, label: 'Bénédiction de Bataille' }, { char: 'CC', bonus: 10, label: 'Autre buff' }, { char: 'CC', bonus: -10, label: 'Malédiction' }]);
    const sum = volatileCharLines(c, 'CC').reduce((s, l) => s + l.value, 0);
    expect(sum).toBe(effectiveChar(c, 'CC') - c.characteristics.CC - passiveCharSum(c, 'CC'));
  });

  it('un seul buff +10 CC → une ligne étiquetée, uncapped', () => {
    const c = mk([{ char: 'CC', bonus: 10, label: 'Bénédiction de Bataille' }]);
    expect(volatileCharLines(c, 'CC')).toEqual([{ label: 'Bénédiction de Bataille', value: 10, uncapped: true }]);
  });

  it('buffs +20/+10/−10 même carac → seules les lignes gagnantes (+20 et −10), le +10 dominé absent', () => {
    const c = mk([
      { char: 'CC', bonus: 20, label: 'Bénédiction de Bataille' },
      { char: 'CC', bonus: 10, label: 'Autre buff' },
      { char: 'CC', bonus: -10, label: 'Malédiction' },
    ]);
    const lines = volatileCharLines(c, 'CC');
    expect(lines).toEqual([
      { label: 'Bénédiction de Bataille', value: 20, uncapped: true },
      { label: 'Malédiction', value: -10, uncapped: true },
    ]);
    expect(lines.reduce((s, l) => s + l.value, 0)).toBe(10);
  });

  it('pire pénalité = séquelle (non-cumul) → ligne étiquetée du kind, valeur = worstPenalty', () => {
    const trauma = traumaById(dechirureFractureFicheId('fracture', 'majeur', 'corps'), undefined, 'corps');
    const c = mk([], 40, { traumas: [trauma] });
    const lines = volatileCharLines(c, 'F');
    expect(lines).toEqual([{ label: 'Séquelle', value: -30, uncapped: true }]);
    expect(effectiveChar(c, 'F')).toBe(40 - 30);
  });
});
