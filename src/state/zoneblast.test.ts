import { describe, it, expect } from 'vitest';
import { applyEffects } from './combatEffects';
import { hasCondition } from '../engine/conditions';
import type { Effect } from './scene';
import type { Combatant } from '../engine/types';

const hero = (id: string, current: number): Combatant =>
  ({ id, name: id, kind: 'hero', dead: false, wounds: { current, max: 30 }, advantage: 0, conditions: [] } as unknown as Combatant);

function fakeStore(party: Combatant[], partyPos: { x: number; y: number }) {
  let s: any = { battle: undefined, party, partyPos, flags: {}, journal: [], log: () => {} };
  const get = () => s;
  const set = (patch: any) => { s = { ...s, ...(typeof patch === 'function' ? patch(s) : patch) }; };
  return { get, set, state: () => s };
}

describe('zoneBlast — souffle de zone (hors combat : le groupe à partyPos)', () => {
  it('groupe DANS le rayon (Chebyshev) → dégâts + État', () => {
    const f = fakeStore([hero('A', 30)], { x: 5, y: 5 });
    applyEffects(f.get, f.set, [{ type: 'zoneBlast', center: { x: 6, y: 5 }, radius: 2, damage: '15', conditions: [{ name: 'en-flammes' }] } as Effect]);
    expect(f.state().party[0].wounds.current).toBe(15);
    expect(hasCondition(f.state().party[0], 'en-flammes')).toBe(true);
  });

  it('groupe HORS du rayon → intact', () => {
    const f = fakeStore([hero('A', 30)], { x: 20, y: 20 });
    applyEffects(f.get, f.set, [{ type: 'zoneBlast', center: { x: 5, y: 5 }, radius: 2, damage: '15' } as Effect]);
    expect(f.state().party[0].wounds.current).toBe(30);
  });
});
