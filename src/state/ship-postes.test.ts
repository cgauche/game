import { describe, it, expect } from 'vitest';
import { placementPenalty } from './shipPostes';

/**
 * PLACEMENT DES PIÈCES D'ARTILLERIE (MDG ch.12 l.428-435 / VO « Boats and Boatbuilding » l.312-319).
 * Pas de slots fixes : placement LIBRE, limité par le POIDS (Enc) des pièces sur un bord vs la Contenance.
 * >25 % de la Contenance sur un bord → −1 M/Man et −1 DR aux Tests de Navigation ; >50 % → −2. La VO précise
 * « one facing » (et non « côté ») → on teste les QUATRE facings (proue/poupe/bâbord/tribord). Seuil STRICT,
 * pénalité = le pire palier atteint par UN bord (pas cumulatif entre bords).
 */
const CAP = 300; // Contenance d'une cogue ; 25 % = 75, 50 % = 150

describe('placementPenalty — déséquilibre du poids des pièces par bord vs Contenance', () => {
  it('aucune pièce → aucune pénalité', () => {
    expect(placementPenalty([], CAP)).toEqual({ m: 0, man: 0, navDR: 0 });
  });

  it('réparti / léger (sous 25 % par bord) → aucune pénalité', () => {
    const mounts = [{ side: 'babord' as const, weight: 5 }, { side: 'babord' as const, weight: 5 }, { side: 'tribord' as const, weight: 5 }];
    expect(placementPenalty(mounts, CAP)).toEqual({ m: 0, man: 0, navDR: 0 });
  });

  it('> 25 % sur un bord → −1 M / −1 Man / −1 DR', () => {
    expect(placementPenalty([{ side: 'tribord', weight: 80 }], CAP)).toEqual({ m: -1, man: -1, navDR: -1 });
  });

  it('> 50 % sur un bord → −2 M / −2 Man / −2 DR', () => {
    expect(placementPenalty([{ side: 'tribord', weight: 160 }], CAP)).toEqual({ m: -2, man: -2, navDR: -2 });
  });

  it('seuil STRICT : exactement 25 % (75) → aucune pénalité', () => {
    expect(placementPenalty([{ side: 'tribord', weight: 75 }], CAP)).toEqual({ m: 0, man: 0, navDR: 0 });
  });

  it('deux bords chacun > 25 % (mais < 50 %) → −1 (pire palier d’UN bord, pas cumulatif)', () => {
    const mounts = [{ side: 'babord' as const, weight: 80 }, { side: 'tribord' as const, weight: 80 }];
    expect(placementPenalty(mounts, CAP)).toEqual({ m: -1, man: -1, navDR: -1 });
  });

  it('la proue est aussi un « facing » (désambiguïsation VO) → concentration à la proue pénalisée', () => {
    expect(placementPenalty([{ side: 'proue', weight: 160 }], CAP)).toEqual({ m: -2, man: -2, navDR: -2 });
  });
});
