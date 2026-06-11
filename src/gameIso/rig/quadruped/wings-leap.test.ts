import { describe, it, expect } from 'vitest';
import { resolveWing, wingedPlan } from '../winged/composeWing';
import { quadrupedPlan } from './composeQuad';
import { quadLeapPose, quadWalkPose } from './quadPose';

const svgOf = (wings?: 'folded' | 'spread') =>
  resolveWing('Dragon', 'profile', {}, undefined, wings).map((b) => b.parts.map((p) => p.svg).join('')).join('');

describe('ailes pliées/déployées (WingState)', () => {
  it("au REPOS (défaut) les ailes sont PLIÉES le long du dos (marqueur data-wing='folded')", () => {
    expect(svgOf()).toContain('data-wing="folded"');
    expect(svgOf('folded')).toContain('data-wing="folded"');
  });
  it('DÉPLOYÉES sur demande (vol/attaque) : art différent, plus de marqueur plié', () => {
    const spread = svgOf('spread');
    expect(spread).not.toContain('data-wing="folded"');
    expect(spread).not.toBe(svgOf('folded'));
  });
  it('le plan ailé route ResolveOpts.wings (parité resolve direct)', () => {
    const viaPlan = wingedPlan.resolve('Dragon', 'profile', {}, { wings: 'spread' }).map((b) => b.parts.map((p) => p.svg).join('')).join('');
    expect(viaPlan).toBe(svgOf('spread'));
  });
});

describe('Bond (trait LDB 85) — démarche bondissante', () => {
  it('les plans quadrupède ET ailé exposent leapPose', () => {
    expect(quadrupedPlan.leapPose).toBeDefined();
    expect(wingedPlan.leapPose).toBeDefined();
  });
  it('détente (phase 0.25) : avants jetés en AVANT, arrières étendus — distinct du trot', () => {
    const leap = quadLeapPose(0.25);
    expect(leap.hautAvD!).toBeLessThan(-30);
    expect(leap.hautArD!).toBeGreaterThan(25);
    expect(leap).not.toEqual(quadWalkPose(0.25));
  });
  it('ramassé (phase 0.75) : pattes repliées sous le corps, dos arqué', () => {
    const leap = quadLeapPose(0.75);
    expect(leap.basAvD!).toBeLessThan(-20); // avant replié
    expect(leap.croupe!).toBeLessThan(0); // dos arqué
  });
});
