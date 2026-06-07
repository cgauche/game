import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useGame } from './store';
import { maybeOpenHeroPsych, resolvePsychAI } from './combatFlow';
import { createHero } from '../engine/character';
import { makeRNG } from '../engine/dice';
import { tome1Intro } from '../scenes/tome1-intro';

describe('Traits psy ciblés — déclenchement & résolution (LDB 21, P3)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllTimers();
    useGame.setState({ pendingPsych: null, battle: null });
  });
  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  function setup() {
    const hero = createHero({ speciesLabel: 'Humains (Reiklander)', careerLabel: 'Soldat', name: 'H', rng: makeRNG(1) });
    useGame.setState({ party: [hero] });
    useGame.getState().startScene(tome1Intro);
    useGame.getState().startCombat('enc-mutants');
    vi.clearAllTimers();
    const b = useGame.getState().battle!;
    const H = b.combatants.find((c) => c.kind === 'hero')!;
    const E = b.combatants.find((c) => c.kind === 'enemy')!;
    b.combatants.filter((c) => c.kind === 'enemy' && c.id !== E.id).forEach((e) => (e.dead = true));
    H.pos = { x: 10, y: 10 };
    E.pos = { x: 11, y: 10 }; // Ligne de Vue dégagée
    H.size = 'moyenne';
    E.size = 'moyenne'; // pas de Peur de Taille
    E.causesPeur = undefined;
    E.causesTerreur = undefined;
    const turn = b.order.indexOf(H.id);
    useGame.setState({ battle: { ...b, turn }, pendingPsych: null, pendingReveals: [] });
    return { H, E };
  }

  it('Animosité (Mort-vivant) : la modale s’ouvre face à un ennemi du groupe ; échec → affliction active', () => {
    useGame.getState().seedRng(7);
    const { H, E } = setup();
    H.psychTraits = [{ type: 'animosite', cible: 'Mort-vivant' }];
    E.groups = ['Mort-vivant'];
    H.characteristics.FM = 1; // Test de Calme raté quasi sûr
    maybeOpenHeroPsych(useGame.getState, useGame.setState);
    const pp = useGame.getState().pendingPsych;
    expect(pp?.kind).toBe('animosite');
    expect(pp?.sourceId).toBe(E.id);
    useGame.getState().psychRoll();
    useGame.getState().psychConfirm();
    const h = useGame.getState().battle!.combatants.find((c) => c.id === H.id)!;
    expect((h.psychState ?? []).some((p) => p.type === 'animosite' && p.active)).toBe(true);
  });

  it('succès (Résilience) → marqueur inerte, plus de re-déclenchement ce Round', () => {
    useGame.getState().seedRng(7);
    const { H, E } = setup();
    H.psychTraits = [{ type: 'animosite', cible: 'Mort-vivant' }];
    E.groups = ['Mort-vivant'];
    H.resilience = 1;
    maybeOpenHeroPsych(useGame.getState, useGame.setState);
    useGame.getState().psychRoll();
    useGame.getState().psychForceSuccess(); // garantit le succès
    useGame.getState().psychConfirm();
    const h = useGame.getState().battle!.combatants.find((c) => c.id === H.id)!;
    expect((h.psychState ?? []).some((p) => p.type === 'animosite' && p.active)).toBe(false);
    useGame.getState().psychConfirm; // no-op
    maybeOpenHeroPsych(useGame.getState, useGame.setState);
    expect(useGame.getState().pendingPsych).toBeNull(); // déjà testé → pas de re-déclenchement
  });

  it('IA : resolvePsychAI pose une affliction ciblée active sur échec (Haine)', () => {
    useGame.getState().seedRng(7);
    const { H, E } = setup();
    E.psychTraits = [{ type: 'haine', cible: 'Humain' }];
    H.groups = ['Humain'];
    E.characteristics.FM = 1; // échec quasi sûr
    resolvePsychAI(useGame.getState, useGame.setState, E);
    const e = useGame.getState().battle!.combatants.find((c) => c.id === E.id)!;
    expect((e.psychState ?? []).some((p) => p.type === 'haine' && p.cible === 'Humain' && p.active)).toBe(true);
  });
});
