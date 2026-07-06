import { describe, it, expect } from 'vitest';
import { outOfCombatUpkeep } from './outOfCombatUpkeep';
import { hasCondition } from '../engine/conditions';
import { applyStopBleed } from '../engine/healing';
import type { Combatant } from '../engine/types';
import type { RNG } from '../engine/dice';

const fixed = (v: number): RNG => ({ int: () => v });

function mk(opts: { current?: number; conditions?: { name: string; value: number }[]; fate?: number; advantage?: number }): Combatant {
  return {
    name: 'X', kind: 'hero',
    wounds: { current: opts.current ?? 10, max: 10 },
    advantage: opts.advantage ?? 0,
    conditions: opts.conditions ?? [],
    skills: [], // requis par le Test de Résistance d'Empoisonné, désormais résolu INLINE hors combat (RAW l.66-72)
    armour: { tete: 0, corps: 0, brasG: 0, brasD: 0, jambeG: 0, jambeD: 0 },
    characteristics: { E: 30 } as never,
    fate: opts.fate ?? 0,
  } as unknown as Combatant;
}

describe('outOfCombatUpkeep — États qui tickent HORS COMBAT (couture A, LDB 13 l.49-50)', () => {
  it('Empoisonné : perte de PB chaque Round écoulé (et perte d’Avantage via loseWounds)', () => {
    const c = mk({ current: 8, advantage: 2, conditions: [{ name: 'empoisonne', value: 1 }] });
    outOfCombatUpkeep([c], 3, fixed(50)); // 3 Rounds ; jet 50 = pas de mort par hémorragie
    expect(c.wounds.current).toBe(5); // 8 − 3×1
    expect(c.advantage).toBe(0); // perdre des PB → perte de tout l'Avantage (LDB 15 l.40)
  });

  it('Empoisonné : le Test de Résistance se résout AUSSI hors combat (RAW l.66-72) — succès → poison retiré + Exténué', () => {
    const c = mk({ current: 8, conditions: [{ name: 'empoisonne', value: 1 }] });
    outOfCombatUpkeep([c], 1, fixed(5)); // jet 5 ≤ cible (E 30 −10 État = 20) → Résistance réussie
    expect(c.wounds.current).toBe(7);              // 1 dégât périodique appliqué AVANT le Test
    expect(hasCondition(c, 'empoisonne')).toBe(false); // poison vaincu (branche success : retire 1+DR)
    expect(hasCondition(c, 'extenue')).toBe(true);     // vidé → 1 Exténué
  });

  it('aucun effet périodique ni 0 PB → no-op (rien ne ticke)', () => {
    const c = mk({ current: 8 });
    expect(outOfCombatUpkeep([c], 10, fixed(50))).toEqual([]);
    expect(c.wounds.current).toBe(8);
  });

  it('tombe à 0 PB par poison → À Terre + progression d’agonie', () => {
    const c = mk({ current: 2, conditions: [{ name: 'empoisonne', value: 1 }] });
    outOfCombatUpkeep([c], 5, fixed(50));
    expect(c.wounds.current).toBe(0);
    expect(hasCondition(c, 'a-terre')).toBe(true);
  });

  it('Hémorragique mortel hors combat : un héros à Destin est sauvé (Point consommé)', () => {
    const c = mk({ current: 3, conditions: [{ name: 'hemorragique', value: 3 }], fate: 1 });
    outOfCombatUpkeep([c], 1, fixed(5)); // jet 5 (non-double) ≤ 30 → mort, sauf Destin
    expect(c.dead).toBeFalsy();
    expect(c.fate).toBe(0);
    expect(c.wounds.current).toBeGreaterThanOrEqual(1);
  });

  it('Hémorragique mortel sans Destin → mort', () => {
    const c = mk({ current: 3, conditions: [{ name: 'hemorragique', value: 3 }], fate: 0 });
    outOfCombatUpkeep([c], 1, fixed(5));
    expect(c.dead).toBe(true);
  });

  it('Premiers Secours hors combat (infirmerie, Test de Guérison réussi retire l’État, LDB 09-Compétences l.261 / 16-États l.107-109) évite la mort SANS consommer de Destin', () => {
    const c = mk({ current: 3, conditions: [{ name: 'hemorragique', value: 3 }], fate: 0 });
    applyStopBleed(c, 2); // panse : Test de Guérison réussi, DR 2 → retire 1+2 = 3 pions (tous)
    expect(hasCondition(c, 'hemorragique')).toBe(false);
    outOfCombatUpkeep([c], 1, fixed(5)); // même jet qui, non traité, tue le cas précédent
    expect(c.dead).toBeFalsy();
    expect(c.fate).toBe(0); // aucun Destin consommé : le soin a suffi
  });
});
