import { describe, expect, it } from 'vitest';
import { healSubtitleLabel, healSubtitleVerb } from './healSubtitle';

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

describe('healSubtitleVerb (#499) — un verbe par mode', () => {
  it('wounds — « soigne »', () => {
    expect(healSubtitleVerb('wounds')).toBe('soigne');
  });

  it('bleed — verbe d’hémorragie', () => {
    expect(healSubtitleVerb('bleed')).toBe('stoppe l’hémorragie de');
  });

  it('ammo — verbe d’extraction de munition', () => {
    expect(healSubtitleVerb('ammo')).toBe('retire une munition de');
  });

  it('trauma — verbe adapté', () => {
    expect(healSubtitleVerb('trauma')).toBe('traite la déchirure de');
  });
});
