import { describe, it, expect } from 'vitest';
import { buildingLayers, BUILDINGS, BUILDINGS_META, footCorners, rotateFacing } from './buildings';
import type { Dims } from '../iso';

const dims = { w: 10, h: 10 };
const foot = { x: 2, y: 2, w: 3, h: 3 };

describe('catalogue de PRESETS DE TOIT (bâtiment composé)', () => {
  // Relief unifié : la structure d'un bâtiment = `WallSeg` (murs d'arête) + sol terrain ; le `BuildingDef`
  // n'est plus qu'un PRESET DE TOIT. Le pipeline de rendu (`RoofSprite.roofObj`) ne consomme que `RoofStyle.roof`.
  it('résout un type connu → un TOIT (svg non vide)', () => {
    const L = buildingLayers('maison', foot, { floors: 2 }, { dims });
    expect(typeof L.roof).toBe('string');
    expect(L.roof.length).toBeGreaterThan(0);
  });
  it('type inconnu → fallback (ne jette pas, toit défini)', () => {
    const L = buildingLayers('zzz', foot, {}, { dims });
    expect(typeof L.roof).toBe('string');
    expect(L.roof.length).toBeGreaterThan(0);
  });
  it('le registre méta (BUILDINGS_META) et le catalogue visuel (BUILDINGS) ont les mêmes ids', () => {
    // garde-fou anti-dérive : un type meta sans render (ou l'inverse) = enregistrement partiel silencieux
    expect(Object.keys(BUILDINGS).sort()).toEqual(Object.keys(BUILDINGS_META).sort());
  });
  it('la méta ne porte QUE {id, label, defaultFoot} (plus de category/defaultReveal)', () => {
    for (const [id, m] of Object.entries(BUILDINGS_META)) {
      expect(m.id, id).toBe(id);
      expect(typeof m.label, id).toBe('string');
      expect(m.defaultFoot, id).toMatchObject({ w: expect.any(Number), h: expect.any(Number) });
      expect(m, id).not.toHaveProperty('category');
      expect(m, id).not.toHaveProperty('defaultReveal');
    }
  });
  it('tous les types méta produisent un toit (render présent)', () => {
    for (const id of Object.keys(BUILDINGS_META)) {
      expect(BUILDINGS[id], id).toBeDefined();
      expect(buildingLayers(id, foot, { floors: 2 }, { dims }).roof.length, `${id}.roof`).toBeGreaterThan(0);
    }
  });
});

describe('rotateFacing', () => {
  it('tourne la façade horaire N→E→S→O', () => {
    expect(rotateFacing('N', 1)).toBe('E');
    expect(rotateFacing('E', 1)).toBe('S');
    expect(rotateFacing('S', 1)).toBe('O');
    expect(rotateFacing('O', 1)).toBe('N');
    expect(rotateFacing('N', 2)).toBe('S');
    expect(rotateFacing('N', 0)).toBe('N');
  });
  it('undefined reste undefined', () => {
    expect(rotateFacing(undefined, 1)).toBeUndefined();
  });
});

describe('footCorners par position écran', () => {
  const fc = { x: 2, y: 2, w: 3, h: 2 };
  it('S = coin le plus bas, N le plus haut, E le plus à droite, O le plus à gauche (4 rotations)', () => {
    for (const rot of [0, 1, 2, 3] as const) {
      const d: Dims = { w: 10, h: 10, rot };
      const c = footCorners(fc, { dims: d });
      const cys = [c.N[1], c.E[1], c.S[1], c.O[1]];
      const cxs = [c.N[0], c.E[0], c.S[0], c.O[0]];
      expect(c.S[1]).toBe(Math.max(...cys));
      expect(c.N[1]).toBe(Math.min(...cys));
      expect(c.E[0]).toBe(Math.max(...cxs));
      expect(c.O[0]).toBe(Math.min(...cxs));
    }
  });
});
