import { describe, expect, it } from 'vitest';
import { healSubtitleLabel } from './healSubtitle';

describe('healSubtitleLabel (#499)', () => {
  it('wounds — Intermédiaire (+0)', () => {
    expect(healSubtitleLabel('intermediaire')).toBe('Guérison, Intermédiaire (+0)');
  });

  it('bleed — Accessible (+20) sous la variante combat-aa-blessures', () => {
    expect(healSubtitleLabel('accessible')).toBe('Guérison, Accessible (+20)');
  });

  it('ammo — Intermédiaire (+0)', () => {
    expect(healSubtitleLabel('intermediaire')).toBe('Guérison, Intermédiaire (+0)');
  });
});
