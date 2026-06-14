import { describe, it, expect } from 'vitest';
import { easeDifficulty } from './tests';

describe('easeDifficulty — décale la difficulté de N crans vers plus FACILE', () => {
  it('−1 cran : complexe (−10) → intermediaire (+0) (la détection de bombe avec Poudre noire)', () => {
    expect(easeDifficulty('complexe', 1)).toBe('intermediaire');
  });
  it('−2 crans : difficile → intermediaire', () => {
    expect(easeDifficulty('difficile', 2)).toBe('intermediaire');
  });
  it('plafonne à tresFacile (ne dépasse pas le bout de l’échelle)', () => {
    expect(easeDifficulty('facile', 5)).toBe('tresFacile');
  });
  it('0 cran = inchangé', () => {
    expect(easeDifficulty('intermediaire', 0)).toBe('intermediaire');
  });
});
