import { describe, it, expect } from 'vitest';
import { rotTile, unrotTile, effDims, tileCenter, screenToTile, stageSize, type Dims } from './iso';

describe('rotTile / unrotTile', () => {
  const dims: Dims = { w: 5, h: 3 };

  it('rot 0 = identité', () => {
    expect(rotTile(2, 1, { ...dims, rot: 0 })).toEqual({ x: 2, y: 1 });
  });

  it('rot 1 : (x,y) -> (y, W-1-x)', () => {
    expect(rotTile(0, 0, { ...dims, rot: 1 })).toEqual({ x: 0, y: 4 });
    expect(rotTile(4, 0, { ...dims, rot: 1 })).toEqual({ x: 0, y: 0 });
  });

  it('rot 2 : (x,y) -> (W-1-x, H-1-y)', () => {
    expect(rotTile(0, 0, { ...dims, rot: 2 })).toEqual({ x: 4, y: 2 });
  });

  it('rot 3 : (x,y) -> (H-1-y, x)', () => {
    expect(rotTile(0, 0, { ...dims, rot: 3 })).toEqual({ x: 2, y: 0 });
  });

  it('unrotTile inverse rotTile pour les 4 rotations', () => {
    for (const rot of [0, 1, 2, 3] as const) {
      const d = { ...dims, rot };
      for (let x = 0; x < dims.w; x++)
        for (let y = 0; y < dims.h; y++) {
          const r = rotTile(x, y, d);
          expect(unrotTile(r.x, r.y, d)).toEqual({ x, y });
        }
    }
  });
});

describe('effDims', () => {
  it('rot pair = dims inchangées', () => {
    expect(effDims({ w: 5, h: 3, rot: 0 })).toEqual({ w: 5, h: 3 });
    expect(effDims({ w: 5, h: 3, rot: 2 })).toEqual({ w: 5, h: 3 });
  });
  it('rot impair = w/h permutés', () => {
    expect(effDims({ w: 5, h: 3, rot: 1 })).toEqual({ w: 3, h: 5 });
    expect(effDims({ w: 5, h: 3, rot: 3 })).toEqual({ w: 3, h: 5 });
  });
});

describe('projection rot-aware', () => {
  const ROTS = [0, 1, 2, 3] as const;

  it('screenToTile inverse tileCenter pour les 4 rotations', () => {
    for (const rot of ROTS) {
      const dims: Dims = { w: 6, h: 4, rot };
      for (let x = 0; x < dims.w; x++)
        for (let y = 0; y < dims.h; y++) {
          const { cx, cy } = tileCenter(x, y, dims);
          expect(screenToTile(cx, cy, dims)).toEqual({ x, y });
        }
    }
  });

  it('la rotation change réellement la projection écran', () => {
    // une tuile non centrale doit projeter ailleurs sous rot 1 que sous rot 0
    const a = tileCenter(1, 0, { w: 6, h: 4, rot: 0 });
    const b = tileCenter(1, 0, { w: 6, h: 4, rot: 1 });
    expect(b).not.toEqual(a);
    // et la tuile au sommet de l'écran (min cy) change avec la rotation
    const topTile = (rot: 0 | 1) => {
      let best = { x: 0, y: 0, cy: Infinity };
      for (let x = 0; x < 6; x++)
        for (let y = 0; y < 4; y++) {
          const { cy } = tileCenter(x, y, { w: 6, h: 4, rot });
          if (cy < best.cy) best = { x, y, cy };
        }
      return { x: best.x, y: best.y };
    };
    expect(topTile(1)).not.toEqual(topTile(0));
  });

  it('toutes les tuiles tiennent dans stageSize pour les 4 rotations', () => {
    for (const rot of ROTS) {
      const dims: Dims = { w: 6, h: 4, rot };
      const stage = stageSize(dims);
      for (let x = 0; x < dims.w; x++)
        for (let y = 0; y < dims.h; y++) {
          const { cx, cy } = tileCenter(x, y, dims);
          expect(cx).toBeGreaterThanOrEqual(0);
          expect(cx).toBeLessThanOrEqual(stage.w);
          expect(cy).toBeGreaterThanOrEqual(0);
          expect(cy).toBeLessThanOrEqual(stage.h);
        }
    }
  });
});
