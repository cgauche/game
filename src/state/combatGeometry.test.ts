import { describe, it, expect } from 'vitest';
import { combatantsWithinRadius, occupied, pushBackTiles, displaceSmaller, findFreeTile } from './combatGeometry';
import { emptyScene, type Scene, type Terrain } from './scene';
import type { BattleState } from './store';
import type { Get } from './flowTypes';
import type { Combatant } from '../engine/types';
import type { GameState } from './store';

/**
 * Fixes z-blind #798 (combatantsWithinRadius) / #799 (occupied — bloqueurs + barrières) / #802
 * (pushBackTiles/findFreeTile/displaceSmaller/nearestFreeOutside) : deux combattants/barrières
 * superposés à même (x,y) sur des étages différents doivent rester SÉPARÉS par tout ce module.
 */
const mk = (id: string, x: number, y: number, z?: number, extra?: Partial<Combatant>): Combatant =>
  ({ id, name: id, pos: z ? { x, y, z } : { x, y }, wounds: { current: 10, max: 10, base: 10 }, conditions: [], ...extra }) as unknown as Combatant;
const battle = (cs: Combatant[], zones: BattleState['zones'] = []): BattleState => ({ combatants: cs, zones }) as unknown as BattleState;

describe('combatantsWithinRadius — défaut Z-AWARE (#798)', () => {
  it('un combattant au même (x,y) mais à un autre étage que le centre est HORS rayon', () => {
    const upper = mk('u', 5, 5, 1);
    const sameFloor = mk('s', 5, 5);
    const found = combatantsWithinRadius({ x: 5, y: 5 }, 3, [upper, sameFloor]);
    expect(found.map((c) => c.id)).toEqual(['s']);
  });

  it('un centre lui-même posé en étage (z fourni) ne compte que son étage', () => {
    const upper = mk('u', 5, 5, 1);
    const ground = mk('g', 5, 5);
    const found = combatantsWithinRadius({ x: 5, y: 5, z: 1 }, 3, [upper, ground]);
    expect(found.map((c) => c.id)).toEqual(['u']);
  });
});

describe('occupied — bloqueurs ET barrières séparés par étage (#799)', () => {
  it('un bloqueur z=1 est invisible au sol, visible à son étage', () => {
    const mover = mk('m', 0, 0);
    const upper = mk('u', 5, 5, 1);
    const blocked = occupied(battle([mover, upper]), mover);
    expect(blocked.has('5,5')).toBe(false);
    expect(blocked.has('5,5,1')).toBe(true);
  });

  it('une barrière posée à z=1 ne bloque plus le sol (z=0), seulement son étage', () => {
    const mover = mk('m', 0, 0);
    const b = battle([mover], [{ label: 'mur-arcane', tiles: [{ x: 5, y: 5, z: 1 }], rounds: 1, permanent: true, barrier: {} }] as BattleState['zones']);
    const blocked = occupied(b, mover);
    expect(blocked.has('5,5')).toBe(false);
    expect(blocked.has('5,5,1')).toBe(true);
  });

  it('une barrière au sol (z omis) bloque comme avant', () => {
    const mover = mk('m', 0, 0);
    const b = battle([mover], [{ label: 'mur-arcane', tiles: [{ x: 5, y: 5 }], rounds: 1, permanent: true, barrier: {} }] as BattleState['zones']);
    expect(occupied(b, mover).has('5,5')).toBe(true);
  });
});

describe('pushBackTiles — la poussée glisse sur SON étage (#802)', () => {
  function twoLayerScene(): Scene {
    const s = emptyScene(10, 10); // z0 : tout 'herbe' (marchable)
    const z1 = new Array(10 * 10).fill('herbe') as Terrain[];
    z1[5 * 10 + 6] = 'mur'; // (6,5) infranchissable à l'étage 1
    s.layers.push({ z: 1, tiles: z1 });
    return s;
  }

  it('un mur à l’étage de la cible bloque la poussée même si le SOL (z=0) y est libre', () => {
    const scene = twoLayerScene();
    const attacker = mk('a', 4, 5);
    const target = mk('t', 5, 5, 1); // à l'étage 1
    const get: Get = () => ({ scene, battle: battle([attacker, target]) }) as unknown as GameState;
    const moved = pushBackTiles(get, attacker, target, 1);
    expect(moved).toBe(0);
    expect(target.pos).toEqual({ x: 5, y: 5, z: 1 }); // reste sur place, reste à z=1
  });

  it('même géométrie mais cible au sol (z=0) : le mur de l’étage 1 ne la concerne pas, elle glisse', () => {
    const scene = twoLayerScene();
    const attacker = mk('a', 4, 5);
    const target = mk('t', 5, 5); // sol
    const get: Get = () => ({ scene, battle: battle([attacker, target]) }) as unknown as GameState;
    const moved = pushBackTiles(get, attacker, target, 1);
    expect(moved).toBe(1);
    expect(target.pos).toEqual({ x: 6, y: 5 });
  });
});

describe('displaceSmaller — ne dégage que sur SON étage (#802)', () => {
  it('un plus petit au même (x,y) mais à un AUTRE étage n’est PAS déplacé ; celui du MÊME étage l’est', () => {
    const scene = emptyScene(10, 10);
    const mover = mk('m', 5, 5, undefined, { size: 'grande' }); // empreinte 2×2 au sol
    const sameFloor = mk('s', 5, 5, undefined, { size: 'petite' });
    const upperFloor = mk('u', 5, 5, 1, { size: 'petite' });
    const b = battle([sameFloor, upperFloor]);
    const get: Get = () => ({ scene, battle: b }) as unknown as GameState;

    const moved = displaceSmaller(get, mover);

    expect(moved).toBe(true);
    expect(upperFloor.pos).toEqual({ x: 5, y: 5, z: 1 }); // intact : autre étage, hors d'atteinte
    expect(sameFloor.pos).not.toEqual({ x: 5, y: 5 }); // dégagé de sous l'empreinte du mover
  });
});

describe('findFreeTile — Z-AWARE, replie sur les couches supérieures (#802)', () => {
  it('sol (z=0) libre → renvoie une case SANS z (byte-identique à l’ancien comportement)', () => {
    const scene = emptyScene(3, 3); // tout 'herbe'
    expect(findFreeTile(scene)).toEqual({ x: 0, y: 0 });
  });

  it('sol totalement bloqué, étage 1 libre → replie sur l’étage 1 (z posé)', () => {
    const scene = emptyScene(3, 3);
    scene.layers[0].tiles = new Array(9).fill('mur') as Terrain[];
    scene.layers.push({ z: 1, tiles: new Array(9).fill('herbe') as Terrain[] });
    expect(findFreeTile(scene)).toEqual({ x: 0, y: 0, z: 1 });
  });
});
