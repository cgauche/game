import { describe, it, expect } from 'vitest';
import { fireConditionEffects } from './triggeredEffects';
import { addCondition, hasCondition, stacks, COND } from '../engine/conditions';
import type { Combatant } from '../engine/types';

const mk = (): Combatant => ({
  id: 'x', name: 'X', kind: 'enemy', characteristics: { E: 40 }, skills: [], talents: [], traits: [],
  conditions: [], activeEffects: [], liveTraits: [], weapons: [], armour: { corps: 5 },
  wounds: { current: 10, max: 10, base: 10 }, advantage: 0,
}) as unknown as Combatant;

describe('Empoisonné — dégâts par-round en DONNÉES (effects: onRoundEnd → wounds {stacks:self})', () => {
  const get = ((c: Combatant) => () => ({ battle: { combatants: [c] } })) as never;

  it('1 pion → 1 PB perdu, en IGNORANT BE+PA (le défaut de wounds)', () => {
    const c = mk(); addCondition(c, COND.empoisonne);
    const before = c.wounds.current;
    fireConditionEffects((get as (c: Combatant) => unknown)(c) as never, c, 'onRoundEnd', {});
    expect(before - c.wounds.current).toBe(1); // BE=4 et PA=5 IGNORÉS (sinon 0)
  });

  it('3 pions → 3 PB perdus ({stacks:self} = nombre de pions)', () => {
    const c = mk(); addCondition(c, COND.empoisonne); addCondition(c, COND.empoisonne); addCondition(c, COND.empoisonne);
    const before = c.wounds.current;
    fireConditionEffects((get as (c: Combatant) => unknown)(c) as never, c, 'onRoundEnd', {});
    expect(before - c.wounds.current).toBe(3);
  });

  it('aucun Empoisonné → aucun dégât (inerte)', () => {
    const c = mk();
    const before = c.wounds.current;
    fireConditionEffects((get as (c: Combatant) => unknown)(c) as never, c, 'onRoundEnd', {});
    expect(c.wounds.current).toBe(before);
  });
});

describe('Auto-dissipation en fin de Round en DONNÉES (effects: onRoundEnd → removeCondition)', () => {
  const get = ((c: Combatant) => () => ({ battle: { combatants: [c] } })) as never;
  const fire = (c: Combatant) =>
    fireConditionEffects((get as (c: Combatant) => unknown)(c) as never, c, 'onRoundEnd', {});

  // LDB 16 : Aveuglé (l.48) / Assourdi (l.32) / Surpris (l.136) sont retirés à la fin du Round.
  for (const name of [COND.aveugle, COND.assourdi, COND.surpris] as const) {
    it(`${name} : 1 pion retiré à la fin du Round`, () => {
      const c = mk(); addCondition(c, name);
      fire(c);
      expect(hasCondition(c, name)).toBe(false);
    });
  }

  it('Aveuglé ×2 : un SEUL pion retiré par Round (les autres restent)', () => {
    const c = mk(); addCondition(c, COND.aveugle); addCondition(c, COND.aveugle);
    fire(c);
    expect(stacks(c, COND.aveugle)).toBe(1);
  });

  it('plusieurs États qui dissipent en même temps (Aveuglé + Surpris) → chacun perd 1 pion', () => {
    const c = mk(); addCondition(c, COND.aveugle); addCondition(c, COND.surpris);
    fire(c); // l'itération snapshot la liste : retirer l'un ne saute pas l'autre
    expect(hasCondition(c, COND.aveugle)).toBe(false);
    expect(hasCondition(c, COND.surpris)).toBe(false);
  });
});
