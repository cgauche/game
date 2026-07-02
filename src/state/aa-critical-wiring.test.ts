import { describe, it, expect, afterEach } from 'vitest';
import { applyCriticalToTarget } from './combatFlow';
import { resolveAACritical } from '../engine/aaCritical';
import { inDeathCondition } from '../engine/conditions';
import { setRule, resetRule } from '../engine/policy';
import { seedBattleRng } from './battleRng';
import type { Combatant } from '../engine/types';
import type { RNG } from '../engine/dice';

/**
 * #38 — BRANCHEMENTS runtime du système ALTERNATIF de Blessures d'Aux Armes (`combat-aa-blessures=aa`).
 * Prouve que le toggle change le comportement de bout en bout au SITE DE RÉSOLUTION (`applyCriticalToTarget`)
 * et à la CONDITION DE MORT (`inDeathCondition`) :
 *  - un Critique TRIVIAL (« T », AA l.2521) n'incrémente PAS `criticalWounds` (pas compté pour la mort) ;
 *  - un Coup Critique sur DOUBLE s'applique même s'il RESTE des Blessures (AA l.2473 ≡ LDB 13 l.183) ;
 *  - la mort par accumulation (AA l.2517) route par `aaDeathByCriticalCount` en mode AA.
 */
const seq = (...vals: number[]): RNG => {
  let i = 0;
  return { int: (min, max) => Math.min(max, Math.max(min, vals[i++ % vals.length])) };
};

const CHARS = { CC: 40, CT: 40, F: 40, E: 30, I: 30, Ag: 30, Dex: 30, Int: 30, FM: 30, Soc: 30 };
const mk = (over: Partial<Combatant> = {}): Combatant =>
  ({ id: 't', name: 'Cible', kind: 'enemy', characteristics: CHARS, wounds: { current: 10, max: 10 }, conditions: [], skills: [], bodyShape: 'humanoide', size: 'moyenne', weapons: [], items: [], armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 }, ...over } as unknown as Combatant);

const noop = () => {};

describe('#38 — branchements AA au site de résolution (applyCriticalToTarget)', () => {
  afterEach(() => resetRule('combat-aa-blessures'));

  it('Critique TRIVIAL (« T », l.2521) : n’incrémente PAS criticalWounds', () => {
    seedBattleRng(1);
    setRule('combat-aa-blessures', 'aa');
    const target = mk();
    // brasD d100 5 → « Choc au poignet » (01-10) = trivial « T ».
    const crit = resolveAACritical(target, 'brasD', seq(5), 0);
    expect(crit.roll).toBe(5);
    applyCriticalToTarget(target, 'brasD', true, 0, [], noop, { prerolled: crit });
    expect(target.criticalWounds ?? 0).toBe(0); // trivial → non compté pour la mort
  });

  it('Critique NON trivial : incrémente criticalWounds', () => {
    seedBattleRng(1);
    setRule('combat-aa-blessures', 'aa');
    const target = mk();
    // brasD d100 25 → « Coupure mineure » (21-25) = 1 Blessure (pas trivial).
    const crit = resolveAACritical(target, 'brasD', seq(25), 0);
    applyCriticalToTarget(target, 'brasD', true, 0, [], noop, { prerolled: crit });
    expect(target.criticalWounds ?? 0).toBe(1);
  });

  it('Coup Critique sur DOUBLE même avec PB restants (l.2473) : crit appliqué, il reste des Blessures', () => {
    seedBattleRng(1);
    setRule('combat-aa-blessures', 'aa');
    const target = mk({ wounds: { current: 10, max: 10 } });
    // Coup Critique (double) sans overkill : la cible a 10 PB → le Critique s'applique quand même.
    const crit = resolveAACritical(target, 'brasD', seq(25), 0); // 1 Blessure supplémentaire
    applyCriticalToTarget(target, 'brasD', true, 0, [], noop, { prerolled: crit });
    expect(target.criticalWounds ?? 0).toBe(1);          // Critique bien infligé
    expect(target.wounds.current).toBeGreaterThan(0);    // … alors qu’il RESTE des Blessures (PB > 0)
  });

  it('mode LDB (défaut) : un Critique trivial de la table AA n’existe pas → tout Critique compte', () => {
    seedBattleRng(1);
    // En LDB, aucune notion de trivial : le décompte incrémente toujours.
    const target = mk();
    const crit = resolveAACritical(target, 'brasD', seq(5), 0); // table AA, mais rule=ldb → pas d’exclusion
    applyCriticalToTarget(target, 'brasD', true, 0, [], noop, { prerolled: crit });
    expect(target.criticalWounds ?? 0).toBe(1); // compté (le garde-fou trivial ne s’active qu’en mode AA)
  });
});

describe('#38 — mort par accumulation de Blessures Critiques (inDeathCondition, l.2517)', () => {
  afterEach(() => resetRule('combat-aa-blessures'));

  const dying = (cw: number): Combatant =>
    mk({ wounds: { current: 0, max: 10 }, conditions: [{ name: 'inconscient', value: 1 }] as never, criticalWounds: cw });

  it('mode AA : Inconscient + 0 PB + Blessures Critiques > BE → mort (route par aaDeathByCriticalCount)', () => {
    setRule('combat-aa-blessures', 'aa');
    expect(inDeathCondition(dying(4))).toBe(true);   // 4 > BE 3
    expect(inDeathCondition(dying(3))).toBe(false);  // 3 n’est pas > 3
    expect(inDeathCondition(mk({ wounds: { current: 5, max: 10 }, conditions: [{ name: 'inconscient', value: 1 }] as never, criticalWounds: 4 }))).toBe(false); // PB > 0
  });

  it('même formule qu’en LDB (l.34 ≡ l.2517) : comportement identique', () => {
    resetRule('combat-aa-blessures');
    expect(inDeathCondition(dying(4))).toBe(true);
    expect(inDeathCondition(dying(3))).toBe(false);
  });
});
