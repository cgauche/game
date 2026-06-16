import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useGame } from './store';
import { applyMiscast } from './combatFlow';
import { createHero } from '../engine/character';
import { makeRNG } from '../engine/dice';
import { testScene } from '../scenes/test-fixture';

// Colère des dieux / Incantation Imparfaite — conséquence INLINE dans la séquence partagée
// (« un jet = une modale » : étape d'affichage, plus de RevealModal séparée).
// FOLD (2026-06-16) : la conséquence est désormais APPENDUE à la cascade d'incantation ACTIVE
// (parité avec le Critique d'attaque) via `pushCombatStep` ; hors cascade d'incantation (ces tests
// appellent `applyMiscast` à nu, sans openCastCascade) le fallback démarre une cascade GÉNÉRIQUE
// « Conséquences » et l'identité Colère/Imparfaite vit sur l'ÉTAPE (label/icon), plus sur le titre.
describe('Miscast en séquence (store)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllTimers();
    useGame.setState({ pendingReveals: [], pendingCascade: null, battle: null });
  });
  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  function battle() {
    const hero = createHero({ speciesLabel: 'Humains (Reiklander)', careerLabel: 'Sorcier', name: 'Mage', rng: makeRNG(3) });
    useGame.setState({ party: [hero], pendingReveals: [] });
    useGame.getState().startScene(testScene);
    useGame.getState().startCombat('enc-mutants');
    useGame.getState().confirmRoundStart();
    vi.clearAllTimers();
    const b = useGame.getState().battle!;
    return {
      hero: b.combatants.find((c) => c.kind === 'hero')!,
      enemy: b.combatants.find((c) => c.kind === 'enemy')!,
    };
  }

  it('une Colère des dieux d’un HÉROS ouvre une séquence (étape d’affichage)', () => {
    useGame.getState().seedRng(2);
    const { hero } = battle();
    useGame.setState({ pendingReveals: [], pendingCascade: null });
    applyMiscast(useGame.getState, useGame.setState, hero, 'colere');
    const c = useGame.getState().pendingCascade;
    expect(c?.purpose).toBe('combat');
    expect(c?.participants[0].kind).toBe('miscast');
    expect(c?.participants[0].label).toBe('Colère des dieux'); // identité sur l'ÉTAPE (fold), pas le titre de cascade
    expect(c?.participants[0].outcome?.length).toBeGreaterThan(0); // lignes de la table en affichage
    expect(useGame.getState().pendingReveals).toEqual([]); // plus de RevealModal séparée
  });

  it('une Incantation Imparfaite Mineure d’un HÉROS ouvre une séquence', () => {
    useGame.getState().seedRng(2);
    const { hero } = battle();
    useGame.setState({ pendingReveals: [], pendingCascade: null });
    applyMiscast(useGame.getState, useGame.setState, hero, 'mineure');
    const c = useGame.getState().pendingCascade;
    expect(c?.purpose).toBe('combat');
    expect(c?.participants[0].kind).toBe('miscast');
    expect(c?.participants[0].label).toBe('Imparfaite'); // identité Imparfaite sur l'ÉTAPE (fold)
  });

  it('une Maladresse d’un ENNEMI n’ouvre NI séquence NI révélation (instantané)', () => {
    useGame.getState().seedRng(2);
    const { enemy } = battle();
    useGame.setState({ pendingReveals: [], pendingCascade: null });
    applyMiscast(useGame.getState, useGame.setState, enemy, 'colere');
    expect(useGame.getState().pendingCascade).toBeNull();
    expect(useGame.getState().pendingReveals).toEqual([]);
  });
});
