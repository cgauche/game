import { describe, it, expect } from 'vitest';
import { buildingLayers, BUILDINGS } from './buildings';

const dims = { w: 10, h: 10 };
const foot = { x: 2, y: 2, w: 3, h: 3 };

describe('catalogue bâtiments', () => {
  it('résout un type connu en 3 calques non vides', () => {
    const L = buildingLayers('maison', foot, { floors: 2 }, { dims });
    expect(L.walls.length).toBeGreaterThan(0);
    expect(L.roof.length).toBeGreaterThan(0);
    expect(L.interior.length).toBeGreaterThan(0);
  });
  it('type inconnu → fallback (ne jette pas, calques définis)', () => {
    const L = buildingLayers('zzz', foot, {}, { dims });
    expect(L.walls).toBeDefined();
    expect(typeof L.roof).toBe('string');
  });
  it('maison est dans le catalogue', () => {
    expect(BUILDINGS.maison).toBeDefined();
  });
});
