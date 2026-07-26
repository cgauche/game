/**
 * Surincantation — math PURE source-aware (RAW verbatim) :
 *  - Arcane  (LDB 47 l.13-17) : par +2 DR au-dessus du NI → +VALEUR INITIALE sur Portée/ZdE/Durée/Cible (×initial).
 *  - Miracle (LDB 42 l.7-13)  : par +2 DR (DR entier, pas de NI) → +initial Portée/Durée/Cible. Pas de ZdE.
 *  - Bénédiction (LDB 41 l.21-27) : par +2 DR → +6 m Portée / +1 Cible / +6 Rounds Durée (FIXE). Pas de ZdE.
 * Les exemples du livre sont encodés tels quels comme cas de test.
 */
import { describe, it, expect } from 'vitest';
import { setRule, resetRule } from './policy';
import {
  overcastSourceOf, overcastAxes, extraTargetCapacity,
  effectiveDurationRounds, effectiveRangeMetres, overcastDurationParts, overcastStepCost,
} from './overcast';

describe('overcastSourceOf — dérivé de la famille du sort (aucun champ ajouté)', () => {
  it('beni → bénédiction ; invocation → miracle ; arcane/domaine/chaos → arcane', () => {
    expect(overcastSourceOf({ family: 'beni' })).toBe('blessing');
    expect(overcastSourceOf({ family: 'invocation' })).toBe('miracle');
    expect(overcastSourceOf({ family: 'arcane' })).toBe('arcane');
    expect(overcastSourceOf({ family: 'mineure' })).toBe('arcane');
    expect(overcastSourceOf({ family: 'feu' })).toBe('arcane');
    expect(overcastSourceOf({ family: 'chaos' })).toBe('arcane');
  });
});

describe('overcastAxes — ZdE réservée à l’arcane (RAW : ni Bénédiction ni Miracle n’ont de ZdE)', () => {
  it('arcane = 4 axes (Portée/ZdE/Durée/Cible) ; divin = 3 (sans ZdE)', () => {
    expect(overcastAxes('arcane')).toEqual(['range', 'zone', 'duration', 'targets']);
    expect(overcastAxes('miracle')).toEqual(['range', 'duration', 'targets']);
    expect(overcastAxes('blessing')).toEqual(['range', 'duration', 'targets']);
  });
  it('l’axe Dégâts n’existe qu’au Projectile magique, sous VDM (`VDM 02 l.198`)', () => {
    expect(overcastAxes('arcane', true)).toEqual(['range', 'zone', 'duration', 'targets']); // option OFF : pas d'axe Dégâts
    expect(overcastAxes('arcane', false)).toEqual(['range', 'zone', 'duration', 'targets']); // non-missile : jamais
    setRule('magic-vdm-incantation', true);
    expect(overcastAxes('arcane', true)).toEqual(['range', 'zone', 'duration', 'targets', 'damage']);
    expect(overcastAxes('arcane', false)).toEqual(['range', 'zone', 'duration', 'targets']); // non-missile, même sous VDM
    expect(overcastAxes('miracle', true)).toEqual(['range', 'duration', 'targets']); // Miracle jamais VDM
    resetRule('magic-vdm-incantation');
  });
});

describe('overcastStepCost — coût en DR d’un pas, dérivé du même overcastModel (VDM 02 l.196-201)', () => {
  it('LDB (option OFF) : 2 DR par pas ; VDM (option ON) : 1 DR par pas', () => {
    expect(overcastStepCost('arcane')).toBe(2);
    setRule('magic-vdm-incantation', true);
    expect(overcastStepCost('arcane')).toBe(1);
    resetRule('magic-vdm-incantation');
    expect(overcastStepCost('arcane')).toBe(2);
  });
  it('Bénédiction/Miracle ne sont jamais VDM : toujours 2 DR par pas', () => {
    setRule('magic-vdm-incantation', true);
    expect(overcastStepCost('blessing')).toBe(2);
    expect(overcastStepCost('miracle')).toBe(2);
    resetRule('magic-vdm-incantation');
  });
});

