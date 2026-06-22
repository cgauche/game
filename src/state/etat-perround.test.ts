import { describe, it, expect } from 'vitest';
import { fireConditionEffects } from './triggeredEffects';
import { addCondition, COND } from '../engine/conditions';
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
