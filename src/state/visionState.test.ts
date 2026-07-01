import { describe, it, expect } from 'vitest';
import { computeStateVisible, recordExplored } from './visionState';
import { Scene, WallSeg } from './scene';
import type { Combatant } from '../engine/types';

const DAY = 12 * 60;

function scene(w: number, h: number, walls?: WallSeg[]): Scene {
  return {
    id: 's1',
    name: 's',
    dimensions: { w, h },
    ambiance: 'exterieur',
    layers: [{ z: 0, tiles: new Array(w * h).fill('herbe') }],
    entities: [],
   
    dialogues: [],
    triggers: [],
    encounters: [],
    walls,
  } as unknown as Scene;
}

const hero = (x: number, y: number): Combatant =>
  ({ id: `h${x}${y}`, kind: 'hero', pos: { x, y }, wounds: { current: 10, max: 10 }, conditions: [], traits: [], talents: [] }) as unknown as Combatant;

describe('computeStateVisible — exploration', () => {
  it('voit dans le rayon, bloqué par un mur', () => {
    const s = scene(6, 1, [{ x: 2, y: 0, side: 'E' }]); // arête (2,0)|(3,0)
    const vis = computeStateVisible({ scene: s, battle: null, party: [hero(0, 0)], partyPos: { x: 0, y: 0 }, gameTime: DAY, lightLevel: null });
    expect(vis.has('0,0,0')).toBe(true);
    expect(vis.has('2,0,0')).toBe(true);
    expect(vis.has('3,0,0')).toBe(false); // derrière le mur
  });
});

describe('computeStateVisible — combat (union des héros vivants)', () => {
  it('un héros de chaque côté du mur → union couvre les deux côtés', () => {
    const s = scene(6, 1, [{ x: 2, y: 0, side: 'E' }]);
    const battle = { combatants: [hero(0, 0), hero(5, 0)] } as any;
    const vis = computeStateVisible({ scene: s, battle, party: [], partyPos: { x: 0, y: 0 }, gameTime: DAY, lightLevel: null });
    expect(vis.has('2,0,0')).toBe(true); // vu par le héros A
    expect(vis.has('3,0,0')).toBe(true); // vu par le héros B (de l'autre côté)
  });
  it('un héros à terre ne voit pas', () => {
    const down = { ...hero(5, 0), dead: true } as Combatant;
    const s = scene(6, 1, [{ x: 2, y: 0, side: 'E' }]);
    const battle = { combatants: [hero(0, 0), down] } as any;
    const vis = computeStateVisible({ scene: s, battle, party: [], partyPos: { x: 0, y: 0 }, gameTime: DAY, lightLevel: null });
    expect(vis.has('3,0,0')).toBe(false); // le seul à voir derrière le mur est à terre
  });
});

describe('recordExplored — accumulation persistante par scène', () => {
  function mockStore(scene: Scene | null, explored: Record<string, string[]> = {}) {
    const state: any = { scene, explored };
    return { get: () => state, set: (p: any) => Object.assign(state, p), state };
  }
  it('accumule sans perdre l\'ancien', () => {
    const { get, set, state } = mockStore(scene(6, 1));
    recordExplored(get, set, ['1,0,0', '2,0,0']);
    recordExplored(get, set, ['2,0,0', '3,0,0']);
    expect(new Set(state.explored.s1)).toEqual(new Set(['1,0,0', '2,0,0', '3,0,0']));
  });
  it('garde les scènes séparées', () => {
    const { get, set, state } = mockStore(scene(6, 1), { autre: ['9,9,0'] });
    recordExplored(get, set, ['1,0,0']);
    expect(state.explored.autre).toEqual(['9,9,0']);
    expect(state.explored.s1).toEqual(['1,0,0']);
  });
});
