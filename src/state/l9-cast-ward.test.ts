/**
 * « N'écoutez point la Sorcière » (LDB 42) : « Tous les Sorts qui ciblent quelque chose ou
 * quelqu'un dans les (Bonus de Sociabilité) mètres subissent une pénalité de -20 aux Tests de
 * Langue (Magick), en plus de toute autre pénalité. » — aura `castWard` du porteur, consommée
 * au CALCUL du Test d'incantation (castRoll/castReroll/castDarkPact).
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useGame } from './store';
import { createHero } from '../engine/character';
import { makeRNG } from '../engine/dice';
import { castingValue } from '../engine/magic';
import { testScene } from '../scenes/test-fixture';
import type { Combatant } from '../engine/types';

describe('castWard — pénalité −20 aux Sorts ciblant la zone du prêtre', () => {
  beforeEach(() => { vi.useFakeTimers(); vi.clearAllTimers(); useGame.setState({ battle: null, pendingCast: null }); });
  afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); });

  function setup(priestPos: { x: number; y: number }) {
    const hero = createHero({ speciesLabel: 'Humains (Reiklander)', careerLabel: 'Soldat', name: 'H', rng: makeRNG(1) });
    const priest = createHero({ speciesLabel: 'Humains (Reiklander)', careerLabel: 'Soldat', name: 'P', rng: makeRNG(2) });
    useGame.setState({ party: [hero, priest] });
    useGame.getState().startScene(testScene);
    useGame.getState().startCombat('enc-mutants');
    useGame.getState().confirmRoundStart();
    vi.clearAllTimers();
    const b = useGame.getState().battle!;
    const H = b.combatants.find((c) => c.name === 'H')!;
    const P = b.combatants.find((c) => c.name === 'P')!;
    const E = b.combatants.filter((c) => c.kind === 'enemy')[0];
    // L'ennemi devient un lanceur de Sorts (Langue (Magick)).
    E.spells = ['Fléchette'];
    E.skills.push({ skillId: 'langue', spec: 'Magick', characteristic: 'Int', advances: 10 });
    E.characteristics.Int = 40;
    E.advantage = 0;
    H.pos = { x: 11, y: 10 };
    P.pos = priestPos;
    E.pos = { x: 15, y: 10 };
    // Aura du miracle posée sur le prêtre (rayon 4 m = 2 cases).
    P.activeEffects = [{ label: 'N’écoutez point la Sorcière', bonus: 0, roundsLeft: 5, castWard: { radiusMeters: 4 } }];
    useGame.setState({
      battle: { ...useGame.getState().battle! },
      pendingCast: { casterId: E.id, targetId: H.id, spellLabel: 'Fléchette', missile: true, focused: false, result: null },
    });
    return { H, P, E };
  }

  it('cible à portée de l’aura : le Test de Langue (Magick) prend −20', () => {
    const { E } = setup({ x: 10, y: 10 }); // prêtre adjacent à la cible (2 m ≤ 4 m)
    useGame.getState().castRoll();
    const res = useGame.getState().pendingCast!.result!;
    const base = castingValue(E as Combatant, 'Langue', 'Magick');
    expect(res.target).toBe(base - 20);
  });

  it('cible hors du rayon : aucune pénalité', () => {
    const { E } = setup({ x: 2, y: 2 }); // prêtre loin de la cible
    useGame.getState().castRoll();
    const res = useGame.getState().pendingCast!.result!;
    const base = castingValue(E as Combatant, 'Langue', 'Magick');
    expect(res.target).toBe(base);
  });
});
