import { describe, it, expect } from 'vitest';
import { facingView, screenDir } from './facing';

describe('facingView', () => {
  it('vers le bas → front, vers le haut → back', () => {
    expect(facingView(0, 10).view).toBe('front');
    expect(facingView(0, -10).view).toBe('back');
  });
  it('latéral net → profile', () => {
    expect(facingView(10, 0).view).toBe('profile');
    expect(facingView(10, 1).view).toBe('profile'); // ax > 1.5*ay
  });
  it('miroir = regarde à gauche (dx < 0)', () => {
    expect(facingView(-10, 5).mirror).toBe(true);
    expect(facingView(10, 5).mirror).toBe(false);
  });
  it('diagonale basse → front, haute → back', () => {
    expect(facingView(5, 10).view).toBe('front');
    expect(facingView(5, -10).view).toBe('back');
  });
});

describe('screenDir', () => {
  it('delta écran iso (screenX ∝ x−y, screenY ∝ x+y)', () => {
    expect(screenDir({ x: 0, y: 0 }, { x: 1, y: 0 })).toEqual({ dx: 1, dy: 1 });
    expect(screenDir({ x: 0, y: 0 }, { x: 0, y: 1 })).toEqual({ dx: -1, dy: 1 });
  });

  it('tourne les extrémités selon dims.rot', () => {
    // sans dims = comportement actuel (rot 0)
    expect(screenDir({ x: 0, y: 0 }, { x: 1, y: 0 })).toEqual({ dx: 1, dy: 1 });
    // rot 1 sur grille 3×3 : (0,0)->(0,2), (1,0)->(0,1) → dx=1, dy=-1
    expect(screenDir({ x: 0, y: 0 }, { x: 1, y: 0 }, { w: 3, h: 3, rot: 1 })).toEqual({ dx: 1, dy: -1 });
  });
});
