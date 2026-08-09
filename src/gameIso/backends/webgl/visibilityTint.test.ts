import { describe, expect, it } from 'vitest';
import { TINT_EXPLORED, TINT_UNKNOWN, TINT_VISIBLE, tintFor } from './visibilityTint';
import { fogFilterFor } from '../../FogLayer';
import type { StageObj } from '../../stage/objs';

describe('les teintes sont ANCRÉES sur le voile de production (`FogLayer`)', () => {
  const decor = (x: number, y: number): StageObj => ({ x, y, z: 0 }) as unknown as StageObj;
  const brightness = (filtre: string): number => Number(/brightness\(([^)]+)\)/.exec(filtre)![1]);
  const memorise = fogFilterFor(decor(1, 2), new Set(['1,2,0']))!;
  const inconnu = fogFilterFor(decor(9, 9), new Set())!;

  it('exploré = le terme `brightness` du voile mémorisé de la prod', () => {
    expect(TINT_EXPLORED).toBe(brightness(memorise));
  });

  it('inconnu : la prod éteint (`brightness(0)`) + opacité — le scalaire du spike en est une approximation basse, non nulle', () => {
    expect(brightness(inconnu)).toBe(0);
    expect(inconnu).toContain('opacity(.38)');
    expect(TINT_UNKNOWN).toBeGreaterThan(0);
    expect(TINT_UNKNOWN).toBeLessThan(TINT_EXPLORED);
  });

  it('vue : aucun voile en prod, facteur plein ici', () => {
    expect(fogFilterFor({ ...decor(1, 2), vis: true } as StageObj, new Set())).toBeUndefined();
    expect(TINT_VISIBLE).toBe(1);
  });
});
describe('tintFor — une seule politique de visibilité, sans caméra', () => {
  const visible = new Set(['1,2,0']);
  const explored = new Set(['1,2,0', '3,4,0']);

  it('vue > explorée > inconnue', () => {
    expect(tintFor('1,2,0', visible, explored)).toBe(TINT_VISIBLE);
    expect(tintFor('3,4,0', visible, explored)).toBe(TINT_EXPLORED);
    expect(tintFor('9,9,1', visible, explored)).toBe(TINT_UNKNOWN);
    expect(TINT_VISIBLE).toBeGreaterThan(TINT_EXPLORED);
    expect(TINT_EXPLORED).toBeGreaterThan(TINT_UNKNOWN);
  });

  it('la case VUE l’emporte même si elle n’a pas été mémorisée', () => {
    expect(tintFor('7,7,0', new Set(['7,7,0']), new Set())).toBe(TINT_VISIBLE);
  });

  it('l’étage fait partie de la clé (`x,y,z`)', () => {
    expect(tintFor('1,2,1', visible, explored)).toBe(TINT_UNKNOWN);
  });
});
