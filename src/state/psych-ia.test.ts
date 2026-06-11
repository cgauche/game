import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useGame } from './store';
import { resolvePsychAI } from './combatFlow';
import { fearSourceFor } from '../engine/psychology';
import { createHero } from '../engine/character';
import { makeRNG } from '../engine/dice';
import { testScene } from '../scenes/test-fixture';
import type { Combatant } from '../engine/types';

describe('Psychologie IA (Peur/Terreur au début du tour)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllTimers();
    useGame.setState({ battle: null });
  });
  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it('fearSourceFor : Énorme vs Moyenne → Terreur 2 ; statbloc Peur 4 ; rien si pas de source', () => {
    const big = { size: 'enorme' } as Combatant;
    const med = { size: 'moyenne' } as Combatant;
    expect(fearSourceFor(med, big)).toEqual({ kind: 'terreur', indice: 2 });
    expect(fearSourceFor(med, { size: 'moyenne', causesPeur: 4 } as Combatant)).toEqual({ kind: 'peur', indice: 4 });
    expect(fearSourceFor(med, med)).toBeNull();
  });

  function setup() {
    const hero = createHero({ speciesLabel: 'Humains (Reiklander)', careerLabel: 'Soldat', name: 'H', rng: makeRNG(1) });
    useGame.setState({ party: [hero] });
    useGame.getState().startScene(testScene);
    useGame.getState().startCombat('enc-mutants');
    vi.clearAllTimers();
    const b = useGame.getState().battle!;
    const H = b.combatants.find((c) => c.kind === 'hero')!;
    const E = b.combatants.find((c) => c.kind === 'enemy')!;
    b.combatants.filter((c) => c.kind === 'enemy' && c.id !== E.id).forEach((e) => (e.dead = true));
    H.pos = { x: 10, y: 10 };
    E.pos = { x: 11, y: 10 }; // adjacent → Ligne de Vue dégagée
    useGame.setState({ battle: { ...b } });
    return { H, E };
  }

  it('un ennemi face à un héros Énorme (Terreur) gagne Brisé + une Peur en psychState', () => {
    useGame.getState().seedRng(2);
    const { H, E } = setup();
    H.size = 'enorme'; // gap 2 → Terreur 2
    E.characteristics.FM = 10; // Test de Calme raté → Brisé
    resolvePsychAI(useGame.getState, useGame.setState, E);
    const e = useGame.getState().battle!.combatants.find((c) => c.id === E.id)!;
    expect(e.conditions.some((c) => c.name === 'Brisé')).toBe(true);
    expect((e.psychState ?? []).some((p) => p.type === 'peur' && p.sourceId === H.id)).toBe(true);
  });

  it('un ennemi Immunité (Psychologie) n’est pas affecté', () => {
    const { H, E } = setup();
    H.size = 'monstrueuse';
    E.psychImmune = true;
    resolvePsychAI(useGame.getState, useGame.setState, E);
    const e = useGame.getState().battle!.combatants.find((c) => c.id === E.id)!;
    expect(e.conditions.some((c) => c.name === 'Brisé')).toBe(false);
    expect(e.psychState ?? []).toEqual([]);
  });
});
