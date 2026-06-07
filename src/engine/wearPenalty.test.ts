import { describe, it, expect } from 'vitest';
import { parseWearPenalty } from './wearPenalty';

describe('parseWearPenalty', () => {
  it('parse « -10% en Discrétion » → { skill: Discrétion, value: -10 }', () => {
    expect(parseWearPenalty('-10% en Discrétion')).toEqual({ skill: 'Discrétion', value: -10 });
  });
  it('parse « -20% en Perception »', () => {
    expect(parseWearPenalty('-20% en Perception')).toEqual({ skill: 'Perception', value: -20 });
  });
  it('renvoie null pour une qualité non-pénalité', () => {
    expect(parseWearPenalty('Flexible')).toBeNull();
    expect(parseWearPenalty('Impénétrable')).toBeNull();
  });
});
