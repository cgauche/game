import { describe, expect, it } from 'vitest';
import type { StageObj } from './stage/objs';
import { fogFilterFor } from './FogLayer';

const hidden: StageObj = { d: 0, x: 2, y: 3, z: 0, el: <g /> };

describe('fogFilterFor', () => {
  it('applique le voile inconnu exact aux cases jamais vues', () => {
    expect(fogFilterFor(hidden, new Set())).toBe('brightness(0) opacity(.38)');
  });

  it('conserve le voile mémorisé des cases explorées hors vue', () => {
    expect(fogFilterFor(hidden, new Set(['2,3,0']))).toBe('brightness(0.42) saturate(.45) opacity(.82)');
  });
});
