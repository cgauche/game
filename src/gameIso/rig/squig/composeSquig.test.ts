import { describe, it, expect } from 'vitest';
import {
  resolveSquigFromProps, squigChomp, squigBite, squigHop, SQUIG_REST, SQUIG_DEATH, SQUIG_DEFAULT,
} from './composeSquig';

describe('gabarit squig', () => {
  it('résout corps + mâchoire (z), avec crocs', () => {
    const bones = resolveSquigFromProps(SQUIG_DEFAULT, 'front', {});
    expect(bones.map((b) => b.id)).toEqual(['corps', 'machoire']);
    expect(bones.find((b) => b.id === 'machoire')!.parts[0].svg).toContain('#efe6cf'); // crocs ivoire
  });

  it('de dos : pas de mâchoire (face cachée)', () => {
    const back = resolveSquigFromProps(SQUIG_DEFAULT, 'back', {});
    expect(back.map((b) => b.id)).toEqual(['corps']);
  });

  it('recolor : colors.corps change le markup', () => {
    const a = JSON.stringify(resolveSquigFromProps(SQUIG_DEFAULT, 'front', {}));
    const b = JSON.stringify(resolveSquigFromProps(SQUIG_DEFAULT, 'front', {}, { corps: '#2a4aa8' }));
    expect(a).not.toEqual(b);
  });

  it('les poses diffèrent (claque ≠ repos, morsure ouvre grand, bond incline, mort sur le dos)', () => {
    expect(squigChomp(0.25)).not.toEqual(SQUIG_REST);
    expect(squigBite(0.5).machoire).toBeGreaterThan(squigChomp(0.25).machoire);
    expect(squigHop(0.25).corps).not.toBe(0);
    expect(SQUIG_DEATH.corps).toBeGreaterThan(90);
  });
});
