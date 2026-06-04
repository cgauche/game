import { describe, it, expect } from 'vitest';
import { buildingLayers, BUILDINGS } from './buildings';
import { BUILDINGS_META } from '../../state/buildings';

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
});
