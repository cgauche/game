import { describe, it, expect } from 'vitest';
import { featureToPart } from '../composeRig';
import type { RaceFeature } from './types';

const f = (scale?: 'bone' | 'fixed'): RaceFeature => ({ bone: 'torse', svg: '<rect id="g"/>', scale });

describe("featureToPart — échelle à l'os", () => {
  it("scale:'bone' (défaut) : la part est poussée telle quelle → suit l'échelle de l'os", () => {
    const p = featureToPart(f('bone'), [1.7, 1.7]);
    expect(p.svg).toBe('<rect id="g"/>');           // pas d'enveloppe : l'os l'échelonne
  });
  it("défaut (scale absent) = 'bone'", () => {
    expect(featureToPart(f(), [1.7, 1.7]).svg).toBe('<rect id="g"/>');
  });
  it("scale:'fixed' : enveloppe inverse pour annuler l'échelle de l'os", () => {
    const p = featureToPart(f('fixed'), [1.7, 1.7]);
    expect(p.svg).toContain('<rect id="g"/>');
    expect(p.svg).toMatch(/scale\(0\.5882,0\.5882\)/);   // 1/1.7 ≈ 0.5882
  });
  it("scale:'fixed' sur un os non échelonné (1,1) : pas d'enveloppe inutile", () => {
    expect(featureToPart(f('fixed'), [1, 1]).svg).toBe('<rect id="g"/>');
  });
  it("layer par défaut = 50", () => {
    expect(featureToPart(f('bone'), [1, 1]).layer).toBe(50);
  });
});
