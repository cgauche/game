import { describe, it, expect } from 'vitest';
import { discreetPrayerDifficulty, petitePriereAnswered } from './prayer';

describe('« Prêchez ma sœur ! » — Prière discrète (LDB 40 l.42)', () => {
  it('à voix haute : Difficulté inchangée', () => {
    expect(discreetPrayerDifficulty('intermediaire', false)).toBe('intermediaire');
  });
  it('murmurée : un cran plus difficile', () => {
    expect(discreetPrayerDifficulty('intermediaire', true)).toBe('complexe');
    expect(discreetPrayerDifficulty('accessible', true)).toBe('intermediaire');
    expect(discreetPrayerDifficulty('difficile', true)).toBe('tresDifficile');
  });
  it('bornée à la Difficulté la plus dure', () => {
    expect(discreetPrayerDifficulty('impossible', true)).toBe('impossible');
  });
});

describe('« Petites Prières » — non-Béni en site sacré (LDB 25 l.24)', () => {
  it('exaucée sur 01 par défaut', () => {
    expect(petitePriereAnswered(1)).toBe(true);
    expect(petitePriereAnswered(2)).toBe(false);
    expect(petitePriereAnswered(100)).toBe(false);
  });
  it('seuil relevé (Compétence Prière) : exaucée jusqu’au seuil', () => {
    expect(petitePriereAnswered(5, 10)).toBe(true);
    expect(petitePriereAnswered(11, 10)).toBe(false);
  });
});