describe('extraTargetCapacity — cibles SUPPLÉMENTAIRES par pas', () => {
  it('arcane/miracle = pas × valeur initiale (×initial)', () => {
    // LDB 47 l.17 : +4 DR (2 pas) sur un Sort de Cible 1 → « cibler 3 individus » = 1 + 2 supplémentaires.
    expect(extraTargetCapacity('arcane', 2, 1)).toBe(2);
    // Sort arcane multi-cibles (initial 2) : 1 pas → +2 supplémentaires (×initial), PAS +1.
    expect(extraTargetCapacity('arcane', 1, 2)).toBe(2);
    expect(extraTargetCapacity('miracle', 2, 1)).toBe(2);
  });
  it('bénédiction = +1 par pas (FIXE), quelle que soit la cible initiale', () => {
    // LDB 41 l.27 : +4 DR (2 pas) sur Guérison → « guérir trois cibles » = 1 + 2.
    expect(extraTargetCapacity('blessing', 2, 1)).toBe(2);
    expect(extraTargetCapacity('blessing', 1, 3)).toBe(1); // +1 même si l'initiale vaut 3
  });
});

describe('effectiveDurationRounds — ×initial (arcane/miracle) vs +6 Rounds FIXE (bénédiction)', () => {
  it('arcane/miracle : base × (1 + pas)', () => {
    expect(effectiveDurationRounds('arcane', 4, 0)).toBe(4);
    expect(effectiveDurationRounds('arcane', 4, 2)).toBe(12); // 4 × 3
    expect(effectiveDurationRounds('miracle', 6, 1)).toBe(12); // 6 × 2
  });
  it('bénédiction : base + 6 × pas (FIXE) — diverge de ×initial dès que base ≠ 6', () => {
    expect(effectiveDurationRounds('blessing', 6, 1)).toBe(12); // 6 + 6 (= ×2 par coïncidence)
    expect(effectiveDurationRounds('blessing', 4, 1)).toBe(10); // 4 + 6 (PAS 8 = ×2)
    expect(effectiveDurationRounds('blessing', 4, 2)).toBe(16); // 4 + 12
  });
});

describe('overcastDurationParts — décomposition mult/bonus pour applyCast', () => {
  it('arcane/miracle : mult = 1+pas, bonus = 0 ; bénédiction : mult = 1, bonus = 6×pas', () => {
    expect(overcastDurationParts('arcane', 2)).toEqual({ mult: 3, bonusRounds: 0 });
    expect(overcastDurationParts('miracle', 1)).toEqual({ mult: 2, bonusRounds: 0 });
    expect(overcastDurationParts('blessing', 2)).toEqual({ mult: 1, bonusRounds: 12 });
    // cohérence avec effectiveDurationRounds : base×mult + bonus
    const p = overcastDurationParts('blessing', 2);
    expect(4 * p.mult + p.bonusRounds).toBe(effectiveDurationRounds('blessing', 4, 2));
  });
});

describe('effectiveRangeMetres — ×initial (arcane/miracle) vs +6 m FIXE (bénédiction)', () => {
  it('arcane/miracle : base × (1 + pas)', () => {
    expect(effectiveRangeMetres('arcane', 50, 1)).toBe(100); // LDB 42 l.9 (miracle) : 50 m → +50 par +2 DR
    expect(effectiveRangeMetres('miracle', 50, 1)).toBe(100);
  });
  it('bénédiction : base + 6 m × pas (FIXE) — étend même une portée Contact (0 m)', () => {
    // LDB 41 l.27 : Guérison (Contact, 0 m) → « 1 cible jusqu’à 12 mètres » avec 2 pas de Portée.
    expect(effectiveRangeMetres('blessing', 0, 2)).toBe(12);
    expect(effectiveRangeMetres('blessing', 6, 1)).toBe(12);
  });
});
