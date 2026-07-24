import { describe, expect, it } from 'vitest';
import { cutawayForSection, exteriorWallViewZ, frontFacadeCutaway } from './architectureVisibility';

describe('cutawayForSection', () => {
  it('masque seulement les sections liées à la pièce occupée', () => {
    const occupied = new Set(['salle']);
    expect(cutawayForSection({ roomZoneIds: ['salle'] }, occupied)).toBe('hidden');
    expect(cutawayForSection({ roomZoneIds: ['cuisine'] }, occupied)).toBe('visible');
  });
});

describe('exteriorWallViewZ', () => {
  it('rend toute l’élévation depuis l’extérieur et revient à l’étage actif dans une pièce', () => {
    expect(exteriorWallViewZ(0, false, [0, 1])).toBe(1);
    expect(exteriorWallViewZ(0, true, [0, 1])).toBe(0);
    expect(exteriorWallViewZ(1, false, [0, 1])).toBe(1);
  });
});

describe('frontFacadeCutaway', () => {
  const occupied = new Set(['salle']);
  const panel = { roomZoneIds: ['salle'], x: 3, y: 3, z: 0, side: 'E' as const };
  const tiles = (key: string) => new Map([['salle', new Set([key])]]);

  it.each([
    ['N', '3,3,0', [false, false, true, true]],
    ['N', '3,2,0', [true, true, false, false]],
    ['E', '3,3,0', [true, false, false, true]],
    ['E', '4,3,0', [false, true, true, false]],
  ] as const)('dérive les deux normales de %s depuis la pièce', (side, tile, expected) => {
    for (const rot of [0, 1, 2, 3] as const)
      expect(frontFacadeCutaway({ ...panel, side }, occupied, tiles(tile), { w: 8, h: 8, rot })).toBe(expected[rot]);
  });

  it('garde une façade non liée entière même si elle est frontale', () => {
    expect(frontFacadeCutaway({ ...panel, roomZoneIds: ['cuisine'] }, occupied, tiles('3,3,0'), { w: 8, h: 8, rot: 0 })).toBe(false);
  });

  it('refuse une arête diagonale non authorable', () => {
    expect(frontFacadeCutaway({ ...panel, side: '\\' }, occupied, tiles('3,3,0'), { w: 8, h: 8, rot: 0 })).toBe(false);
  });
});
