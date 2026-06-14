import { describe, it, expect } from 'vitest';
import { rotTile, unrotTile, effDims, tileCenter, screenToTile, stageSize, depth, CELL, LEVEL_H, screenToTileAtZ, diamondPath, type Dims } from './iso';

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

describe('depth rot-aware', () => {
  it('le tri depth suit la position écran (cy) pour les 4 rotations', () => {
    for (const rot of [0, 1, 2, 3] as const) {
      const dims: Dims = { w: 5, h: 5, rot };
      const tiles: { d: number; cy: number }[] = [];
      for (let x = 0; x < dims.w; x++)
        for (let y = 0; y < dims.h; y++)
          tiles.push({ d: depth(x, y, dims), cy: tileCenter(x, y, dims).cy });
      const byDepth = [...tiles].sort((a, b) => a.d - b.d).map((t) => t.cy);
      for (let i = 1; i < byDepth.length; i++) expect(byDepth[i]).toBeGreaterThanOrEqual(byDepth[i - 1]);
    }
  });
});

describe('projection multi-niveaux (élévation z)', () => {
  const ROTS = [0, 1, 2, 3] as const;
  const VIEWS = ['iso', 'top'] as const;

  it('z = 0 est rétro-compatible (tileCenter/depth inchangés)', () => {
    const dims: Dims = { w: 5, h: 4 };
    for (let x = 0; x < dims.w; x++)
      for (let y = 0; y < dims.h; y++) {
        expect(tileCenter(x, y, dims, 0)).toEqual(tileCenter(x, y, dims));
        expect(depth(x, y, dims, 0)).toBe(depth(x, y, dims));
      }
  });

  it('un niveau plus haut soulève la tuile à l’écran de z·LEVEL_H (cx inchangé)', () => {
    const dims: Dims = { w: 5, h: 4 };
    const base = tileCenter(2, 1, dims, 0);
    for (const z of [1, 2, 3]) {
      const lifted = tileCenter(2, 1, dims, z);
      expect(lifted.cx).toBe(base.cx);
      expect(lifted.cy).toBe(base.cy - z * LEVEL_H);
    }
  });

  it('depth : tout étage haut se dessine APRÈS tout étage bas', () => {
    for (const view of VIEWS)
      for (const rot of ROTS) {
        const dims: Dims = { w: 5, h: 5, rot, view };
        let maxLow = -Infinity;
        let minHigh = Infinity;
        for (let x = 0; x < dims.w; x++)
          for (let y = 0; y < dims.h; y++) {
            maxLow = Math.max(maxLow, depth(x, y, dims, 0));
            minHigh = Math.min(minHigh, depth(x, y, dims, 1));
          }
        expect(minHigh).toBeGreaterThan(maxLow);
      }
  });

  it('depth : l’ordre intra-niveau est préservé (même tri qu’à z=0)', () => {
    const dims: Dims = { w: 5, h: 5 };
    const cells: { x: number; y: number }[] = [];
    for (let x = 0; x < dims.w; x++) for (let y = 0; y < dims.h; y++) cells.push({ x, y });
    for (const z of [0, 2, 5])
      for (const a of cells)
        for (const b of cells) {
          const base = Math.sign(depth(a.x, a.y, dims, 0) - depth(b.x, b.y, dims, 0));
          const lifted = Math.sign(depth(a.x, a.y, dims, z) - depth(b.x, b.y, dims, z));
          expect(lifted).toBe(base);
        }
  });

  it('screenToTileAtZ inverse tileCenter au niveau donné (iso + top, 4 rotations)', () => {
    for (const view of VIEWS)
      for (const rot of ROTS)
        for (const z of [0, 1, 2]) {
          const dims: Dims = { w: 6, h: 4, rot, view };
          for (let x = 0; x < dims.w; x++)
            for (let y = 0; y < dims.h; y++) {
              const { cx, cy } = tileCenter(x, y, dims, z);
              expect(screenToTileAtZ(cx, cy, dims, z)).toEqual({ x, y });
            }
        }
  });

  it('screenToTileAtZ au niveau 0 = screenToTile (rétro-compat)', () => {
    const dims: Dims = { w: 6, h: 4 };
    for (let x = 0; x < dims.w; x++)
      for (let y = 0; y < dims.h; y++) {
        const { cx, cy } = tileCenter(x, y, dims);
        expect(screenToTileAtZ(cx, cy, dims, 0)).toEqual(screenToTile(cx, cy, dims));
      }
  });
});

describe('projection vue du dessus (view: top)', () => {
  const ROTS = [0, 1, 2, 3] as const;

  it('screenToTile inverse tileCenter (grille carrée) pour les 4 rotations', () => {
    for (const rot of ROTS) {
      const dims: Dims = { w: 6, h: 4, rot, view: 'top' };
      for (let x = 0; x < dims.w; x++)
        for (let y = 0; y < dims.h; y++) {
          const { cx, cy } = tileCenter(x, y, dims);
          expect(screenToTile(cx, cy, dims)).toEqual({ x, y });
        }
    }
  });

  it('les cases voisines sont espacées de CELL (pas de skew iso)', () => {
    const dims: Dims = { w: 5, h: 5, view: 'top' };
    const a = tileCenter(2, 2, dims);
    const bx = tileCenter(3, 2, dims);
    const by = tileCenter(2, 3, dims);
    expect(bx.cx - a.cx).toBe(CELL);
    expect(bx.cy - a.cy).toBe(0); // même rangée → même cy (orthogonal, pas diagonal)
    expect(by.cy - a.cy).toBe(CELL);
    expect(by.cx - a.cx).toBe(0);
  });

  it('diamondPath est un carré axis-aligné de côté CELL', () => {
    const dims: Dims = { w: 3, h: 3, view: 'top' };
    const { cx, cy } = tileCenter(1, 1, dims);
    const h = CELL / 2;
    expect(diamondPath(1, 1, dims)).toBe(
      `M${cx - h},${cy - h} L${cx + h},${cy - h} L${cx + h},${cy + h} L${cx - h},${cy + h} Z`,
    );
  });

  it('toutes les cases tiennent dans stageSize (4 rotations)', () => {
    for (const rot of ROTS) {
      const dims: Dims = { w: 6, h: 4, rot, view: 'top' };
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

  it('depth suit la position écran (cy) en top-mode (4 rotations)', () => {
    for (const rot of ROTS) {
      const dims: Dims = { w: 5, h: 5, rot, view: 'top' };
      const tiles: { d: number; cy: number }[] = [];
      for (let x = 0; x < dims.w; x++)
        for (let y = 0; y < dims.h; y++)
          tiles.push({ d: depth(x, y, dims), cy: tileCenter(x, y, dims).cy });
      const byDepth = [...tiles].sort((a, b) => a.d - b.d).map((t) => t.cy);
      for (let i = 1; i < byDepth.length; i++) expect(byDepth[i]).toBeGreaterThanOrEqual(byDepth[i - 1]);
    }
  });
});
