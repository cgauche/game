import { describe, it, expect } from 'vitest';
import { HERO_RING, ENEMY_RING, ACTIVE_RING, hpColor } from './teamColors';

const rgb = (hex: string) => {
  const h = hex.replace('#', '');
  return { r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16) };
};

describe('hpColor', () => {
  it('est rouge sombre à 0 PB et plein rouge en zone critique', () => {
    expect(hpColor(0)).toBe('#922b21');
    expect(hpColor(0.2)).toBe('#e74c3c');
  });
  it('passe orange puis vert quand la santé remonte', () => {
    expect(hpColor(0.5)).toBe('#e8a33d');
    expect(hpColor(1)).toBe('#2ecc71');
  });
  it('borne les ratios hors [0,1]', () => {
    expect(hpColor(-5)).toBe('#922b21');
    expect(hpColor(99)).toBe('#2ecc71');
  });
});

describe('couleurs d’équipe — un allié ne doit pas ressembler à un ennemi/actif', () => {
  it('aucun anneau héros n’est le rouge ennemi ni le jaune actif', () => {
    for (const c of HERO_RING) {
      expect(c).not.toBe(ENEMY_RING);
      expect(c).not.toBe(ACTIVE_RING);
    }
  });
  it('chaque anneau héros est FROID (le rouge ne domine pas) — anti-régression du « rond rouge sur un allié »', () => {
    for (const c of HERO_RING) {
      const { r, g, b } = rgb(c);
      // le rouge ne doit pas être le canal nettement dominant (ce qui le ferait lire « chaud/ennemi »)
      expect(r - Math.max(g, b)).toBeLessThanOrEqual(0);
    }
  });
});
