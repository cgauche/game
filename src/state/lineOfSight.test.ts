import { describe, it, expect } from 'vitest';
import { tilesBetween, coverModifier, lineOfSightCover } from './lineOfSight';
import { Scene, SceneEntity } from './scene';

function scene(w: number, h: number, tiles?: Record<string, string>, entities: SceneEntity[] = []): Scene {
  const grid = new Array(w * h).fill('herbe');
  if (tiles)
    for (const [k, v] of Object.entries(tiles)) {
      const [x, y] = k.split(',').map(Number);
      grid[y * w + x] = v;
    }
  return {
    id: 's',
    name: 's',
    dimensions: { w, h },
    ambiance: 'jour',
    tiles: grid,
    entities,
    buildings: [],
    dialogues: [],
    triggers: [],
    encounters: [],
  } as unknown as Scene;
}

const prop = (id: string, x: number, y: number, foot?: { w: number; h: number }): SceneEntity =>
  ({ id, kind: 'prop', pos: { x, y }, ref: id, foot }) as SceneEntity;

describe('tilesBetween — cases strictement entre deux points', () => {
  it('horizontal', () => {
    expect(tilesBetween({ x: 0, y: 0 }, { x: 3, y: 0 })).toEqual([{ x: 1, y: 0 }, { x: 2, y: 0 }]);
  });
  it('diagonal', () => {
    expect(tilesBetween({ x: 0, y: 0 }, { x: 2, y: 2 })).toEqual([{ x: 1, y: 1 }]);
  });
  it('adjacent → aucune case intermédiaire', () => {
    expect(tilesBetween({ x: 0, y: 0 }, { x: 1, y: 0 })).toEqual([]);
  });
});

describe('coverModifier — valeurs canon (LDB 14 l.103/114/120)', () => {
  it('imparfaite -10, moyenne -20, totale -30, none 0', () => {
    expect(coverModifier('none')).toBe(0);
    expect(coverModifier('imparfaite')).toBe(-10);
    expect(coverModifier('moyenne')).toBe(-20);
    expect(coverModifier('totale')).toBe(-30);
  });
});

describe('lineOfSightCover', () => {
  it('ligne dégagée → aucun couvert, non bloquée', () => {
    expect(lineOfSightCover(scene(5, 1), { x: 0, y: 0 }, { x: 4, y: 0 }, [])).toEqual({ blocked: false, cover: 'none' });
  });
  it('sous-bois (bois) sur la ligne → imparfaite', () => {
    const s = scene(5, 1, { '2,0': 'bois' });
    expect(lineOfSightCover(s, { x: 0, y: 0 }, { x: 4, y: 0 }, [])).toEqual({ blocked: false, cover: 'imparfaite' });
  });
  it('mur à distance de la cible → pas de Ligne de Vue (bloqué)', () => {
    const s = scene(6, 1, { '2,0': 'mur' });
    expect(lineOfSightCover(s, { x: 0, y: 0 }, { x: 5, y: 0 }, []).blocked).toBe(true);
  });
  it('mur ADJACENT à la cible → couverture totale -30, non bloqué', () => {
    const s = scene(5, 1, { '3,0': 'mur' });
    expect(lineOfSightCover(s, { x: 0, y: 0 }, { x: 4, y: 0 }, [])).toEqual({ blocked: false, cover: 'totale' });
  });
  it('clôture (barrière en bois) sur la ligne → moyenne -20', () => {
    const s = scene(5, 1, {}, [prop('cloture', 2, 0)]);
    expect(lineOfSightCover(s, { x: 0, y: 0 }, { x: 4, y: 0 }, [])).toEqual({ blocked: false, cover: 'moyenne' });
  });
  it('empreinte de charrette (2×1) → couvre ses deux cases', () => {
    const s = scene(6, 1, {}, [prop('charrette', 3, 0, { w: 2, h: 1 })]);
    // la case 4,0 fait partie de l'empreinte → couvert moyen sur la ligne 0,0 → 5,0
    expect(lineOfSightCover(s, { x: 0, y: 0 }, { x: 5, y: 0 }, [])).toEqual({ blocked: false, cover: 'moyenne' });
  });
  it('créature intercalée → couvert imparfait (extrapolation 14 l.75)', () => {
    const occ = [{ x: 2, y: 0 }];
    expect(lineOfSightCover(scene(5, 1), { x: 0, y: 0 }, { x: 4, y: 0 }, occ)).toEqual({ blocked: false, cover: 'imparfaite' });
  });
  it('retient la PIRE classe de couvert sur la ligne', () => {
    const s = scene(6, 1, { '1,0': 'bois' }, [prop('cloture', 3, 0)]);
    // bois (imparfaite) + clôture (moyenne) → pire = moyenne
    expect(lineOfSightCover(s, { x: 0, y: 0 }, { x: 5, y: 0 }, [])).toEqual({ blocked: false, cover: 'moyenne' });
  });
});
