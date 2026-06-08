import { describe, it, expect } from 'vitest';
import { buildingLayers, BUILDINGS, BUILDINGS_META, footCorners, rotateFacing } from './buildings';
import type { Dims } from '../iso';

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
  it('le registre sémantique (BUILDINGS_META) et le catalogue visuel (BUILDINGS) ont les mêmes ids', () => {
    // garde-fou anti-dérive : un type meta sans render (ou l'inverse) = enregistrement partiel silencieux
    expect(Object.keys(BUILDINGS).sort()).toEqual(Object.keys(BUILDINGS_META).sort());
  });
  it('tous les types meta ont un render produisant 3 calques', () => {
    for (const id of ['maison', 'echoppe', 'taverne', 'forge', 'chapelle', 'tour', 'manoir']) {
      expect(BUILDINGS[id], id).toBeDefined();
      const L = buildingLayers(id, foot, { floors: 2 }, { dims });
      expect(L.walls.length, `${id}.walls`).toBeGreaterThan(0);
      expect(typeof L.interior, `${id}.interior`).toBe('string');
      expect(L.roof.length, `${id}.roof`).toBeGreaterThan(0);
    }
  });
  it('éclaire les fenêtres la nuit (verre ambré + halo + classe flicker `warm`)', () => {
    // de jour : verre froid, ni halo chaud ni animation de scintillement
    const day = buildingLayers('maison', foot, { floors: 2 }, { dims });
    expect(day.walls).toContain('#33414d');
    expect(day.walls).not.toContain('class="warm"');
    // de nuit (ctx.night) : verre ambré #f2c45a, classe `warm` (keyframe flicker), plus de verre froid
    const night = buildingLayers('maison', foot, { floors: 2 }, { dims, night: true });
    expect(night.walls).toContain('#f2c45a');
    expect(night.walls).toContain('class="warm"');
    expect(night.walls).not.toContain('#33414d');
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
