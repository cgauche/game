import { describe, expect, it } from 'vitest';
import { emptyScene } from '../../state/scene';
import { roomFocusAt } from './roomFocus';

describe('roomFocusAt', () => {
  it('active uniquement une zone descriptive intérieure contenant exactement la position au même étage', () => {
    const scene = emptyScene(4, 4);
    scene.effectZones = [
      {
        id: 'interieur',
        label: 'Salle',
        presentation: 'interior',
        area: { kind: 'rect', x: 0, y: 0, w: 3, h: 3 },
        tiles: [{ x: 0, y: 0, z: 0 }, { x: 2, y: 2, z: 0 }],
        z: 0,
      },
      {
        id: 'cour',
        label: 'Cour',
        presentation: 'exterior',
        area: { kind: 'rect', x: 1, y: 1, w: 1, h: 1 },
        tiles: [{ x: 1, y: 1, z: 0 }],
        z: 0,
      },
    ];

    expect(roomFocusAt(scene, { x: 1, y: 1, z: 0 })).toBeNull();
    expect(roomFocusAt(scene, { x: 2, y: 2, z: 1 })).toBeNull();
    expect(roomFocusAt(scene, { x: 2, y: 2, z: 0 })).toEqual({
      id: 'interieur',
      z: 0,
      tiles: new Set(['0,0,0', '2,2,0']),
    });
  });

  it('ignore les zones mécaniques même marquées intérieur', () => {
    const scene = emptyScene(2, 2);
    scene.effectZones = [{
      id: 'piege',
      label: 'Piège',
      presentation: 'interior',
      area: { kind: 'rect', x: 0, y: 0, w: 1, h: 1 },
      tiles: [{ x: 0, y: 0, z: 0 }],
      z: 0,
      blocksLoS: true,
    }];
    expect(roomFocusAt(scene, { x: 0, y: 0, z: 0 })).toBeNull();
  });
});
