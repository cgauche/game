import { describe, expect, it } from 'vitest';
import type { Dims } from '../../geometry/iso';
import { cutawayForSection, frontFacadeCutaway } from './architectureVisibility';

describe('cutawayForSection', () => {
  it('masque seulement les sections liées à la pièce occupée', () => {
    const occupied = new Set(['salle']);
    expect(cutawayForSection({ roomZoneIds: ['salle'] }, occupied)).toBe('hidden');
    expect(cutawayForSection({ roomZoneIds: ['cuisine'] }, occupied)).toBe('visible');
  });
});

describe('frontFacadeCutaway', () => {
  const occupied = new Set(['salle']);
  const panel = { roomZoneIds: ['salle'], x: 3, y: 3, z: 0, side: 'E' as const };

  it.each<[Dims['rot'], boolean]>([
    [0, true],
    [1, false],
    [2, false],
    [3, true],
  ])('n’ouvre la façade liée que si elle est frontale à la rotation %s', (rot, expected) => {
    expect(frontFacadeCutaway(panel, occupied, { w: 8, h: 8, rot })).toBe(expected);
  });

  it('garde une façade non liée entière même si elle est frontale', () => {
    expect(frontFacadeCutaway({ ...panel, roomZoneIds: ['cuisine'] }, occupied, { w: 8, h: 8, rot: 0 })).toBe(false);
  });
});
