import { describe, it, expect } from 'vitest';
import { computeStateVisible, computeStateVisibleAndLight, recordExplored, setRevealAll } from './visionState';
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

describe('computeStateVisibleAndLight — vue + lumière en un seul calcul (mutualise sceneLightField)', () => {
  it('le `visible` est IDENTIQUE à computeStateVisible pour la même entrée, + un champ de lumière utilisable', () => {
    const s = scene(6, 1, [{ x: 2, y: 0, side: 'E' }]);
    const input = { scene: s, battle: null, party: [hero(0, 0)], partyPos: { x: 0, y: 0 }, gameTime: DAY, lightLevel: null };
    const only = computeStateVisible(input);
    const both = computeStateVisibleAndLight(input);
    expect([...both.visible].sort()).toEqual([...only].sort());
    expect(typeof both.light.at(0, 0)).toBe('number'); // lumière exploitable (voile d'éclairage des sols)
  });

  it('scène absente : `visible` vide + lumière PLATE valide (jamais undefined)', () => {
    const both = computeStateVisibleAndLight({ scene: null, battle: null, party: [], partyPos: { x: 0, y: 0 }, gameTime: DAY, lightLevel: null });
    expect(both.visible.size).toBe(0);
    expect(both.light.at(0, 0)).toBe(1);
  });
});

describe('REVEAL_ALL (brouillard OFF) — le `visible` de la carte entière garde son IDENTITÉ par scène', () => {
  // L'identité du Set compte autant que son contenu : c'est ELLE que les memos du rendu observent
  // (`buildFloors`/`buildWalls` la reçoivent via `visible`). Un Set réalloué à chaque pas leur fait
  // reprojeter toute la carte et vide le cache d'éléments de `CulledScene` — mesuré sur « La Diligence ».
  const withRevealAll = <T>(run: () => T): T => {
    setRevealAll(true);
    try { return run(); } finally { setRevealAll(false); }
  };

  it('deux pas consécutifs sur la MÊME scène rendent le MÊME Set (référence), couvrant toutes les cases', () => {
    const s = scene(4, 3);
    const [a, b] = withRevealAll(() => [
      computeStateVisibleAndLight({ scene: s, battle: null, party: [hero(0, 0)], partyPos: { x: 0, y: 0 }, gameTime: DAY, lightLevel: null }).visible,
      computeStateVisibleAndLight({ scene: s, battle: null, party: [hero(1, 0)], partyPos: { x: 1, y: 0 }, gameTime: DAY, lightLevel: null }).visible,
    ]);
    expect(b).toBe(a); // ← échoue si `allTiles` n'est plus mémoïsé par référence de scène
    expect(a.size).toBe(4 * 3);
    expect(a.has('3,2,0')).toBe(true);
  });

  it('une AUTRE scène rend un Set DISTINCT, dimensionné pour elle (le cache ne fuit pas d’une scène à l’autre)', () => {
    const s1 = scene(4, 3);
    const s2 = scene(2, 2);
    const [a, c] = withRevealAll(() => [
      computeStateVisibleAndLight({ scene: s1, battle: null, party: [], partyPos: { x: 0, y: 0 }, gameTime: DAY, lightLevel: null }).visible,
      computeStateVisibleAndLight({ scene: s2, battle: null, party: [], partyPos: { x: 0, y: 0 }, gameTime: DAY, lightLevel: null }).visible,
    ]);
    expect(c).not.toBe(a);
    expect(c.size).toBe(2 * 2);
    expect(c.has('3,2,0')).toBe(false);
  });

  it('le brouillard REVENU redonne la vue calculée, pas la carte entière', () => {
    const s = scene(6, 1, [{ x: 2, y: 0, side: 'E' }]);
    withRevealAll(() => computeStateVisibleAndLight({ scene: s, battle: null, party: [hero(0, 0)], partyPos: { x: 0, y: 0 }, gameTime: DAY, lightLevel: null }));
    const vis = computeStateVisible({ scene: s, battle: null, party: [hero(0, 0)], partyPos: { x: 0, y: 0 }, gameTime: DAY, lightLevel: null });
    expect(vis.has('5,0,0')).toBe(false); // derrière l'arête murée : le mur occulte de nouveau
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
