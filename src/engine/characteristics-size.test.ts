import { describe, it, expect } from 'vitest';
import { maxWounds, effectiveMaxWounds, refreshWounds } from './characteristics';
import { Characteristics, Combatant } from './types';

describe('maxWounds par catégorie de Taille (LDB 85 l.332-352)', () => {
  const chars = { F: 35, E: 40, FM: 30 } as Characteristics; // BF3, BE4, BFM3 → Moyenne 14
  it('Moyenne = formule (défaut)', () => expect(maxWounds(chars, 'moyenne')).toBe(14));
  it('Petite = 2BE+BFM', () => expect(maxWounds(chars, 'petite')).toBe(11));
  it('Grande = ×2', () => expect(maxWounds(chars, 'grande')).toBe(28));
  it('Énorme = ×4', () => expect(maxWounds(chars, 'enorme')).toBe(56));
});

describe('effectiveMaxWounds — base + delta des buffs F/E/FM × Taille', () => {
  const base = (over: Partial<Combatant> = {}): Combatant =>
    ({
      characteristics: { F: 30, E: 30, FM: 30 } as Characteristics,
      size: 'moyenne',
      wounds: { current: 10, max: 12, base: 12 },
      activeEffects: [],
      ...over,
    }) as unknown as Combatant;

  it('sans buff : = wounds.base (préserve une surcharge / valeur livre)', () => {
    // base 12 alors que la formule donnerait 9 (BF3? non : F30→BF3, E30→BE3, FM30→BFM3 → 3+6+3=12). Ici base==formule.
    expect(effectiveMaxWounds(base())).toBe(12);
  });
  it('surcharge préservée à vide : base 20 (≠ formule) reste 20', () => {
    expect(effectiveMaxWounds(base({ wounds: { current: 20, max: 20, base: 20 } }))).toBe(20);
  });
  it('buff +10 Endurance → +2 Blessures (Moyenne)', () => {
    const c = base({ activeEffects: [{ label: 'Soin', char: 'E', bonus: 10, duration: { scale: 'rounds', left: 3 } }] });
    expect(effectiveMaxWounds(c)).toBe(14); // base 12 + (BE 4 vs 3 → +2)
  });
  it('buff +10 E sur un Énorme → +2×4 = +8 (delta ×Taille)', () => {
    const c = base({ size: 'enorme', wounds: { current: 48, max: 48, base: 48 }, activeEffects: [{ label: 'Soin', char: 'E', bonus: 10, duration: { scale: 'rounds', left: 3 } }] });
    expect(effectiveMaxWounds(c)).toBe(56); // 48 + (woundsForSize(...,enorme) delta = +8)
  });
});

describe('refreshWounds — recale max + ajuste current (buff/expiration)', () => {
  it('un buff +E monte max ET current ; l’expiration les redescend (clamp ≥0)', () => {
    const c = {
      characteristics: { F: 30, E: 30, FM: 30 } as Characteristics,
      size: 'moyenne',
      wounds: { current: 10, max: 12, base: 12 },
      activeEffects: [{ label: 'Soin', char: 'E', bonus: 10, duration: { scale: 'rounds', left: 3 } }],
    } as unknown as Combatant;
    refreshWounds(c);
    expect(c.wounds.max).toBe(14); // +2 (BE 4 vs 3)
    expect(c.wounds.current).toBe(12); // 10 + 2 (gagne des PB)
    c.activeEffects = []; // effet dissipé
    refreshWounds(c);
    expect(c.wounds.max).toBe(12);
    expect(c.wounds.current).toBe(10); // 12 − 2 (en perd)
  });
});
