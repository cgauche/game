import { describe, it, expect } from 'vitest';
import { ease, lerpPose } from './tween';

describe('ease', () => {
  it('borne les extrêmes (0→0, 1→1)', () => {
    for (const e of ['linear', 'easeOut', 'easeInOut', 'easeOutBack'] as const) {
      expect(ease(e, 0)).toBeCloseTo(0);
      expect(ease(e, 1)).toBeCloseTo(1);
    }
  });
  it('clamp hors [0,1]', () => {
    expect(ease('linear', -1)).toBeCloseTo(0);
    expect(ease('linear', 2)).toBeCloseTo(1);
  });
});

describe('lerpPose', () => {
  it('t=0 → from, t=1 → to', () => {
    expect(lerpPose({ epauleD: 0 }, { epauleD: 40 }, 0).epauleD).toBeCloseTo(0);
    expect(lerpPose({ epauleD: 0 }, { epauleD: 40 }, 1).epauleD).toBeCloseTo(40);
  });
  it('interpole au milieu', () => {
    expect(lerpPose({ epauleD: 0 }, { epauleD: 40 }, 0.5).epauleD).toBeCloseTo(20);
  });
  it('os absent d’un côté = delta 0', () => {
    expect(lerpPose({}, { epauleD: 40 }, 0.5).epauleD).toBeCloseTo(20);
    expect(lerpPose({ epauleD: 40 }, {}, 0.5).epauleD).toBeCloseTo(20);
  });
});
