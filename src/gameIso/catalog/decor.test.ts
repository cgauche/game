import { describe, it, expect } from 'vitest';
import { PROPS, propSvg } from './decor';

describe('catalogue décors', () => {
  it('contient les placeables de base', () => {
    for (const id of [
      'tonneau',
      'caisse',
      'charrette',
      'puits',
      'fontaine',
      'etal-marche',
      'statue',
      'lampadaire',
      'panneau',
      'cloture',
      'tas-foin',
      'feu-camp',
      'arbre',
    ])
      expect(PROPS[id], id).toBeDefined();
  });
  it('id inconnu → fallback (tonneau), pas d exception', () => {
    expect(propSvg('zzz').length).toBeGreaterThan(0);
  });
});
