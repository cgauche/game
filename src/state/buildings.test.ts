import { describe, it, expect } from 'vitest';
import { emptyScene } from './scene';
import { buildingBlockedAt, buildingAt, doorAt, roofHidden, BUILDINGS_META, defaultDoor } from './buildings';
import type { BuildingFeature } from './scene';

const house: BuildingFeature = {
  id: 'b1',
  type: 'maison',
  foot: { x: 2, y: 2, w: 3, h: 3 },
  reveal: 'cutaway',
  door: { x: 3, y: 4 },
};

describe('helpers bâtiment', () => {
  it('le périmètre bloque, la porte et l intérieur cutaway non', () => {
    const s = emptyScene(8, 8);
    s.buildings = [house];
    expect(buildingBlockedAt(s, 2, 2)).toBe(true); // coin (périmètre)
    expect(buildingBlockedAt(s, 3, 2)).toBe(true); // bord haut
    expect(buildingBlockedAt(s, 3, 4)).toBe(false); // porte
    expect(buildingBlockedAt(s, 3, 3)).toBe(false); // intérieur cutaway → walkable
  });
  it('door reveal : intérieur bloqué', () => {
    const s = emptyScene(8, 8);
    s.buildings = [{ ...house, reveal: 'door' }];
    expect(buildingBlockedAt(s, 3, 3)).toBe(true); // intérieur door → bloqué
    expect(buildingBlockedAt(s, 3, 4)).toBe(false); // porte reste franchissable
  });
  it('buildingAt / doorAt', () => {
    const s = emptyScene(8, 8);
    s.buildings = [house];
    expect(buildingAt(s, 3, 3)?.id).toBe('b1');
    expect(buildingAt(s, 0, 0)).toBeUndefined();
    expect(doorAt(s, 3, 4)?.id).toBe('b1');
    expect(doorAt(s, 3, 3)).toBeUndefined();
  });
  it('roofHidden si un allié est dans l empreinte', () => {
    expect(roofHidden(house, [{ x: 3, y: 3 }])).toBe(true);
    expect(roofHidden(house, [{ x: 0, y: 0 }])).toBe(false);
  });
  it('catalogue meta contient maison + chapelle', () => {
    expect(BUILDINGS_META.maison).toBeDefined();
    expect(BUILDINGS_META.chapelle.category).toBe('monument');
  });

  it('defaultDoor place la porte au milieu du mur du côté facing', () => {
    const foot = { x: 2, y: 2, w: 3, h: 3 };
    expect(defaultDoor(foot, 'S')).toEqual({ x: 3, y: 4 }); // bas
    expect(defaultDoor(foot, 'N')).toEqual({ x: 3, y: 2 }); // haut
    expect(defaultDoor(foot, 'E')).toEqual({ x: 4, y: 3 }); // droite
    expect(defaultDoor(foot, 'O')).toEqual({ x: 2, y: 3 }); // gauche
    expect(defaultDoor(foot)).toEqual({ x: 3, y: 4 }); // défaut = S
  });
});
