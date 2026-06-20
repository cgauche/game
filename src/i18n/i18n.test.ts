import { describe, it, expect } from 'vitest';
import { t, interpolate, getLocale } from './index';
import { CHAR_LABELS, DIFFICULTY_LABELS } from '../engine/types';

describe('i18n — primitive t() + catalogue FR (seam, docs/i18n-seam.md)', () => {
  it('résout une clé en texte FR', () => {
    expect(t('char.CC')).toBe('Capacité de Combat');
    expect(t('difficulty.difficile')).toBe('Difficile (−20)');
  });

  it('interpolate remplace {param} et laisse {x} intact si absent', () => {
    expect(interpolate('{actor} réussit (DR {sl}).', { actor: 'Bob', sl: 2 })).toBe('Bob réussit (DR 2).');
    expect(interpolate('{a} et {b}', { a: 'X' })).toBe('X et {b}');
    expect(interpolate('aucun param')).toBe('aucun param');
  });

  it('locale par défaut = fr', () => {
    expect(getLocale()).toBe('fr');
  });

  it('les maps de labels DÉRIVENT du catalogue (source unique, parité verbatim)', () => {
    expect(CHAR_LABELS.CC).toBe(t('char.CC'));
    expect(CHAR_LABELS.Soc).toBe('Sociabilité');
    expect(DIFFICULTY_LABELS.tresFacile).toBe(t('difficulty.tresFacile'));
    expect(DIFFICULTY_LABELS.intermediaire).toBe('Intermédiaire (+0)');
  });
});
