import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useGame } from './store';
import { openRoundStartPsych, resolvePsychAI } from './combatFlow';
import { createHero } from '../engine/character';
import { makeRNG } from '../engine/dice';
import { testScene } from '../scenes/test-fixture';

/**
 * Traits psy CIBLÉS en COMBAT (Animosité/Haine/…, LDB 21 l.14 : Test de Calme « au début du Round »).
 * Depuis le fold : c'est une cascade `purpose:'combat'` ouverte par `openRoundStartPsych` (un héros par
 * étape, applier 'combatPsych'), résolue par les handlers `cascade*`. L'IA reste instantanée (resolvePsychAI).
 */
describe('Traits psy ciblés en combat — cascade de DÉBUT de Round (LDB 21)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllTimers();
    useGame.setState({ pendingCascade: null, battle: null });
  });
  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  function setup() {
    const hero = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'H', rng: makeRNG(1) });
    useGame.setState({ party: [hero] });
    useGame.getState().startScene(testScene);
    useGame.getState().startCombat('enc-mutants');
    useGame.getState().confirmRoundStart();
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
    useGame.setState({ battle: { ...b, turn }, pendingCascade: null, pendingReveals: [] });
    return { H, E };
  }

  it('Animosité (Mort-vivant) : la cascade s’ouvre face à un ennemi du groupe ; échec → affliction active', () => {
    useGame.getState().seedRng(7);
    const { H, E } = setup();
    H.psychTraits = [{ type: 'animosite', cible: 'Mort-vivant' }];
    E.groups = ['Mort-vivant'];
    H.characteristics['force-mentale'] = 1; // Test de Calme raté quasi sûr
    openRoundStartPsych(useGame.getState, useGame.setState);
    const c = useGame.getState().pendingCascade;
    expect(c?.purpose).toBe('combat');
    const step = c!.participants[0];
    expect(step.combatPsych?.kind).toBe('animosite');
    expect(step.combatPsych?.sourceId).toBe(E.id);
    useGame.getState().cascadeRoll(step.id);
    useGame.getState().cascadeNext();
    const h = useGame.getState().battle!.combatants.find((c) => c.id === H.id)!;
    expect((h.psychState ?? []).some((p) => p.type === 'animosite' && p.active)).toBe(true);
  });

  it('succès (Résilience) → marqueur inerte, plus de re-déclenchement ce Round', () => {
    useGame.getState().seedRng(7);
    const { H, E } = setup();
    H.psychTraits = [{ type: 'animosite', cible: 'Mort-vivant' }];
    E.groups = ['Mort-vivant'];
    H.resilience = 1;
    openRoundStartPsych(useGame.getState, useGame.setState);
    const step = useGame.getState().pendingCascade!.participants[0];
    useGame.getState().cascadeForceSuccess(step.id); // garantit le succès
    useGame.getState().cascadeNext();
    const h = useGame.getState().battle!.combatants.find((c) => c.id === H.id)!;
    expect((h.psychState ?? []).some((p) => p.type === 'animosite' && p.active)).toBe(false);
    openRoundStartPsych(useGame.getState, useGame.setState);
    expect(useGame.getState().pendingCascade).toBeNull(); // déjà testé ce Round → pas de re-déclenchement
  });

  it('IA : resolvePsychAI pose une affliction ciblée active sur échec (Haine)', () => {
    useGame.getState().seedRng(7);
    const { H, E } = setup();
    E.psychTraits = [{ type: 'haine', cible: 'Humain' }];
    H.groups = ['Humain'];
    E.characteristics['force-mentale'] = 1; // échec quasi sûr
    resolvePsychAI(useGame.getState, useGame.setState, E);
    const e = useGame.getState().battle!.combatants.find((c) => c.id === E.id)!;
    expect((e.psychState ?? []).some((p) => p.type === 'haine' && p.cible === 'Humain' && p.active)).toBe(true);
  });
});
