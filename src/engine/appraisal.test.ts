import { describe, it, expect } from 'vitest';
import { appraiseEstimate } from './appraisal';

describe('appraisal — Évaluation estime ±10 % Rare/Exotique (LDB 60 l.10)', () => {
  it('Rare/Exotique → ±10 % ; sinon prix exact', () => {
    expect(appraiseEstimate('Rare', 100)).toEqual({ min: 90, max: 110 });
    expect(appraiseEstimate('Exotique', 200)).toEqual({ min: 180, max: 220 });
    expect(appraiseEstimate('Commune', 100)).toEqual({ min: 100, max: 100 });
    expect(appraiseEstimate(null, 50)).toEqual({ min: 50, max: 50 });
  });
});
