import { describe, it, expect } from 'vitest';
import { walkXY, walkDuration } from './walkPath';

const path = [{ x: 2, y: 2 }, { x: 3, y: 2 }, { x: 4, y: 2 }]; // 2 segments

describe('walkXY — glissement fractionnaire le long du chemin', () => {
  it('borne : début = path[0], fin = dernier', () => {
    expect(walkXY(path, 0, 100)).toEqual({ x: 2, y: 2 });
    expect(walkXY(path, 9999, 100)).toEqual({ x: 4, y: 2 });
  });
  it('milieu du 1er segment', () => {
    expect(walkXY(path, 50, 100)).toEqual({ x: 2.5, y: 2 });
  });
  it('jonction puis milieu du 2e segment', () => {
    expect(walkXY(path, 100, 100)).toEqual({ x: 3, y: 2 });
    expect(walkXY(path, 150, 100)).toEqual({ x: 3.5, y: 2 });
  });
  it('diagonale interpolée sur x ET y', () => {
    expect(walkXY([{ x: 0, y: 0 }, { x: 2, y: 4 }], 50, 100)).toEqual({ x: 1, y: 2 });
  });
  it('chemin d’une seule tuile → cette tuile', () => {
    expect(walkXY([{ x: 5, y: 5 }], 0, 100)).toEqual({ x: 5, y: 5 });
  });
  it('walkDuration', () => {
    expect(walkDuration(path, 100)).toBe(200);
    expect(walkDuration([{ x: 0, y: 0 }], 100)).toBe(0);
  });
});
