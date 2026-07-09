import { describe, it, expect } from 'vitest';
import { VB_W, VB_H, Z_MIN, Z_MAX, clampViewport, viewOn, fitViewport } from './worldMapViewport';

/** Position ÉCRAN (unités viewBox) d'un point logique sous une vue donnée — même calcul que le
 *  `transform` React (`translate(panX panY) scale(z)`). */
const screenOf = (v: { z: number; panX: number; panY: number }, p: { x: number; y: number }) => ({
  x: v.panX + v.z * p.x,
  y: v.panY + v.z * p.y,
});

describe('worldMapViewport — clampViewport/viewOn', () => {
  it('borne le zoom à [Z_MIN, Z_MAX]', () => {
    expect(clampViewport({ z: 0.2, panX: 0, panY: 0 }).z).toBe(Z_MIN);
    expect(clampViewport({ z: 99, panX: 0, panY: 0 }).z).toBe(Z_MAX);
  });

  it('borne le pan pour ne jamais laisser de vide au-delà du cadre', () => {
    const v = clampViewport({ z: 2, panX: 500, panY: -500 });
    expect(v.panX).toBeLessThanOrEqual(0);
    expect(v.panY).toBeGreaterThanOrEqual(VB_H * (1 - v.z));
  });

  it('viewOn centre le point logique au milieu du cadre (assez loin des bords pour ne pas clamper)', () => {
    const v = viewOn(50, 32, 2);
    const s = screenOf(v, { x: 50, y: 32 });
    expect(s.x).toBeCloseTo(VB_W / 2, 5);
    expect(s.y).toBeCloseTo(VB_H / 2, 5);
  });
});

describe('worldMapViewport — fitViewport (ref #234)', () => {
  it('sans point (lieu isolé, aucune route) : repli sur le cadrage par défaut', () => {
    const fallback = { x: 30, y: 20, z: 2 };
    expect(fitViewport([], fallback)).toEqual(viewOn(fallback.x, fallback.y, fallback.z));
  });

  it('points proches du centre : garde le zoom par défaut (jamais resserré au-delà)', () => {
    const points = [{ x: 50, y: 32 }, { x: 52, y: 33 }];
    const v = fitViewport(points, { x: 50, y: 32, z: 2 });
    expect(v.z).toBe(2);
  });

  it('un badge de route proche du bord (comme #234) : le cadrage dézoome pour le faire rentrer', () => {
    // Lieu courant au centre, destination proche du bord droit — au zoom par défaut (z=2), sa
    // position écran sortirait largement du cadre utile.
    const here = { x: 50, y: 32 };
    const farLabel = { x: 95, y: 32 };
    const fallback = { ...here, z: 2 };
    const naive = screenOf(viewOn(here.x, here.y, 2), farLabel);
    expect(naive.x).toBeGreaterThan(VB_W); // preuve du bug : hors cadre au zoom par défaut

    const v = fitViewport([here, farLabel], fallback);
    expect(v.z).toBeLessThan(2); // a dû dézoomer pour englober le badge
    const s = screenOf(v, farLabel);
    // Reste dans la zone utile (marge de la bordure + du badge à taille écran constante).
    expect(s.x).toBeGreaterThan(8);
    expect(s.x).toBeLessThan(VB_W - 8);
    const sHere = screenOf(v, here);
    expect(sHere.x).toBeGreaterThan(8);
    expect(sHere.x).toBeLessThan(VB_W - 8);
  });

  it('ne dépasse jamais Z_MAX même pour un tout petit nuage de points', () => {
    const v = fitViewport([{ x: 50, y: 32 }, { x: 50.01, y: 32.01 }], { x: 50, y: 32, z: 4 });
    expect(v.z).toBeLessThanOrEqual(Z_MAX);
  });
});
