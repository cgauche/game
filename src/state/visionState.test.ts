import { describe, it, expect } from 'vitest';
import { computeStateVisible, computeStateVisibleAndLight, recordExplored, sceneLightField, sceneLightSources, setRevealAll } from './visionState';
import { computeLightField, type LightSource } from './vision';
import { diligenceCampaign } from '../scenes/campaign';
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

/** Héros porteur d'une lanterne — `equipped` décide du PORT (le gate de `combatantLights`). */
const porteur = (id: string, x: number, y: number, equipped: boolean): Combatant =>
  ({ id, kind: 'hero', pos: { x, y }, wounds: { current: 10, max: 10 }, conditions: [], traits: [], talents: [],
    items: [{ uid: `${id}-lampe`, trappingId: 'lanterne', equipped }] }) as unknown as Combatant;

describe('sceneLightSources — la liste UNIQUE que le champ mécanique et le rendu partagent', () => {
  const avecBrasero = (): Scene =>
    ({ ...scene(9, 3), entities: [{ id: 'b7', kind: 'prop', pos: { x: 5, y: 0 }, ref: 'brasero' }] }) as unknown as Scene;

  it('exploration : le brasero POSÉ et la lanterne TENUE du groupe — l’objet rangé n’émet rien', () => {
    const base = { scene: avecBrasero(), battle: null, partyPos: { x: 1, y: 1 } };
    const tenue = sceneLightSources({ ...base, party: [porteur('h1', 1, 1, true)] });
    expect(tenue.map((s) => [s.srcId, s.pos.x, s.pos.y, s.radiusTiles]))
      .toEqual([['b7', 5, 0, 4], [undefined, 1, 1, 10]]); // posée (props.json) puis agrégat du groupe
    const rangée = sceneLightSources({ ...base, party: [porteur('h1', 1, 1, false)] });
    expect(rangée.map((s) => s.srcId)).toEqual(['b7']);
  });

  it('combat : chaque PORTEUR est sa propre source, nommée par son id et posée à sa case', () => {
    const battle = { combatants: [porteur('a', 2, 0, true), porteur('b', 7, 2, true), hero(4, 1)] } as never;
    const sources = sceneLightSources({ scene: avecBrasero(), battle, party: [], partyPos: { x: 0, y: 0 } });
    expect(sources.map((s) => [s.srcId, s.pos.x, s.pos.y])).toEqual([['b7', 5, 0], ['a', 2, 0], ['b', 7, 2]]);
  });

  it('c’est bien CETTE liste que le champ de lumière consomme (aucune seconde collecte)', () => {
    const input = { scene: avecBrasero(), battle: null, party: [porteur('h1', 1, 1, true)], partyPos: { x: 1, y: 1 }, gameTime: DAY, lightLevel: 0 };
    const attendu = computeLightField(input.scene, 0, sceneLightSources(input));
    const { light } = sceneLightField(input);
    for (const [x, y] of [[5, 0], [1, 1], [8, 2]]) expect(light.at(x, y)).toBeCloseTo(attendu.at(x, y), 12);
  });
});

describe('« La Diligence » — la lumière PORTÉE éclaire l’étage de son porteur, pas la cour en dessous', () => {
  const scene = diligenceCampaign.scenes[0];
  /** Cases éclairées par une SOURCE, par étage. */
  const parÉtage = (sources: LightSource[]): Record<number, number> => {
    const out: Record<number, number> = { 0: 0, 1: 0 };
    for (const k of computeLightField(scene, 0, sources).sourceLit!) out[+k.split(',')[2]]++;
    return out;
  };
  // Case marchable de l'ÉTAGE du relais (z1), mesurée sur le plan authoré.
  const surLeChemin = { x: 13, y: 6, z: 1 };

  it('la lanterne d’un combattant à l’étage inscrit ses 70 cases à z1, aucune au rez', () => {
    const battle = { combatants: [{ ...porteur('h1', surLeChemin.x, surLeChemin.y, true), pos: surLeChemin }] } as never;
    const sources = sceneLightSources({ scene, battle, party: [], partyPos: { x: 0, y: 0 } });
    expect(sources.map((s) => [s.srcId, s.z, s.radiusTiles, s.carried])).toEqual([['h1', 1, 10, true]]);
    expect(parÉtage(sources)).toEqual({ 0: 0, 1: 70 });
    // Le halo de la MÊME source privée de son étage tomberait tout entier au rez — 70 cases déplacées.
    expect(parÉtage(sources.map((s) => ({ ...s, z: 0 })))).toEqual({ 0: 70, 1: 0 });
  });

  it('la source POSÉE, elle, n’est pas portée (le rendu arbitre son budget là-dessus)', () => {
    const avecTorche: Scene = { ...scene, entities: [...scene.entities, { id: 't1', kind: 'prop', pos: { x: 13, y: 6 }, z: 1, ref: 'brasero' }] } as unknown as Scene;
    const posées = sceneLightSources({ scene: avecTorche, battle: null, party: [], partyPos: { x: 0, y: 0 } });
    expect(posées.map((s) => [s.srcId, s.z, s.carried])).toEqual([['t1', 1, undefined]]);
  });
});

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
