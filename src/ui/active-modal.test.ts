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

  it('la Maladresse reste prioritaire (l’Abattre est désormais une étape de la cascade d’attaque, plus une modale)', () => {
    expect(pickActiveModalKey({ pendingFumble: {}, pendingCorruption: {} })).toBe('fumble');
  });

  it('Frappe Mortelle / 2ᵉ frappe (Deux armes) ne sont PLUS des modales (ciblage carte, TargetPrompt)', () => {
    expect(pickActiveModalKey({ pendingCleave: {} })).toBeNull();
    expect(pickActiveModalKey({ pendingDualStrike: {} })).toBeNull();
  });

  it('Frappe Mortelle + jet d’enchaînement en cours → le jet prend la main', () => {
    expect(pickActiveModalKey({ pendingCleave: {}, pendingAttack: {} })).toBe('attack');
  });

  it('l’incantation n’est PLUS une modale propre : c’est une étape `jet:\'cast\'` de la cascade (wrapper-fold)', () => {
    // Un pendingCast SEUL (sans cascade) → l'arbitre ne renvoie plus 'cast' (entrée retirée).
    // La SITUATION est désormais portée par la cascade-hôte ouverte à l'incantation (CascadeModal → CastModal).
    expect(pickActiveModalKey({ pendingCast: {} })).toBeNull();
    // pendingCast + cascade `jet:'cast'` → l'arbitre renvoie 'cascade' (qui rend CastModal via le host).
    const castCascade = { participants: [{ jet: 'cast', actorId: 'h1' }], cursor: 0 };
    expect(pickActiveModalKey({ pendingCast: {}, pendingCascade: castCascade })).toBe('cascade');
    // Ciblage CARTE (Surincantation / pose de zone) : le host de CascadeModal s'efface (return null) —
    // l'arbitre renvoie tout de même 'cascade' (la cascade existe) ; c'est le HOST qui ne monte rien.
    expect(pickActiveModalKey({ pendingCast: { pickingTargets: true }, pendingCascade: castCascade })).toBe('cascade');
  });

  it('le Contre-sort n’est PLUS une modale propre : la réaction est rendue DANS la cascade `cast` (Sort ennemi figé)', () => {
    // pendingCounterspell coexiste avec le pendingCast (+ cascade) du Sort ennemi → c'est la modale
    // `cascade` (→ CastModal) qui s'affiche (elle héberge les rangées de contre-lanceurs). Plus d'entrée `counterspell`.
    const enemyCast = { participants: [{ jet: 'cast', groupOwner: true }], cursor: 0 };
    expect(pickActiveModalKey({ pendingCast: {}, pendingCascade: enemyCast, pendingCounterspell: { participants: [] } })).toBe('cascade');
    // Un pendingCounterspell SANS pendingCast/cascade (impossible en pratique) ne déclenche aucune modale.
    expect(pickActiveModalKey({ pendingCounterspell: { participants: [] } })).toBeNull();
  });
});
