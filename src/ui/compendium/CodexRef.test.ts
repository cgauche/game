import { describe, it, expect } from 'vitest';
import { computePopoverPos } from './CodexRef';

describe('computePopoverPos — placement du popover dans le viewport (anti-débordement)', () => {
  const VW = 1000;
  const VH = 800;

  it('déclencheur en HAUT → ancré par le haut (sous), maxHeight ≤ place disponible sous', () => {
    const p = computePopoverPos({ left: 100, top: 50, bottom: 70 }, VW, VH);
    expect(p.top).toBe(70 + 6);
    expect(p.bottom).toBeUndefined();
    expect(p.maxHeight).toBeLessThanOrEqual(VH - 70);
  });

  it('déclencheur en BAS → ancré par le bas (au-dessus), jamais hors viewport', () => {
    const p = computePopoverPos({ left: 100, top: 760, bottom: 780 }, VW, VH);
    expect(p.bottom).toBe(VH - 760 + 6);
    expect(p.top).toBeUndefined();
    expect(p.maxHeight).toBeLessThanOrEqual(760);
  });

  it('jamais top ET bottom simultanément, quelle que soit la position', () => {
    for (const top of [10, 200, 400, 600, 790]) {
      const p = computePopoverPos({ left: 0, top, bottom: top + 18 }, VW, VH);
      expect(p.top === undefined || p.bottom === undefined).toBe(true);
    }
  });

  it('viewport étroit (360px) → largeur et gauche bornées au viewport', () => {
    const p = computePopoverPos({ left: 950, top: 100, bottom: 120 }, 360, VH);
    expect(p.width).toBeLessThanOrEqual(360 - 16);
    expect(p.left).toBeGreaterThanOrEqual(8);
    expect(p.left).toBeLessThanOrEqual(360 - p.width - 8);
  });

  it('maxHeight plafonné à 0.6×vh', () => {
    const p = computePopoverPos({ left: 0, top: 400, bottom: 420 }, VW, VH);
    expect(p.maxHeight).toBeLessThanOrEqual(Math.floor(VH * 0.6));
  });
});
