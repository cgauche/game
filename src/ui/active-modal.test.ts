import { describe, it, expect } from 'vitest';
import { pickActiveModalKey } from './ActiveModal';

/**
 * Arbitre de modales (R2) : une seule modale de combat à la fois, par priorité explicite. La file est
 * implicite — une modale moins prioritaire dont le `pending` est posé n'apparaît qu'une fois les plus
 * prioritaires fermées.
 */
describe('pickActiveModalKey — priorité des modales de combat', () => {
  it('aucun pending → null', () => {
    expect(pickActiveModalKey({})).toBeNull();
  });

  it('un seul pending → sa modale', () => {
    expect(pickActiveModalKey({ pendingAttack: {} })).toBe('attack');
    expect(pickActiveModalKey({ pendingDefense: {} })).toBe('defense');
    expect(pickActiveModalKey({ pendingReveals: [{}] })).toBe('reveal');
  });

  it('pendingReveals vide ne compte pas', () => {
    expect(pickActiveModalKey({ pendingReveals: [] })).toBeNull();
  });

  it('défense réactive l’emporte sur le jet d’attaque du joueur', () => {
    expect(pickActiveModalKey({ pendingDefense: {}, pendingAttack: {} })).toBe('defense');
  });

  it('une révélation témoin passe avant la défense', () => {
    expect(pickActiveModalKey({ pendingReveals: [{}], pendingDefense: {} })).toBe('reveal');
  });

  it('le sauvetage par Destin domine tout', () => {
    expect(
      pickActiveModalKey({ pendingFateSave: {}, pendingDefense: {}, pendingReveals: [{}], pendingAttack: {} }),
    ).toBe('fateSave');
  });

  it('la Maladresse passe avant la Déviation', () => {
    expect(pickActiveModalKey({ pendingFumble: {}, pendingDeviation: {}, pendingCleave: {} })).toBe('fumble');
  });

  it('Frappe Mortelle / 2ᵉ frappe (Deux armes) ne sont PLUS des modales (ciblage carte, TargetPrompt)', () => {
    expect(pickActiveModalKey({ pendingCleave: {} })).toBeNull();
    expect(pickActiveModalKey({ pendingDualStrike: {} })).toBeNull();
  });

  it('Frappe Mortelle + jet d’enchaînement en cours → le jet prend la main', () => {
    expect(pickActiveModalKey({ pendingCleave: {}, pendingAttack: {} })).toBe('attack');
  });

  it('Surincantation : choix des cibles sur la carte → la modale d’incantation s’efface', () => {
    expect(pickActiveModalKey({ pendingCast: {} })).toBe('cast');
    expect(pickActiveModalKey({ pendingCast: { pickingTargets: true } })).toBeNull();
  });
});
