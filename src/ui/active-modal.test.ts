import { describe, it, expect } from 'vitest';
import { pickActiveModalKey as pick } from './ActiveModal';

/**
 * Arbitre de modales (R2, désormais REGISTRE state/modalArbiter) : une seule modale de combat à
 * la fois, par priorité explicite (ordre du registre). La file est implicite — une modale moins
 * prioritaire dont le `pending` est posé n'apparaît qu'une fois les plus prioritaires fermées.
 * Les tests passent des pendings MINCES (la forme suffit à l'arbitre).
 */
const pickActiveModalKey = (s: object) => pick(s as Parameters<typeof pick>[0]);
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

  it('la Maladresse passe avant l’Abattre', () => {
    expect(pickActiveModalKey({ pendingFumble: {}, pendingKnockdown: {} })).toBe('fumble');
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
