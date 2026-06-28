import { describe, it, expect } from 'vitest';
import { emptyScene, type Scene, type Terrain } from './scene';
import { pathTo, reachable } from './path';

/**
 * Pathfinding 3D : la traversée verticale passe UNIQUEMENT par les escaliers (`scene.stairs`) —
 * un niveau supérieur (plancher posé sur le « vide ») n'est atteignable que via un escalier. Et le
 * comportement à z=0 (toutes les scènes actuelles) reste byte-identique (clés « x,y » sans suffixe z).
 */
function twoLevel(withStair: boolean): Scene {
  const s = emptyScene(4, 4); // niveau 0 : tout « herbe » (marchable)
  const z1 = new Array(16).fill('vide') as Terrain[];
  for (let y = 1; y <= 3; y++) for (let x = 1; x <= 3; x++) z1[y * 4 + x] = 'plancher'; // plateforme marchable
  s.levels.push({ z: 1, tiles: z1 });
  if (withStair) s.stairs = [{ from: { x: 1, y: 1, z: 0 }, to: { x: 1, y: 1, z: 1 } }];
  return s;
}

describe('path 3D — escaliers', () => {
  const empty = new Set<string>();

  it('pathTo monte à l’étage en empruntant l’escalier', () => {
    const path = pathTo(twoLevel(true), { x: 0, y: 0, z: 0 }, { x: 2, y: 2, z: 1 }, { blocked: empty });
    expect(path).not.toBeNull();
    expect(path![path!.length - 1]).toEqual({ x: 2, y: 2, z: 1 });
    expect(path!.some((p) => (p.z ?? 0) === 0)).toBe(true); // part du sol
    expect(path!.some((p) => (p.z ?? 0) === 1)).toBe(true); // arrive à l'étage
  });

  it('sans escalier, l’étage est inatteignable depuis le sol', () => {
    expect(pathTo(twoLevel(false), { x: 0, y: 0, z: 0 }, { x: 2, y: 2, z: 1 }, { blocked: empty })).toBeNull();
  });

  it('reachable inclut les cases de l’étage via l’escalier', () => {
    const reach = reachable(twoLevel(true), { x: 0, y: 0, z: 0 }, 20, { blocked: empty });
    expect(reach.has('1,1,1')).toBe(true); // sommet de l'escalier
    expect(reach.has('2,2,1')).toBe(true); // case d'étage atteinte
  });
});

describe('path 3D — non-régression à z=0 (clés « x,y » sans suffixe)', () => {
  it('reachable garde les clés 2D pour une scène mono-niveau', () => {
    const reach = reachable(emptyScene(4, 4), { x: 0, y: 0 }, 10, { blocked: new Set<string>() });
    expect(reach.has('3,3')).toBe(true); // atteignable (Manhattan 6 ≤ 10)
    expect([...reach.keys()].every((k) => k.split(',').length === 2)).toBe(true); // jamais « x,y,0 »
  });

  it('pathTo rend un chemin 2D au sol', () => {
    const path = pathTo(emptyScene(4, 4), { x: 0, y: 0 }, { x: 3, y: 0 }, { blocked: new Set<string>() });
    expect(path).not.toBeNull();
    expect(path!.map((p) => p.x)).toEqual([0, 1, 2, 3]);
    expect(path!.every((p) => (p.z ?? 0) === 0)).toBe(true);
  });
});
