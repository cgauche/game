import { describe, it, expect } from 'vitest';
import { testValue } from './skills';
import type { Combatant } from './types';

function mk(opts: Partial<Combatant> = {}): Combatant {
  return {
    id: 'c', name: 'c', kind: 'hero',
    characteristics: { CC: 35, CT: 30, F: 30, E: 30, I: 30, Ag: 35, Dex: 30, Int: 30, FM: 30, Soc: 30 } as never,
    conditions: [], skills: [], talents: [], items: [], activeEffects: [],
    advantage: 0, armour: {} as never, weapons: [], movement: 4, wounds: { current: 10, max: 10 },
    ...opts,
  } as Combatant;
}

describe('testValue HORS COMBAT — mêmes modulations qu’en combat (audit, LDB 16/18/61)', () => {
  it('État Empoisonné → −10 (LDB 16 l.66)', () => {
    expect(testValue(mk({ conditions: [{ name: 'Empoisonné', value: 1 }] }), undefined, 'Int')).toBe(20); // 30 − 10
  });

  it('État Exténué ×2 → −20 (LDB 16 l.18/89)', () => {
    expect(testValue(mk({ conditions: [{ name: 'Exténué', value: 2 }] }), undefined, 'Int')).toBe(10); // 30 − 20
  });

  it('Non-cumul (LDB 16 l.20) : Brisé(−10) + Exténué×2(−20) → −20 seulement', () => {
    const c = mk({ conditions: [{ name: 'Brisé', value: 1 }, { name: 'Exténué', value: 2 }] });
    expect(testValue(c, undefined, 'Int')).toBe(10); // 30 − 20 (la pire), pas −30
  });

  it('Brisé : −10 sur un Test normal, EXEMPTÉ pour course (Athlétisme) / dissimulation (Discrétion) (l.55)', () => {
    const broke = mk({ conditions: [{ name: 'Brisé', value: 1 }] });
    const ok = mk();
    expect(testValue(ok, 'Perception') - testValue(broke, 'Perception')).toBe(10); // Test normal pénalisé
    expect(testValue(broke, 'Athlétisme')).toBe(testValue(ok, 'Athlétisme')); // course → pas de malus
    expect(testValue(broke, 'Discrétion')).toBe(testValue(ok, 'Discrétion')); // dissimulation → pas de malus
  });

  it('Caractéristique EFFECTIVE : un malus actif (effet/Traumatisme via effectiveChar) baisse la valeur (LDB 18)', () => {
    const c = mk({ activeEffects: [{ char: 'F', bonus: -10 }] as never });
    expect(testValue(c, undefined, 'F')).toBe(20); // 30 − 10 (effectiveChar)
  });

  it('Encombrement : Surchargé → −10 sur un Test d’Agilité (LDB 61)', () => {
    const heavy = mk({ items: [{ enc: 10, qualities: [] } as never] }); // capacité = BF+BE = 3+3 = 6 ; 10 > 6 → palier 1
    expect(testValue(mk(), undefined, 'Ag') - testValue(heavy, undefined, 'Ag')).toBe(10);
    // l'Encombrement ne touche QUE l'Agilité, pas les autres caractéristiques :
    expect(testValue(heavy, undefined, 'Int')).toBe(testValue(mk(), undefined, 'Int'));
  });

  it('combattant sain → valeur brute (aucune régression)', () => {
    expect(testValue(mk(), undefined, 'Int')).toBe(30);
    expect(testValue(mk({ skills: [{ skillId: 'perception', advances: 10 } as never] }), 'Perception')).toBeGreaterThanOrEqual(30);
  });
});
