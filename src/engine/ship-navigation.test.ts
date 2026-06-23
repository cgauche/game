import { describe, it, expect } from 'vitest';
import { progressionMovement, resolveShipManeuver } from './shipNavigation';

/**
 * PROGRESSION & MANŒUVRE d'un navire (MDG ch.13 « Navigation maritime ») — couche PURE, book-agnostic
 * (le « Personnage à la barre » + Test de Navigation Voile/Ramer est partagé avec le Compagnon de Mort
 * sur le Reik ch.5, fluvial). Le Test de Manœuvre = Test de Navigation modifié par la Caractéristique Man
 * du bateau (l.119). La table de Progression (l.68-75) traduit le DR en déplacement effectif.
 */
describe('progressionMovement — table de Progression (MDG ch.13 l.68-75)', () => {
  it('DR → déplacement effectif (M+2 / M+1 / M / M−1 / M÷2 arrondi à l’inférieur)', () => {
    expect(progressionMovement(5, 4)).toBe(7); // 4 ou plus → M+2
    expect(progressionMovement(5, 9)).toBe(7);
    expect(progressionMovement(5, 1)).toBe(6); // 1 à 3 → M+1
    expect(progressionMovement(5, 3)).toBe(6);
    expect(progressionMovement(5, 0)).toBe(5); // −2 à 0 → M
    expect(progressionMovement(5, -2)).toBe(5);
    expect(progressionMovement(5, -3)).toBe(4); // −3 à −4 → M−1
    expect(progressionMovement(5, -4)).toBe(4);
    expect(progressionMovement(5, -5)).toBe(2); // −5 ou moins → M÷2 (floor)
    expect(progressionMovement(3, -10)).toBe(1); // floor(3/2)
  });
});

describe('resolveShipManeuver — Test de Manœuvre = Navigation + Man du bateau (MDG ch.13 l.119)', () => {
  it('réussite (DR final ≥ 0) → virage exécuté ; déplacement via la table de Progression', () => {
    const r = resolveShipManeuver(2, 5, 1); // DR nav 2 + Man 1 = 3
    expect(r.dr).toBe(3);
    expect(r.success).toBe(true);
    expect(r.movement).toBe(6); // M+1
    expect(r.label).toContain('progresse bien');
  });

  it('échec (DR final < 0) → pas de virage, mais peut encore progresser « normalement »', () => {
    const r = resolveShipManeuver(-1, 6, 0); // DR final −1
    expect(r.success).toBe(false);
    expect(r.movement).toBe(6); // −2 à 0 → M
  });

  it('la Man du bateau ET un extraDR (Salissures, houle…) modifient le DR final', () => {
    expect(resolveShipManeuver(-1, 6, 2).dr).toBe(1); // Man +2 rattrape → réussite
    expect(resolveShipManeuver(-1, 6, 2).success).toBe(true);
    const fouled = resolveShipManeuver(1, 6, 0, -2); // −2 DR situationnel
    expect(fouled.dr).toBe(-1);
    expect(fouled.success).toBe(false);
  });
});
