import { describe, expect, it } from 'vitest';
import { tintFor, tintOf } from './visibilityTint';
import { fogFilterFor } from '../../FogLayer';
import type { StageObj } from '../../stage/objs';

describe('les teintes sont ANCRÉES sur le voile de production (`FogLayer`)', () => {
  const decor = (x: number, y: number): StageObj => ({ x, y, z: 0 }) as unknown as StageObj;
  const brightness = (filtre: string): number => Number(/brightness\(([^)]+)\)/.exec(filtre)![1]);
  const memorise = fogFilterFor(decor(1, 2), new Set(['1,2,0']))!;
  const inconnu = fogFilterFor(decor(9, 9), new Set())!;

  it('exploré = le terme `brightness` du voile mémorisé de la prod (une seule donnée pour les deux)', () => {
    expect(tintOf('explored')).toBe(brightness(memorise));
  });

  it('inconnu : la prod éteint (`brightness(0)`) + opacité — le scalaire du spike en est une approximation basse, non nulle', () => {
    expect(brightness(inconnu)).toBe(0);
    expect(inconnu).toContain('opacity(.38)');
    expect(tintOf('unknown')).toBeGreaterThan(0);
    expect(tintOf('unknown')).toBeLessThan(tintOf('explored'));
  });

  it('vue : aucun voile en prod, facteur plein ici', () => {
    expect(fogFilterFor({ ...decor(1, 2), vis: true } as StageObj, new Set())).toBeUndefined();
    expect(tintOf('visible')).toBe(1);
  });
});

/** La TABLE DE VÉRITÉ de `visibilityOf` vit dans sa couche (`src/state/visibility.test.ts`) : ici on ne
 *  teste que l'APPLICATION — le mappage état → teinte, et son ancrage sur le voile de production. */
describe('tintFor — l’APPLICATION : la politique, puis le mappage état → teinte', () => {
  const visible = new Set(['1,2,0']);
  const explored = new Set(['1,2,0', '3,4,0']);

  it('chaque case rend la teinte de SON état', () => {
    expect(tintFor('1,2,0', visible, explored)).toBe(tintOf('visible'));
    expect(tintFor('3,4,0', visible, explored)).toBe(tintOf('explored'));
    expect(tintFor('9,9,1', visible, explored)).toBe(tintOf('unknown'));
  });

  it('les trois teintes se rangent dans l’ordre de la politique', () => {
    expect(tintOf('visible')).toBeGreaterThan(tintOf('explored'));
    expect(tintOf('explored')).toBeGreaterThan(tintOf('unknown'));
  });
});
