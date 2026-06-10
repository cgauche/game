/**
 * Lot E — compléments Corruption : Âme pure (LDB 10, seuil +niveau), « Je te renie ! »
 * (LDB 17 l.71, refus de mutation contre 1 Résilience), exposition par le Trait Corruption.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { useGame } from './store';
import { gainCorruption } from './corruptionFlow';
import { corruptionThresholdExceeded } from '../engine/corruption';
import { makePregens } from '../data/pregens';
import { bonus } from '../engine/characteristics';
import type { Combatant } from '../engine/types';

function hero(): Combatant {
  return makePregens()[0];
}

beforeEach(() => {
  useGame.setState({ battle: null, party: [], journal: [], pendingCorruption: null, pendingRenounce: null, pendingReveals: [] });
  useGame.getState().seedRng(7);
});

describe('Âme pure (LDB 10) — seuil de Corruption +niveau', () => {
  it('le talent relève le seuil BFM+BE du nombre de niveaux', () => {
    const h = hero();
    const base = bonus(h.characteristics.FM) + bonus(h.characteristics.E);
    h.corruption = base + 1;
    expect(corruptionThresholdExceeded(h)).toBe(true);
    h.talents = [...h.talents, { name: 'Âme pure', times: 2 }];
    expect(corruptionThresholdExceeded(h)).toBe(false); // seuil +2
    h.corruption = base + 3;
    expect(corruptionThresholdExceeded(h)).toBe(true);
  });
});

describe('« Je te renie ! » (LDB 17 l.71)', () => {
  function corruptPastThreshold(h: Combatant): string[] {
    // Force un échec du Test de Résistance en vidant la Résistance effective (E = 1 → cible minuscule)…
    h.characteristics.E = 1;
    h.characteristics.FM = 1;
    h.corruption = 10; // largement au-delà du seuil (BFM+BE = 0)
    return gainCorruption(useGame.getState, useGame.setState, h, 1);
  }
  it('héros avec Résilience → la mutation est SUSPENDUE (pendingRenounce)', () => {
    const h = hero();
    h.resilience = 1;
    useGame.setState({ party: [h] });
    corruptPastThreshold(h);
    // Le Test de Résistance peut réussir selon la graine — on force le cas raté en re-tentant si besoin.
    if (!useGame.getState().pendingRenounce) {
      corruptPastThreshold(h);
    }
    expect(useGame.getState().pendingRenounce).toBeTruthy();
    expect(h.mutations ?? []).toEqual([]);
    const before = h.corruption!;
    useGame.getState().renounceResolve(true);
    expect(useGame.getState().pendingRenounce).toBeNull();
    expect(h.resilience).toBe(0); // 1 Point de Résilience dépensé
    expect(h.mutations ?? []).toEqual([]); // pas de mutation
    expect(h.corruption).toBe(before); // « vous ne perdez aucun Point de Corruption »
  });
  it('« Subir » → la mutation s’applique (−BFM Points, tirage)', () => {
    const h = hero();
    h.resilience = 1;
    useGame.setState({ party: [h] });
    corruptPastThreshold(h);
    if (!useGame.getState().pendingRenounce) corruptPastThreshold(h);
    expect(useGame.getState().pendingRenounce).toBeTruthy();
    useGame.getState().renounceResolve(false);
    expect((h.mutations ?? []).length).toBe(1);
  });
  it('sans Résilience → mutation directe (pas de modale)', () => {
    const h = hero();
    h.resilience = 0;
    useGame.setState({ party: [h] });
    const first = corruptPastThreshold(h);
    if (!first.some((l) => /MUTE/.test(l))) corruptPastThreshold(h);
    expect(useGame.getState().pendingRenounce).toBeNull();
    expect((h.mutations ?? []).length).toBeGreaterThanOrEqual(1);
  });
});
