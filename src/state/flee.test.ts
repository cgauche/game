import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useGame } from './store';
import { createHero } from '../engine/character';
import { makeRNG } from '../engine/dice';
import { testScene } from '../scenes/test-fixture';
import { fleeReachable } from './path';
import { emptyScene } from './scene';

describe('fleeReachable — Fuite dans la direction OPPOSÉE à l’adversaire (LDB 15-Déplacement l.109)', () => {
  const scene = emptyScene(14, 14);
  const has = (m: Map<string, number>, x: number, y: number) => m.has(`${x},${y}`);
  it('exclut les cases qui RAPPROCHENT de l’adversaire, garde celles qui s’en éloignent', () => {
    const m = fleeReachable(scene, { x: 6, y: 6 }, { x: 6, y: 4 }, 4, new Set()); // adversaire au NORD (Tchebychev 2)
    expect(has(m, 6, 9)).toBe(true); // plein SUD : s'éloigne → permise
    expect(has(m, 6, 5)).toBe(false); // vers le NORD : rapproche → exclue
    expect(has(m, 6, 4)).toBe(false); // la case du foe : exclue
    expect(has(m, 8, 6)).toBe(true); // latérale à distance égale (Tchebychev 2) : ne rapproche pas → permise
  });
  it('bornée au range de Course passé', () => {
    const m = fleeReachable(scene, { x: 6, y: 6 }, { x: 6, y: 4 }, 4, new Set());
    expect(has(m, 6, 6)).toBe(true); // origine
    expect(has(m, 6, 12)).toBe(false); // 6 cases au sud > range 4 → hors de portée
  });
});

// Fuite (LDB 15-Dépl l.101-107) : coup dans le dos + Test de Calme → montrés INLINE dans la modale
// de Désengagement (phase 'fuir'), plus de popin RevealModal séparée.
describe('Fuite intégrée à la modale (store)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllTimers();
    useGame.setState({ pendingReveals: [], pendingDisengage: null, battle: null });
  });
  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it('Fuir résout le coup dans le dos + Test de Calme et les montre INLINE (phase fuir), sans révélation', () => {
    const hero = createHero({ speciesLabel: 'Humains (Reiklander)', careerLabel: 'Soldat', name: 'H', rng: makeRNG(1) });
    useGame.setState({ party: [hero], pendingReveals: [] });
    useGame.getState().seedRng(2);
    useGame.getState().startScene(testScene);
    useGame.getState().startCombat('enc-mutants');
    useGame.getState().confirmRoundStart();
    vi.clearAllTimers();
    const b = useGame.getState().battle!;
    const H = b.combatants.find((c) => c.kind === 'hero')!;
    const E = b.combatants.find((c) => c.kind === 'enemy')!;
    E.characteristics.CC = 90; // le coup dans le dos (+20) touche à coup sûr
    H.wounds = { current: 40, max: 40, base: 40 } as never;
    H.engagedWith = [E.id];
    E.engagedWith = [H.id];
    useGame.setState({
      battle: { ...b },
      pendingReveals: [],
      pendingDisengage: { moverId: H.id, foeId: E.id, canSacrifice: false, phase: 'choice', atk: null, def: null, result: null },
    });

    useGame.getState().disengageFlee();

    // Plus de popin RevealModal : tout est porté par la modale de Désengagement (phase 'fuir').
    expect(useGame.getState().pendingReveals).toHaveLength(0);
    const pdf = useGame.getState().pendingDisengage!;
    expect(pdf).toBeTruthy();
    expect(pdf.phase).toBe('fuir');
    expect(typeof pdf.fuir!.attackerRoll).toBe('number');
    expect(pdf.fuir!.hit).toBe(true); // CC 90 +20 → touche
    expect(typeof pdf.fuir!.calmeRoll).toBe('number'); // touché → Test de Calme résolu

    // « Continuer » ferme la modale (conséquences déjà appliquées).
    useGame.getState().disengageFleeAck();
    expect(useGame.getState().pendingDisengage).toBeNull();
  });
});
