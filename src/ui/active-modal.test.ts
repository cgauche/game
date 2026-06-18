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
    expect(pickActiveModalKey({ pendingReveals: [{}] })).toBe('reveal');
  });

  it('pendingReveals vide ne compte pas', () => {
    expect(pickActiveModalKey({ pendingReveals: [] })).toBeNull();
  });

  it('la défense n’est PLUS une modale propre : étape `jet:\'defense\'` de la cascade `combat` (wrapper-fold)', () => {
    // pendingDefense SEUL (sans cascade) → plus d'entrée 'defense' (retirée) → null. La SITUATION est portée
    // par la cascade-hôte ouverte par maybeOpenDefense (CascadeModal → useDefenseJetProps).
    expect(pickActiveModalKey({ pendingDefense: {} })).toBeNull();
    const defCascade = { participants: [{ jet: 'defense', actorId: 'h1' }], cursor: 0 };
    expect(pickActiveModalKey({ pendingDefense: {}, pendingCascade: defCascade })).toBe('cascade');
    // Défense réactive (cascade) l'emporte sur le jet d'attaque du joueur : `cascade` avant `attack` au registre.
    expect(pickActiveModalKey({ pendingDefense: {}, pendingCascade: defCascade, pendingAttack: {} })).toBe('cascade');
  });

  it('une révélation témoin passe avant la cascade de défense', () => {
    const defCascade = { participants: [{ jet: 'defense', actorId: 'h1' }], cursor: 0 };
    expect(pickActiveModalKey({ pendingReveals: [{}], pendingDefense: {}, pendingCascade: defCascade })).toBe('reveal');
  });

  it('le sauvetage par Destin domine tout', () => {
    expect(
      pickActiveModalKey({ pendingFateSave: {}, pendingDefense: {}, pendingReveals: [{}], pendingAttack: {} }),
    ).toBe('fateSave');
  });

  it('la Maladresse n’est PLUS une modale propre : étape `jet:\'fumble\'` de la cascade (passe avant la Corruption)', () => {
    // pendingFumble SEUL (sans cascade) → plus d'entrée 'fumble' (retirée au fold Lot 2) → tombe sur 'corruption'.
    expect(pickActiveModalKey({ pendingFumble: {}, pendingCorruption: {} })).toBe('corruption');
    // pendingFumble + cascade `jet:'fumble'` → 'cascade' (avant 'corruption' au registre).
    const fumbleCascade = { participants: [{ jet: 'fumble', actorId: 'h1' }], cursor: 0 };
    expect(pickActiveModalKey({ pendingFumble: {}, pendingCascade: fumbleCascade, pendingCorruption: {} })).toBe('cascade');
  });

  it('Frappe Mortelle / 2ᵉ frappe (Deux armes) ne sont PLUS des modales (ciblage carte, TargetPrompt)', () => {
    expect(pickActiveModalKey({ pendingCleave: {} })).toBeNull();
    expect(pickActiveModalKey({ pendingDualStrike: {} })).toBeNull();
  });

  it('l’attaque n’est PLUS une modale propre : étape `jet:\'attack\'` de la cascade `combat` (charge/normale/gratuite + cleave/dual)', () => {
    // pendingAttack SEUL (sans cascade) → plus d'entrée 'attack' (retirée) → null. TOUS les chemins d'attaque
    // ouvrent une cascade (Charge incluse) ; cleave/dual réutilisent celle déjà ouverte.
    expect(pickActiveModalKey({ pendingAttack: {} })).toBeNull();
    const atkCascade = { participants: [{ jet: 'attack', actorId: 'h1' }], cursor: 0 };
    expect(pickActiveModalKey({ pendingAttack: {}, pendingCascade: atkCascade })).toBe('cascade');
    // Frappe Mortelle : la 2ᵉ frappe (pendingAttack) RÉUTILISE la cascade d'enchaînement → 'cascade'.
    expect(pickActiveModalKey({ pendingCleave: {}, pendingAttack: {}, pendingCascade: atkCascade })).toBe('cascade');
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
