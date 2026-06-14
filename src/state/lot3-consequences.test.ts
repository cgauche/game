import { describe, it, expect } from 'vitest';
import { applyEffects } from './combatEffects';
import { hasCondition } from '../engine/conditions';
import type { Effect } from './scene';
import type { Combatant } from '../engine/types';

const hero = (id: string, current: number): Combatant =>
  ({ id, name: id, kind: 'hero', dead: false, wounds: { current, max: 20 }, advantage: 0, conditions: [] } as unknown as Combatant);

function fakeStore(party: Combatant[]) {
  let s: any = { battle: undefined, party, flags: {}, journal: [], log: () => {} };
  const get = () => s;
  const set = (patch: any) => { s = { ...s, ...(typeof patch === 'function' ? patch(s) : patch) }; };
  return { get, set, state: () => s };
}

describe('Lot 3 — conséquences hors combat (inflictDamage / applyCondition)', () => {
  it('inflictDamage target=party : chaque héros vivant perd `amount` PB', () => {
    const f = fakeStore([hero('A', 12), hero('B', 5)]);
    applyEffects(f.get, f.set, [{ type: 'inflictDamage', target: 'party', amount: 8 } as Effect]);
    expect(f.state().party[0].wounds.current).toBe(4);
    expect(f.state().party[1].wounds.current).toBe(0); // À Terre via loseWounds
  });

  it('inflictDamage target=hero : seul le héros désigné est touché', () => {
    const f = fakeStore([hero('A', 12), hero('B', 12)]);
    applyEffects(f.get, f.set, [{ type: 'inflictDamage', target: 'hero', heroId: 'B', amount: 5 } as Effect]);
    expect(f.state().party[0].wounds.current).toBe(12);
    expect(f.state().party[1].wounds.current).toBe(7);
  });

  it('applyCondition target=party : pose l’État sur tout le groupe (valeur par défaut 1)', () => {
    const f = fakeStore([hero('A', 12), hero('B', 12)]);
    applyEffects(f.get, f.set, [{ type: 'applyCondition', target: 'party', name: 'En flammes' } as Effect]);
    expect(hasCondition(f.state().party[0], 'En flammes')).toBe(true);
    expect(hasCondition(f.state().party[1], 'En flammes')).toBe(true);
  });

  it('applyCondition value : pose l’intensité demandée sur un héros', () => {
    const f = fakeStore([hero('A', 12)]);
    applyEffects(f.get, f.set, [{ type: 'applyCondition', target: 'hero', name: 'Empoisonné', value: 3 } as Effect]);
    expect(f.state().party[0].conditions.find((c: any) => c.name === 'Empoisonné')?.value).toBe(3);
  });
});
